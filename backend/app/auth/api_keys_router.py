"""
API Key management router.

Endpoints:
- GET /auth/api-keys: List user's active API keys.
- POST /auth/api-keys: Generate a new API key.
- DELETE /auth/api-keys/{key_id}: Revoke an API key.
- GET /auth/api-keys/scopes: List available scopes.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.api_keys import STANDARD_SCOPES, generate_api_key
from app.auth.dependencies import get_current_user, get_optional_user
from app.database.models import ApiKey, User
from app.database.session import get_db

router = APIRouter(prefix="/auth/api-keys", tags=["API Keys"])


class CreateApiKeyRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Friendly label for the API key")
    scopes: list[str] = Field(default_factory=lambda: ["chat:read", "chat:write"], description="Allowed scopes")
    prefix: str = Field(default="ak_live", description="Key prefix ('ak_live' or 'ak_test')")
    expires_in_days: Optional[int] = Field(default=None, ge=1, le=365, description="Expiry duration in days")


class ApiKeyResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    scopes: list[str]
    is_active: bool
    last_used_at: Optional[str]
    expires_at: Optional[str]
    created_at: str


class CreateApiKeyResponse(ApiKeyResponse):
    raw_key: str = Field(..., description="The raw secret key. Only returned once!")


@router.get("/scopes")
async def list_available_scopes():
    """Return all valid permission scopes."""
    return {"scopes": STANDARD_SCOPES}


@router.get("", response_model=list[ApiKeyResponse])
async def list_api_keys(
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """List all API keys belonging to the authenticated user."""
    if not current_user:
        return []

    stmt = (
        select(ApiKey)
        .where(ApiKey.user_id == current_user.id)
        .order_by(ApiKey.created_at.desc())
    )
    result = await db.execute(stmt)
    keys = result.scalars().all()

    return [
        ApiKeyResponse(
            id=k.id,
            name=k.name,
            key_prefix=k.key_prefix,
            scopes=k.scopes or [],
            is_active=k.is_active,
            last_used_at=k.last_used_at.isoformat() if k.last_used_at else None,
            expires_at=k.expires_at.isoformat() if k.expires_at else None,
            created_at=k.created_at.isoformat() if k.created_at else "",
        )
        for k in keys
    ]


@router.post("", response_model=CreateApiKeyResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    req: CreateApiKeyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a new API key. The raw secret key is only displayed once."""
    for s in req.scopes:
        if s not in STANDARD_SCOPES and s != "*":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid scope '{s}'. Allowed: {STANDARD_SCOPES}",
            )

    prefix = "ak_test" if req.prefix == "ak_test" else "ak_live"
    raw_key, key_prefix, key_hash = generate_api_key(prefix=prefix)

    expires_at = None
    if req.expires_in_days:
        from datetime import timedelta
        expires_at = datetime.now(timezone.utc) + timedelta(days=req.expires_in_days)

    new_key = ApiKey(
        user_id=current_user.id,
        name=req.name.strip(),
        key_prefix=key_prefix,
        key_hash=key_hash,
        scopes=req.scopes,
        is_active=True,
        expires_at=expires_at,
    )
    db.add(new_key)
    await db.commit()
    await db.refresh(new_key)

    return CreateApiKeyResponse(
        id=new_key.id,
        name=new_key.name,
        key_prefix=new_key.key_prefix,
        scopes=new_key.scopes or [],
        is_active=new_key.is_active,
        last_used_at=None,
        expires_at=new_key.expires_at.isoformat() if new_key.expires_at else None,
        created_at=new_key.created_at.isoformat() if new_key.created_at else "",
        raw_key=raw_key,
    )


@router.delete("/{key_id}")
async def revoke_api_key(
    key_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently revoke or delete an API key."""
    key = await db.get(ApiKey, key_id)
    if not key or (key.user_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")

    await db.delete(key)
    await db.commit()
    return {"message": "API key successfully revoked", "id": key_id}
