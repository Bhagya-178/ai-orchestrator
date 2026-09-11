"""Integration tests for JWT creation, claims validation, tampering defense, and expiration (Tests 011 - 020)."""
from datetime import datetime, timezone
from app.auth.security import create_jwt_token, decode_jwt_token

DATA = {"sub": "user_12345", "email": "engineer@enterprise.ai", "role": "admin"}

def test_011_jwt_creation_and_decode():
    token = create_jwt_token(DATA, expires_in_seconds=1800)
    decoded = decode_jwt_token(token)
    assert decoded is not None and decoded.get("sub") == "user_12345", "JWT created and decoded"

def test_012_jwt_expiration_valid():
    token = create_jwt_token(DATA, expires_in_seconds=1800)
    decoded = decode_jwt_token(token)
    exp = decoded.get("exp", 0)
    now_ts = datetime.now(timezone.utc).timestamp()
    assert exp > now_ts, "Expiration is in the future"

def test_013_jwt_expired_token_rejected():
    expired_token = create_jwt_token(DATA, expires_in_seconds=-30)
    assert decode_jwt_token(expired_token) is None, "Expired token rejected"

def test_014_jwt_signature_tampering():
    token = create_jwt_token(DATA, expires_in_seconds=1800)
    parts = token.split(".")
    tampered_sig = parts[0] + "." + parts[1] + "." + "invalid_signature_hex"
    assert decode_jwt_token(tampered_sig) is None, "Tampered signature rejected"

def test_015_jwt_payload_tampering():
    token = create_jwt_token(DATA, expires_in_seconds=1800)
    parts = token.split(".")
    tampered_payload = parts[0] + "." + parts[1][:-2] + "AA" + "." + parts[2]
    assert decode_jwt_token(tampered_payload) is None, "Tampered payload rejected"

def test_016_jwt_custom_claims_preservation():
    token = create_jwt_token(DATA, expires_in_seconds=1800)
    decoded = decode_jwt_token(token)
    assert decoded.get("email") == "engineer@enterprise.ai" and decoded.get("role") == "admin", "Custom claims intact"

def test_017_jwt_empty_token_rejection():
    assert decode_jwt_token("") is None, "Empty token returns None"

def test_018_jwt_malformed_token_rejection():
    assert decode_jwt_token("gibberish.not.a.jwt") is None, "Malformed string returns None"

def test_019_jwt_three_segment_format():
    token = create_jwt_token(DATA, expires_in_seconds=1800)
    assert len(token.split(".")) == 3, "Standard 3-segment JWT format"

def test_020_jwt_expiration_time_accuracy():
    delta_seconds = 45 * 60
    now_ts = datetime.now(timezone.utc).timestamp()
    t45 = create_jwt_token(DATA, expires_in_seconds=delta_seconds)
    d45 = decode_jwt_token(t45)
    diff = d45["exp"] - now_ts
    assert abs(diff - delta_seconds) < 15, "Expiration delta accurate to within seconds"
