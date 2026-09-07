"""
Cryptographic security module.

Provides:
- PBKDF2-HMAC-SHA256 password hashing with salt and constant-time verification.
- RFC-7519 compliant JSON Web Token (JWT) encoding and decoding with HS256 signature verification.
- Cryptographically secure token generation for session and refresh tokens.
"""

import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any

from app.config import settings

PBKDF2_ROUNDS = 600_000
SALT_BYTES = 16


def hash_password(password: str) -> str:
    """Hash a plaintext password using PBKDF2-HMAC-SHA256 with a unique random salt."""
    salt = secrets.token_bytes(SALT_BYTES)
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PBKDF2_ROUNDS,
    )
    salt_hex = salt.hex()
    hash_hex = derived.hex()
    return f"pbkdf2_sha256${PBKDF2_ROUNDS}${salt_hex}${hash_hex}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a stored PBKDF2 hash using constant-time comparison."""
    try:
        parts = hashed_password.split("$")
        if len(parts) != 4 or parts[0] != "pbkdf2_sha256":
            return False
        rounds = int(parts[1])
        salt = bytes.fromhex(parts[2])
        expected_hash = bytes.fromhex(parts[3])

        candidate = hashlib.pbkdf2_hmac(
            "sha256",
            plain_password.encode("utf-8"),
            salt,
            rounds,
        )
        return secrets.compare_digest(candidate, expected_hash)
    except Exception:
        return False


def _b64url_encode(data: bytes) -> str:
    """Base64url encode without padding."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    """Base64url decode with automatic padding calculation."""
    padding = 4 - (len(s) % 4)
    if padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s.encode("ascii"))


def create_jwt_token(payload: dict[str, Any], expires_in_seconds: int) -> str:
    """Create a signed JWT token with exp timestamp and HS256 signature."""
    now = int(time.time())
    full_payload = {
        **payload,
        "iat": now,
        "exp": now + expires_in_seconds,
    }

    header = {"alg": "HS256", "typ": "JWT"}

    header_bytes = json.dumps(header, separators=(",", ":")).encode("utf-8")
    payload_bytes = json.dumps(full_payload, separators=(",", ":")).encode("utf-8")

    h_enc = _b64url_encode(header_bytes)
    p_enc = _b64url_encode(payload_bytes)
    message = f"{h_enc}.{p_enc}".encode("ascii")

    sig = hmac.new(
        settings.JWT_SECRET.encode("utf-8"),
        message,
        hashlib.sha256,
    ).digest()
    sig_enc = _b64url_encode(sig)

    return f"{h_enc}.{p_enc}.{sig_enc}"


def decode_jwt_token(token: str) -> dict[str, Any] | None:
    """Validate and decode a JWT token. Returns payload dict or None if invalid/expired."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None

        h_enc, p_enc, sig_enc = parts
        message = f"{h_enc}.{p_enc}".encode("ascii")

        # Verify signature
        expected_sig = hmac.new(
            settings.JWT_SECRET.encode("utf-8"),
            message,
            hashlib.sha256,
        ).digest()

        actual_sig = _b64url_decode(sig_enc)
        if not secrets.compare_digest(expected_sig, actual_sig):
            return None

        payload_bytes = _b64url_decode(p_enc)
        payload = json.loads(payload_bytes.decode("utf-8"))

        # Verify expiry
        exp = payload.get("exp")
        if exp is not None and time.time() > exp:
            return None

        return payload
    except Exception:
        return None


def generate_random_token(length: int = 48) -> str:
    """Generate a URL-safe random string for refresh tokens or API keys."""
    return secrets.token_urlsafe(length)
