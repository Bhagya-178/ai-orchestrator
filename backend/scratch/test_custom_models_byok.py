"""
Test suite for Dynamic Custom Models & Multi-Provider BYOK Engine.
"""

import asyncio
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database.database import get_session_factory
from app.database.init_db import init_db
from app.database.models import ExternalProviderModel
from app.services.llm_provider import llm_provider, DEFAULT_BASE_URLS
from httpx import AsyncClient, ASGITransport
from app.main import app


async def run_byok_tests():
    print("=== RUNNING BYOK & CUSTOM MODELS INTEGRATION TESTS ===")

    # 1. Initialize DB tables
    await init_db()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Test 1: List custom models initially
        res = await client.get("/api/custom-models")
        assert res.status_code == 200, f"GET /api/custom-models failed: {res.text}"
        initial_models = res.json().get("models", [])
        print(f"[PASS] Initial models count: {len(initial_models)}")

        # Test 2: Create a new custom model (Groq preset simulation)
        create_payload = {
            "name": "Groq Llama 3.3 Test",
            "provider": "groq",
            "model_id": "llama-3.3-70b-versatile",
            "api_key": "gsk_testsecretkey1234567890abcdef",
            "api_base": "https://api.groq.com/openai/v1",
            "is_active": True,
        }
        res = await client.post("/api/custom-models", json=create_payload)
        assert res.status_code == 200, f"POST /api/custom-models failed: {res.text}"
        created = res.json()
        model_id = created["id"]
        assert created["name"] == "Groq Llama 3.3 Test"
        assert created["provider"] == "groq"
        assert created["masked_key"].startswith("gsk_")
        assert "1234567890" not in created["masked_key"], "API key must be masked in response"
        print(f"[PASS] Created custom model {model_id} with masked key: {created['masked_key']}")

        # Test 3: List custom models again and verify it is present
        res = await client.get("/api/custom-models")
        assert res.status_code == 200
        models = res.json().get("models", [])
        assert any(m["id"] == model_id for m in models), "Created model not found in list"
        print("[PASS] Verified custom model appears in /api/custom-models")

        # Test 4: Verify it appears in /models
        res = await client.get("/models")
        assert res.status_code == 200
        all_models = res.json().get("models", [])
        assert any(f"custom:{model_id}" in m for m in all_models), f"Custom model not in /models: {all_models}"
        print("[PASS] Verified custom model appears dynamically in unified /models endpoint")

        # Test 5: Verify it appears in /models/details with rich metadata
        res = await client.get("/models/details")
        assert res.status_code == 200
        details = res.json().get("models", [])
        custom_detail = next((d for d in details if d.get("id") == model_id), None)
        assert custom_detail is not None, "Custom model not found in /models/details"
        assert custom_detail["is_custom"] is True
        assert custom_detail["display_name"] == "Groq Llama 3.3 Test"
        assert custom_detail["provider"] == "groq"
        print("[PASS] Verified custom model has rich metadata in /models/details")

        # Test 6: Update custom model
        update_payload = {
            "name": "Groq Llama 3.3 Production",
            "is_active": True,
        }
        res = await client.put(f"/api/custom-models/{model_id}", json=update_payload)
        assert res.status_code == 200
        updated = res.json()
        assert updated["name"] == "Groq Llama 3.3 Production"
        print("[PASS] Updated custom model display name")

        # Test 7: Test connection error handling (invalid test key expected failure from upstream)
        test_payload = {
            "provider": "groq",
            "model_id": "llama-3.3-70b-versatile",
            "api_key": "invalid_test_key",
        }
        res = await client.post("/api/custom-models/test", json=test_payload)
        assert res.status_code == 200
        test_data = res.json()
        assert "latency_ms" in test_data
        print(f"[PASS] Test connection probe executed in {test_data.get('latency_ms')}ms (success={test_data.get('success')})")

        # Test 8: Clean up by deleting the test model
        res = await client.delete(f"/api/custom-models/{model_id}")
        assert res.status_code == 200
        print("[PASS] Deleted custom model cleanly")

        # Test 9: Verify deletion
        res = await client.get("/api/custom-models")
        models = res.json().get("models", [])
        assert not any(m["id"] == model_id for m in models), "Deleted model still present"
        print("[PASS] Confirmed custom model removed from database")

    print("\n[SUCCESS] ALL CUSTOM MODEL BYOK INTEGRATION TESTS PASSED 100%!")


if __name__ == "__main__":
    asyncio.run(run_byok_tests())
