"""
Automated Security Audit & Leak Prevention Test Suite.

Verifies:
1. GitHub leak prevention (.gitignore rules, no keys committed in code)
2. Browser / Network response safety (no raw keys in JSON responses)
3. Endpoint masking verification (GET /api/custom-models, /models, /models/details)
4. Secret scrubber verification (_scrub_secrets redacts keys in error messages)
"""

import asyncio
import os
import re
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database.init_db import init_db
from app.services.llm_provider import _scrub_secrets
from httpx import AsyncClient, ASGITransport
from app.main import app


async def run_security_audit():
    print("=== STARTING SECURITY & CREDENTIAL LEAK AUDIT ===")

    # -------------------------------------------------------------
    # 1. GITHUB & REPOSITORY LEAK AUDIT
    # -------------------------------------------------------------
    print("\n--- Phase 1: Repository & Gitignore Audit ---")
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    root_gitignore = os.path.join(root_dir, ".gitignore")
    assert os.path.exists(root_gitignore), "Root .gitignore missing!"

    with open(root_gitignore, "r", encoding="utf-8") as f:
        gitignore_content = f.read()

    critical_patterns = [".env", "*.db", "*.sqlite", "*.key", "*.pem", "node_modules", ".next"]
    for pat in critical_patterns:
        assert pat in gitignore_content, f"Critical pattern '{pat}' missing from .gitignore!"
    print("[PASS] Root .gitignore contains all critical secret & database exclusion patterns.")

    # Scan python files in backend/app for accidental hardcoded production API keys
    key_regex = re.compile(r"""(sk-[a-zA-Z0-9]{20,}|gsk_[a-zA-Z0-9]{20,}|AIzaSy[a-zA-Z0-9]{20,})""")
    found_keys = []
    backend_app = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app"))
    for root, _, files in os.walk(backend_app):
        for file in files:
            if file.endswith(".py"):
                fpath = os.path.join(root, file)
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    matches = key_regex.findall(content)
                    if matches:
                        found_keys.append((fpath, matches))

    assert len(found_keys) == 0, f"Found hardcoded keys in backend code: {found_keys}"
    print("[PASS] Scanned backend source code: ZERO hardcoded secrets detected.")

    # -------------------------------------------------------------
    # 2. BROWSER / NETWORK RESPONSE AUDIT
    # -------------------------------------------------------------
    print("\n--- Phase 2: Browser API Response Safety Audit ---")
    await init_db()

    DUMMY_SECRET = "sk-proj-TOPSECRET9876543210ABCDEF_LEAKTEST"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Step A: Create a model with dummy secret
        create_res = await client.post(
            "/api/custom-models",
            json={
                "name": "Audit Safety Model",
                "provider": "openai",
                "model_id": "gpt-4o",
                "api_key": DUMMY_SECRET,
                "api_base": "https://api.openai.com/v1",
                "is_active": True,
            },
        )
        assert create_res.status_code == 200
        created_json = create_res.text
        # Assert raw secret is NOT in POST response
        assert DUMMY_SECRET not in created_json, "SECURITY LEAK: Raw API key returned in POST /api/custom-models response!"
        model_id = create_res.json()["id"]
        masked = create_res.json()["masked_key"]
        assert masked == "sk-p****TEST"
        print(f"[PASS] POST /api/custom-models: secret safely masked as '{masked}', raw key absent.")

        # Step B: Check GET /api/custom-models
        list_res = await client.get("/api/custom-models")
        assert list_res.status_code == 200
        assert DUMMY_SECRET not in list_res.text, "SECURITY LEAK: Raw API key returned in GET /api/custom-models response!"
        print("[PASS] GET /api/custom-models: verified raw key NEVER returned to client.")

        # Step C: Check GET /models
        models_res = await client.get("/models")
        assert models_res.status_code == 200
        assert DUMMY_SECRET not in models_res.text, "SECURITY LEAK: Raw API key returned in /models response!"
        print("[PASS] GET /models: verified clean endpoint, no credentials exposed.")

        # Step D: Check GET /models/details
        details_res = await client.get("/models/details")
        assert details_res.status_code == 200
        assert DUMMY_SECRET not in details_res.text, "SECURITY LEAK: Raw API key returned in /models/details response!"
        print("[PASS] GET /models/details: verified clean endpoint, no credentials exposed.")

        # Step E: Check PUT /api/custom-models/{id}
        put_res = await client.put(
            f"/api/custom-models/{model_id}",
            json={"name": "Renamed Audit Model"}
        )
        assert put_res.status_code == 200
        assert DUMMY_SECRET not in put_res.text, "SECURITY LEAK: Raw API key returned in PUT /api/custom-models response!"
        print("[PASS] PUT /api/custom-models: verified raw key NEVER returned on update.")

        # Step F: Check Test Connection error scrubbing
        test_res = await client.post(
            "/api/custom-models/test",
            json={
                "provider": "openai",
                "model_id": "gpt-4o",
                "saved_model_id": model_id,
            }
        )
        assert test_res.status_code == 200
        assert DUMMY_SECRET not in test_res.text, "SECURITY LEAK: Raw API key returned in /api/custom-models/test response!"
        print("[PASS] POST /api/custom-models/test: verified error/status output does not leak key.")

        # Clean up
        del_res = await client.delete(f"/api/custom-models/{model_id}")
        assert del_res.status_code == 200
        print("[PASS] Cleaned up audit model.")

    # -------------------------------------------------------------
    # 3. SECRET SCRUBBING ENGINE AUDIT
    # -------------------------------------------------------------
    print("\n--- Phase 3: Secret Scrubber Engine Audit ---")
    test_raw_key = "sk-1234567890abcdef12345678"
    msg_with_key = f"Error: connection to https://api.openai.com with key {test_raw_key} failed with 401"
    scrubbed = _scrub_secrets(msg_with_key, test_raw_key)
    assert test_raw_key not in scrubbed, "Scrubber failed to redact active key!"
    assert "[REDACTED" in scrubbed
    print(f"[PASS] _scrub_secrets sanitized input: '{scrubbed}'")

    msg_with_bearer = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThis"
    scrubbed_bearer = _scrub_secrets(msg_with_bearer)
    assert "doNotLeakThis" not in scrubbed_bearer
    print(f"[PASS] _scrub_secrets sanitized Bearer token: '{scrubbed_bearer}'")

    print("\n[SUCCESS] ALL SECURITY & LEAK PREVENTION TESTS PASSED 100%!")


if __name__ == "__main__":
    asyncio.run(run_security_audit())
