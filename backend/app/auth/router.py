"""
Authentication API endpoints: Register, Login, Token Refresh, Current User Profile, and Logout.
"""

from datetime import datetime, timedelta, timezone
from uuid import uuid4
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from uuid import uuid4

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
from app.database.models import User, RefreshToken, EmailVerification
from app.services.email_service import email_service
from app.schemas import (
    UserRegisterRequest,
    UserLoginRequest,
    UserResponse,
    UserUpdateRequest,
    TokenResponse,
    RefreshTokenRequest,
    OtpRegisterResponse,
    VerifyOtpRequest,
    ResendOtpRequest,
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


def _hash_otp(otp_code: str) -> str:
    """Hash 6-digit OTP code using SHA-256 with JWT_SECRET pepper."""
    return hashlib.sha256(f"{otp_code.strip()}:{settings.JWT_SECRET}".encode("utf-8")).hexdigest()


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


@router.post("/register", response_model=OtpRegisterResponse, status_code=status.HTTP_200_OK)
async def register_user(
    body: UserRegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Initiate user registration by validating email and generating a 6-digit OTP.
    Account is verified and created once the user submits the correct OTP.
    """
    clean_email = body.email.strip().lower()

    # 1. Check if an active account already exists
    existing = await db.execute(select(User).where(User.email == clean_email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    # 2. Check pending verification and enforce resend cooldown
    now_utc = datetime.now(timezone.utc)
    pending_query = await db.execute(
        select(EmailVerification).where(EmailVerification.email == clean_email)
    )
    pending = pending_query.scalar_one_or_none()

    if pending and pending.last_sent_at:
        elapsed = (now_utc - pending.last_sent_at).total_seconds()
        if elapsed < settings.OTP_RESEND_COOLDOWN_SECONDS:
            remaining = int(settings.OTP_RESEND_COOLDOWN_SECONDS - elapsed)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {remaining} seconds before requesting a new verification code.",
            )

    # 3. Generate 6-digit OTP and expiration
    otp = f"{secrets.randbelow(900000) + 100000}"
    otp_hash = _hash_otp(otp)
    hashed_pwd = hash_password(body.password)
    expires_at = now_utc + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

    if pending:
        pending.otp_hash = otp_hash
        pending.hashed_password = hashed_pwd
        pending.full_name = body.full_name or ""
        pending.attempts = 0
        pending.expires_at = expires_at
        pending.last_sent_at = now_utc
    else:
        new_pending = EmailVerification(
            email=clean_email,
            otp_hash=otp_hash,
            full_name=body.full_name or "",
            hashed_password=hashed_pwd,
            attempts=0,
            expires_at=expires_at,
            last_sent_at=now_utc,
        )
        db.add(new_pending)

    await db.commit()

    # 4. Dispatch verification email (SMTP or development console banner)
    await email_service.send_otp_email(
        to_email=clean_email,
        otp_code=otp,
        full_name=body.full_name or "",
    )

    return OtpRegisterResponse(
        success=True,
        message=f"Verification code sent to {clean_email}.",
        email=clean_email,
        cooldown_seconds=settings.OTP_RESEND_COOLDOWN_SECONDS,
        dev_otp=otp if not settings.SMTP_HOST else None,
    )


@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(
    body: VerifyOtpRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Verify 6-digit OTP code.
    On successful verification, inserts user into database and issues JWT tokens.
    """
    clean_email = body.email.strip().lower()
    clean_otp = body.otp.strip()

    pending_query = await db.execute(
        select(EmailVerification).where(EmailVerification.email == clean_email)
    )
    pending = pending_query.scalar_one_or_none()

    if not pending:
        # Check if already registered
        existing = await db.execute(select(User).where(User.email == clean_email))
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This email address is already verified. Please sign in.",
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No pending registration found for this email. Please sign up first.",
        )

    now_utc = datetime.now(timezone.utc)

    # 1. Check expiration
    if pending.expires_at < now_utc:
        await db.delete(pending)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code.",
        )

    # 2. Check maximum attempts
    if pending.attempts >= settings.OTP_MAX_ATTEMPTS:
        await db.delete(pending)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum verification attempts exceeded. Please request a new code.",
        )

    # 3. Verify OTP code using constant-time comparison
    expected_hash = _hash_otp(clean_otp)
    if not hmac.compare_digest(expected_hash, pending.otp_hash):
        pending.attempts += 1
        await db.commit()
        remaining = settings.OTP_MAX_ATTEMPTS - pending.attempts
        if remaining > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid verification code. {remaining} attempt(s) remaining.",
            )
        else:
            await db.delete(pending)
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code. Maximum attempts reached. Please request a new code.",
            )

    # 4. Check if account was registered concurrently
    existing = await db.execute(select(User).where(User.email == clean_email))
    if existing.scalar_one_or_none():
        await db.delete(pending)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists. Please sign in.",
        )

    # 5. Create user account
    new_user = User(
        id=str(uuid4()),
        email=pending.email,
        hashed_password=pending.hashed_password,
        full_name=pending.full_name or "",
        role="user",
        is_active=True,
    )
    db.add(new_user)
    await db.delete(pending)
    await db.commit()
    await db.refresh(new_user)

    # 6. Issue JWT access & refresh tokens
    access_token, refresh_token = await _issue_token_pair(db, new_user)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=_user_to_response(new_user),
    )


@router.post("/resend-otp", response_model=OtpRegisterResponse)
async def resend_otp(
    body: ResendOtpRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Resend a fresh 6-digit OTP code to a pending registration email.
    Subject to cooldown rate limiting.
    """
    clean_email = body.email.strip().lower()

    pending_query = await db.execute(
        select(EmailVerification).where(EmailVerification.email == clean_email)
    )
    pending = pending_query.scalar_one_or_none()

    if not pending:
        existing = await db.execute(select(User).where(User.email == clean_email))
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Account is already registered and verified. Please sign in.",
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No pending registration found for this email. Please sign up first.",
        )

    now_utc = datetime.now(timezone.utc)

    # Enforce cooldown
    if pending.last_sent_at:
        elapsed = (now_utc - pending.last_sent_at).total_seconds()
        if elapsed < settings.OTP_RESEND_COOLDOWN_SECONDS:
            remaining = int(settings.OTP_RESEND_COOLDOWN_SECONDS - elapsed)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {remaining} seconds before requesting another verification code.",
            )

    # Generate new OTP
    otp = f"{secrets.randbelow(900000) + 100000}"
    pending.otp_hash = _hash_otp(otp)
    pending.expires_at = now_utc + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
    pending.attempts = 0
    pending.last_sent_at = now_utc
    await db.commit()

    await email_service.send_otp_email(
        to_email=clean_email,
        otp_code=otp,
        full_name=pending.full_name or "",
    )

    return OtpRegisterResponse(
        success=True,
        message=f"A fresh verification code was sent to {clean_email}.",
        email=clean_email,
        cooldown_seconds=settings.OTP_RESEND_COOLDOWN_SECONDS,
        dev_otp=otp if not settings.SMTP_HOST else None,
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
