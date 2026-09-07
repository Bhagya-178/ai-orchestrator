"""
Authentication API endpoints: Register, Login, Token Refresh, Current User Profile, and Logout.
"""

from datetime import datetime, timedelta, timezone
from uuid import uuid4
import hashlib

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.auth.dependencies import get_current_user
from app.auth.security import (
    hash_password,
    verify_password,
    create_jwt_token,
    generate_random_token,
)
from app.config import settings
from app.database.session import get_db
from app.database.models import User, RefreshToken
from app.schemas import (
    UserRegisterRequest,
    UserLoginRequest,
    UserResponse,
    UserUpdateRequest,
    TokenResponse,
    RefreshTokenRequest,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _user_to_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name or "",
        role=user.role or "user",
        is_active=bool(user.is_active),
        custom_instructions=user.custom_instructions or "",
        created_at=user.created_at.isoformat() if user.created_at else datetime.now(timezone.utc).isoformat(),
    )


def _hash_token(raw_token: str) -> str:
    """Hash refresh token for secure database storage."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


async def _issue_token_pair(db: AsyncSession, user: User) -> tuple[str, str]:
    """Issue a short-lived access token and store a long-lived refresh token."""
    # 1. Access token (JWT)
    access_token = create_jwt_token(
        payload={
            "sub": user.id,
            "email": user.email,
            "role": user.role,
        },
        expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )

    # 2. Refresh token (Random cryptographic string)
    raw_refresh = generate_random_token(48)
    token_hash = _hash_token(raw_refresh)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    refresh_row = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(refresh_row)
    await db.commit()

    return access_token, raw_refresh


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    body: UserRegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user account and immediately issue authentication tokens."""
    # Check if email is taken
    existing = await db.execute(select(User).where(User.email == body.email.strip().lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    user_id = str(uuid4())
    hashed_pwd = hash_password(body.password)

    new_user = User(
        id=user_id,
        email=body.email.strip().lower(),
        hashed_password=hashed_pwd,
        full_name=body.full_name or "",
        role="user",
        is_active=True,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    access_token, refresh_token = await _issue_token_pair(db, new_user)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=_user_to_response(new_user),
    )


@router.post("/login", response_model=TokenResponse)
async def login_user(
    body: UserLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate user with email and password, returning tokens."""
    result = await db.execute(select(User).where(User.email == body.email.strip().lower()))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled. Please contact administrator.",
        )

    access_token, refresh_token = await _issue_token_pair(db, user)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=_user_to_response(user),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_access_token(
    body: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """Exchange a valid refresh token for a new access token and rotated refresh token."""
    token_hash = _hash_token(body.refresh_token)

    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    stored_token = result.scalar_one_or_none()

    if not stored_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token.",
        )

    # Check expiry
    now_utc = datetime.now(timezone.utc)
    if stored_token.expires_at.tzinfo is None:
        stored_expires = stored_token.expires_at.replace(tzinfo=timezone.utc)
    else:
        stored_expires = stored_token.expires_at

    if now_utc > stored_expires:
        await db.delete(stored_token)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired. Please log in again.",
        )

    # Fetch user
    user_res = await db.execute(select(User).where(User.id == stored_token.user_id))
    user = user_res.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer active.",
        )

    # Delete old refresh token (Token rotation for high security)
    await db.delete(stored_token)
    await db.commit()

    # Issue new pair
    access_token, new_refresh_token = await _issue_token_pair(db, user)

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        user=_user_to_response(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Retrieve profile and custom instructions of the currently authenticated user."""
    return _user_to_response(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    body: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update profile attributes, system custom instructions, or password."""
    if body.full_name is not None:
        current_user.full_name = body.full_name.strip()
    if body.custom_instructions is not None:
        current_user.custom_instructions = body.custom_instructions.strip()
    if body.password is not None and len(body.password.strip()) >= 6:
        current_user.hashed_password = hash_password(body.password.strip())

    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return _user_to_response(current_user)


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    body: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """Revoke a refresh token on logout."""
    token_hash = _hash_token(body.refresh_token)
    await db.execute(delete(RefreshToken).where(RefreshToken.token_hash == token_hash))
    await db.commit()
    return {"success": True, "message": "Logged out successfully"}
