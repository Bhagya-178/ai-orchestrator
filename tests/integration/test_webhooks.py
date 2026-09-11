"""Integration tests for HMAC-SHA256 webhooks, replay resistance, and signature verification (Tests 031 - 040)."""
import time
from app.services.webhooks import (
    generate_webhook_secret,
    compute_signature,
    verify_signature,
    SUPPORTED_EVENTS,
)

def test_031_webhook_secret_generation():
    secret = generate_webhook_secret()
    assert secret.startswith("whsec_") and len(secret) > 30, "Webhook secret starts with whsec_"

def test_032_webhook_signature_computation():
    secret = generate_webhook_secret()
    payload = b'{"event":"chat.completed"}'
    now_ts = int(time.time())
    sig = compute_signature(secret, payload, now_ts)
    assert sig.startswith(f"t={now_ts},v1=") and len(sig) > 70, "Signature has t=...,v1= format"

def test_033_webhook_signature_verification_success():
    secret = generate_webhook_secret()
    payload = b'{"event":"chat.completed"}'
    now_ts = int(time.time())
    sig = compute_signature(secret, payload, now_ts)
    assert verify_signature(secret, payload, sig) is True, "Valid webhook signature verified"

def test_034_webhook_payload_tampering_detected():
    secret = generate_webhook_secret()
    payload = b'{"event":"chat.completed","tokens":42}'
    tampered = b'{"event":"chat.completed","tokens":43}'
    sig = compute_signature(secret, payload, int(time.time()))
    assert verify_signature(secret, tampered, sig) is False, "Modified payload rejected"

def test_035_webhook_secret_mismatch_detected():
    s1 = generate_webhook_secret()
    s2 = generate_webhook_secret()
    payload = b'{"event":"chat.completed"}'
    sig = compute_signature(s1, payload, int(time.time()))
    assert verify_signature(s2, payload, sig) is False, "Wrong secret rejected"

def test_036_webhook_timestamp_drift_rejection():
    secret = generate_webhook_secret()
    payload = b'{"event":"chat.completed"}'
    old_ts = int(time.time()) - 600
    sig = compute_signature(secret, payload, old_ts)
    assert verify_signature(secret, payload, sig, max_age_seconds=300) is False, "Stale timestamp rejected"

def test_037_webhook_future_timestamp_rejection():
    secret = generate_webhook_secret()
    payload = b'{"event":"chat.completed"}'
    future_ts = int(time.time()) + 600
    sig = compute_signature(secret, payload, future_ts)
    assert verify_signature(secret, payload, sig, max_age_seconds=300) is False, "Future timestamp rejected"

def test_038_webhook_malformed_header_rejection():
    secret = generate_webhook_secret()
    assert verify_signature(secret, b"{}", "invalid_header") is False, "Malformed header rejected safely"

def test_039_webhook_supported_events_list():
    assert "chat.completed" in SUPPORTED_EVENTS and "workflow.completed" in SUPPORTED_EVENTS, "Required event types registered"

def test_040_webhook_empty_payload_signature():
    secret = generate_webhook_secret()
    now_ts = int(time.time())
    sig = compute_signature(secret, b"", now_ts)
    assert verify_signature(secret, b"", sig) is True, "Empty payload signature works"
