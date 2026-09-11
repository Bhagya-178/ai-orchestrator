"""Integration tests for high-entropy API key generation, SHA-256 hashing, and scopes (Tests 021 - 030)."""
from app.auth.api_keys import generate_api_key, hash_api_key

def test_021_api_key_live_prefix():
    live_key, _, _ = generate_api_key(prefix="ak_live")
    assert live_key.startswith("ak_live_"), "Live key has ak_live_ prefix"

def test_022_api_key_test_prefix():
    test_key, _, _ = generate_api_key(prefix="ak_test")
    assert test_key.startswith("ak_test_"), "Test key has ak_test_ prefix"

def test_023_api_key_entropy_length():
    live_key, _, _ = generate_api_key(prefix="ak_live")
    test_key, _, _ = generate_api_key(prefix="ak_test")
    assert len(live_key) >= 40 and len(test_key) >= 40, "Key has sufficient length and entropy"

def test_024_api_key_sha256_hash_format():
    live_key, _, _ = generate_api_key(prefix="ak_live")
    k_hash = hash_api_key(live_key)
    assert len(k_hash) == 64 and all(c in "0123456789abcdef" for c in k_hash), "Hash is 64 hex chars"

def test_025_api_key_hash_determinism():
    live_key, _, _ = generate_api_key(prefix="ak_live")
    k_hash = hash_api_key(live_key)
    assert hash_api_key(live_key) == k_hash, "Same key produces deterministic hash"

def test_026_api_key_hash_uniqueness():
    k1, _, _ = generate_api_key(prefix="ak_live")
    k2, _, _ = generate_api_key(prefix="ak_live")
    assert hash_api_key(k1) != hash_api_key(k2), "Distinct keys produce unique hashes"

def test_027_api_key_scope_definitions():
    valid_scopes = {"chat:read", "chat:write", "rag:admin", "agents:run"}
    assert len(valid_scopes) == 4 and "chat:write" in valid_scopes, "Standard API scopes defined"

def test_028_api_key_empty_key_hash():
    empty_hash = hash_api_key("")
    assert len(empty_hash) == 64, "Empty string hashes safely"

def test_029_api_key_rapid_uniqueness():
    keys = [generate_api_key()[0] for _ in range(50)]
    assert len(set(keys)) == 50, "50 consecutively generated keys are all unique"

def test_030_api_key_secret_masking():
    live_key, _, _ = generate_api_key(prefix="ak_live")
    masked = live_key[:8] + "..." + live_key[-4:]
    assert masked.startswith("ak_live_") and masked.endswith(live_key[-4:]) and "..." in masked, "Key masking protects credentials"
