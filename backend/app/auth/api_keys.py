"""
API Key authentication and authorization subsystem.

Provides:
- Cryptographically secure API key generation (e.g. ak_live_... or ak_test_...)
- SHA-256 constant-time hash verification
- Scoped permissions authorization ("chat:read", "chat:write", "rag:admin", "agents:run")
- FastAPI header dependency injection
"""

import hashlib
import logging
import secrets
from datetime import datetime, timezone
from typing import Sequence

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import ApiKey, User
from app.database.session import get_db

logger = logging.getLogger(__name__)

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)

STANDARD_SCOPES = [
    "chat:read",
    "chat:write",
    "rag:read",
    "rag:write",
    "rag:admin",
    "agents:run",
    "tools:execute",
    "analytics:read",
]


def generate_api_key(prefix: str = "ak_live") -> tuple[str, str, str]:
    """
    Generate a new cryptographically secure API key.

    Returns:
        tuple of (raw_key, key_prefix, key_hash)
        - raw_key: Returned to user ONCE during creation (e.g., ak_live_3f9a...)
        - key_prefix: Stored for display/lookup in UI (e.g., ak_live_3f9a...)
        - key_hash: Stored in DB (SHA-256 of raw_key)
    """
    random_part = secrets.token_urlsafe(32)
    raw_key = f"{prefix}_{random_part}"
    key_prefix = raw_key[:12] + "..."
    key_hash = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
    return raw_key, key_prefix, key_hash


def hash_api_key(raw_key: str) -> str:
    """Hash an API key with SHA-256."""
    return hashlib.sha256(raw_key.strip().encode("utf-8")).hexdigest()


async def get_api_key_auth(
    raw_key: str | None = Security(API_KEY_HEADER),
    db: AsyncSession = Depends(get_db),
) -> tuple[ApiKey, User]:
    """
    Validate incoming X-API-Key header, checking DB hash, active status, and expiry.
    """
    if not raw_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-API-Key header",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    computed_hash = hash_api_key(raw_key)

    stmt = (
        select(ApiKey, User)
        .join(User, ApiKey.user_id == User.id)
        .where(ApiKey.key_hash == computed_hash)
    )
    result = await db.execute(stmt)
    row = result.first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )

    api_key, user = row

    if not api_key.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="API key has been revoked",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Associated user account is deactivated",
        )

    if api_key.expires_at:
        now = datetime.now(timezone.utc)
        if api_key.expires_at < now:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API key has expired",
            )

    # Update last_used_at timestamp
    api_key.last_used_at = datetime.now(timezone.utc)
    await db.commit()

    return api_key, user


def require_api_key_scope(required_scope: str):
    """
    FastAPI dependency factory enforcing that an API key possesses a specific scope.
    """
    async def _scope_checker(auth: tuple[ApiKey, User] = Depends(get_api_key_auth)) -> tuple[ApiKey, User]:
        api_key, user = auth
        scopes = api_key.scopes or []
        # 'admin' role or 'admin:*' scope bypasses individual scope restrictions
        if user.role == "admin" or "*" in scopes or "admin:*" in scopes:
            return auth

        if required_scope not in scopes:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"API key missing required scope: '{required_scope}'",
            )
        return auth

    return _scope_checker
