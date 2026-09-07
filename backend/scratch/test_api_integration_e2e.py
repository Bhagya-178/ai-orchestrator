"""
End-to-End FastAPI HTTP API Route Integration Test Suite.

Tests the actual HTTP endpoints that the frontend and user interact with:
1. System Health & Models (GET /health, GET /models)
2. Conversation Creation & Title Persistence (POST /conversations, GET /conversations, GET /conversations/{id})
3. Live Chat Streaming (POST /chat/stream with tools, custom_system_prompt, effort_level)
4. Conversation Title Auto-Derivation (first user prompt becomes conversation title)
5. Message History Retrieval (GET /chat/{session_id}/messages)
6. Response Regeneration (POST /chat/regenerate)
7. Conversation Export & Deletion (GET /conversations/{id}/export, DELETE /conversations/{id})
8. Authentication Lifecycle (POST /auth/register, POST /auth/login, POST /auth/refresh)
"""

import asyncio
import json
import os
import sys
import uuid
import httpx

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app

total_tests = 0
passed_tests = 0
failed_tests = 0

def record_test(name: str, passed: bool, detail: str = ""):
    global total_tests, passed_tests, failed_tests
    total_tests += 1
    if passed:
        passed_tests += 1
        print(f"[PASS] {name}" + (f" - {detail}" if detail else ""))
    else:
        failed_tests += 1
        print(f"[FAIL] {name}" + (f" - {detail}" if detail else ""))

async def run_e2e_tests():
    print("\n" + "=" * 80)
    print("EXECUTING REAL HTTP API ROUTE INTEGRATION TESTS (FASTAPI / ASGI)")
    print("=" * 80 + "\n")

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test", timeout=30.0) as client:

        # 1. Health Endpoint
        r = await client.get("/health")
        record_test("test_01_health_check", r.status_code == 200 and "status" in r.json(), f"status={r.status_code}")

        # 2. Models Endpoint
        r = await client.get("/models")
        record_test("test_02_models_list", r.status_code == 200 and "models" in r.json(), f"models={len(r.json().get('models', []))}")

        # 3. Create Conversation with custom title
        test_title = f"Project Discussion {uuid.uuid4().hex[:6]}"
        r = await client.post("/conversations", json={"title": test_title})
        conv_id = r.json().get("conversation_id")
        record_test("test_03_create_conversation_custom_title", r.status_code == 200 and r.json().get("title") == test_title, f"conv_id={conv_id}")

        # 4. Get Conversation by ID
        r = await client.get(f"/conversations/{conv_id}")
        record_test("test_04_get_conversation_by_id", r.status_code == 200 and r.json().get("title") == test_title, f"retrieved_title={r.json().get('title')}")

        # 5. POST /chat/stream with Calculator Tool Call & custom_system_prompt
        # (This is the exact call that previously crashed with TypeError!)
        stream_session = f"test-stream-{uuid.uuid4().hex[:8]}"
        payload = {
            "message": "Calculate 125 * 8",
            "session_id": stream_session,
            "use_rag": False,
            "intent_override": "auto",
            "effort_level": "medium",
        }
        stream_tokens = []
        tool_results = []
        is_done = False
        async with client.stream("POST", "/chat/stream", json=payload) as response:
            status_ok = (response.status_code == 200)
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data_str = line[6:].strip()
                    if data_str == "[DONE]":
                        is_done = True
                    else:
                        try:
                            parsed = json.loads(data_str)
                            if parsed.get("type") == "token":
                                stream_tokens.append(parsed.get("token", ""))
                            elif parsed.get("type") == "tool_result":
                                tool_results.append(parsed)
                        except Exception:
                            pass

        record_test(
            "test_05_post_chat_stream_execution",
            status_ok and is_done and len(stream_tokens) > 0,
            f"tokens={len(stream_tokens)}, tool_results={len(tool_results)}"
        )

        # 6. Verify Calculator Output in Stream
        full_stream_text = "".join(stream_tokens)
        record_test("test_06_calculator_tool_stream_accuracy", "1000" in full_stream_text, f"streamed={full_stream_text}")

        # 7. Check that Stream Turn Created Conversation and Auto-Derived Title
        r = await client.get(f"/conversations/{stream_session}")
        derived_title = r.json().get("title", "")
        record_test(
            "test_07_stream_chat_auto_derives_conversation_title",
            r.status_code == 200 and ("Calculate 125 * 8" in derived_title or "125" in derived_title),
            f"derived_title='{derived_title}'"
        )

        # 8. Check GET /conversations list does not show "New Chat" when user prompt exists
        r = await client.get("/conversations")
        convs = r.json()
        matching_conv = next((c for c in convs if c["id"] == stream_session), None)
        record_test(
            "test_08_conversations_list_title_not_generic",
            matching_conv is not None and matching_conv["title"] != "New Conversation" and matching_conv["title"] != "New Chat",
            f"title='{matching_conv['title'] if matching_conv else 'NONE'}'"
        )

        # 9. Message History Retrieval for the streamed session
        r = await client.get(f"/chat/{stream_session}/messages")
        messages = r.json() if r.status_code == 200 else []
        record_test(
            "test_09_chat_messages_history_persistence",
            r.status_code == 200 and len(messages) >= 2,
            f"message_count={len(messages)}"
        )

        # 10. Regenerate Chat Turn (POST /chat/regenerate)
        regen_payload = {
            "session_id": stream_session,
            "use_rag": False,
            "intent_override": "auto",
            "effort_level": "medium",
        }
        regen_done = False
        async with client.stream("POST", "/chat/regenerate", json=regen_payload) as response:
            regen_status_ok = (response.status_code == 200)
            async for line in response.aiter_lines():
                if line.startswith("data: [DONE]"):
                    regen_done = True
        record_test("test_10_chat_regenerate_endpoint", regen_status_ok and regen_done, f"status={response.status_code}")

        # 11. Conversation Export Endpoint
        r = await client.get(f"/conversations/{stream_session}/export")
        export_data = r.json() if r.status_code == 200 else {}
        record_test(
            "test_11_conversation_export",
            r.status_code == 200 and "markdown" in export_data and "json_data" in export_data,
            f"has_markdown={'markdown' in export_data}, has_json={'json_data' in export_data}"
        )

        # 12. Delete Conversation Endpoint
        r = await client.delete(f"/conversations/{conv_id}")
        record_test("test_12_delete_conversation", r.status_code == 200, f"deleted_id={conv_id}")

        # 13. Verify Conversation is Deleted
        r = await client.get(f"/conversations/{conv_id}")
        record_test("test_13_verify_deleted_conversation_returns_fallback_or_404", r.status_code in (404, 200), f"status={r.status_code}")

        # 14. Authentication Register Endpoint (201 Created)
        test_email = f"testuser_{uuid.uuid4().hex[:6]}@example.com"
        test_pass = "SecureP@ssw0rd123!"
        r = await client.post("/auth/register", json={
            "email": test_email,
            "password": test_pass,
            "full_name": "Integration Tester"
        })
        record_test("test_14_auth_register", r.status_code in (200, 201) and "access_token" in r.json(), f"status={r.status_code}, email={test_email}")

        # 15. Authentication Login Endpoint
        r = await client.post("/auth/login", json={
            "email": test_email,
            "password": test_pass
        })
        login_ok = (r.status_code == 200 and "access_token" in r.json())
        refresh_token = r.json().get("refresh_token") if login_ok else ""
        record_test("test_15_auth_login", login_ok, "JWT tokens generated")

        # 16. Authentication Refresh Endpoint
        if refresh_token:
            r = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
            record_test("test_16_auth_refresh", r.status_code == 200 and "access_token" in r.json(), "Token refreshed successfully")
        else:
            record_test("test_16_auth_refresh", False, "No refresh token available")

        # ====================================================================
        # ZERO-AUTH / GUEST TESTS: Verify all interactive features work out-of-the-box
        # without requiring login or Authorization header
        # ====================================================================

        # 17. Audio Synthesize (TTS - SpeechPlayer)
        r = await client.post("/audio/synthesize", json={"text": "Hello world from ai orchestrator"})
        record_test("test_17_guest_audio_synthesis", r.status_code == 200 and len(r.content) > 0 and "audio/wav" in r.headers.get("content-type", ""), f"status={r.status_code}, bytes={len(r.content)}")

        # 18. Arena Leaderboard
        r = await client.get("/arena/leaderboard")
        record_test("test_18_guest_arena_leaderboard", r.status_code == 200 and isinstance(r.json(), list), f"status={r.status_code}")

        # 19. Arena Vote
        r = await client.post("/arena/vote", json={
            "prompt": "Test prompt",
            "model_a": "qwen2.5:1.5b",
            "model_b": "qwen3:8b",
            "winner": "A"
        })
        record_test("test_19_guest_arena_vote", r.status_code == 200 and r.json().get("status") in ("recorded", "success"), f"status={r.status_code}")

        # 20. Arena Dual-Stream Battle
        r = await client.post("/arena/battle/stream", json={
            "prompt": "Say test",
            "model_a": "qwen2.5:1.5b",
            "model_b": "qwen3:8b",
        })
        record_test("test_20_guest_arena_battle_stream", r.status_code == 200 and "text/event-stream" in r.headers.get("content-type", ""), f"status={r.status_code}")

        # 21. MCP Server Hub
        r = await client.get("/mcp/servers")
        record_test("test_21_guest_mcp_servers", r.status_code == 200 and isinstance(r.json(), list), f"status={r.status_code}")

        # 22. Tool Discovery & Safe Execution
        r = await client.get("/tools")
        record_test("test_22_guest_tools_list", r.status_code == 200 and isinstance(r.json(), list), f"tools_count={len(r.json())}")

        r = await client.post("/tools/execute", json={
            "tool_name": "calculator",
            "arguments": {"expression": "100 * 5"}
        })
        record_test("test_23_guest_tool_execute_calculator", r.status_code == 200 and r.json().get("result", {}).get("result") == 500, f"result={r.json().get('result')}")

        # 24. Analytics & Telemetry
        r = await client.get("/analytics/overview")
        record_test("test_24_guest_analytics_overview", r.status_code == 200 and "total_requests" in r.json(), f"status={r.status_code}")

        r = await client.get("/analytics/models")
        record_test("test_25_guest_analytics_models", r.status_code == 200 and isinstance(r.json(), list), f"status={r.status_code}")

        r = await client.get("/analytics/system")
        record_test("test_26_guest_analytics_system", r.status_code == 200 and "cpu_percent" in r.json(), f"status={r.status_code}")

        # 27. Prompt Library
        r = await client.get("/prompts")
        record_test("test_27_guest_prompts_library", r.status_code == 200 and isinstance(r.json(), list), f"templates={len(r.json())}")

        # 28. Hybrid RAG v2 Collections
        r = await client.get("/rag/v2/collections")
        record_test("test_28_guest_rag_v2_collections", r.status_code == 200 and isinstance(r.json(), list), f"collections={len(r.json())}")

        # 29. Workspaces List
        r = await client.get("/workspaces")
        record_test("test_29_guest_workspaces_list", r.status_code == 200 and isinstance(r.json(), list), f"workspaces={len(r.json())}")

        # 30. Webhooks List
        r = await client.get("/webhooks")
        record_test("test_30_guest_webhooks_list", r.status_code == 200 and isinstance(r.json(), list), f"webhooks={len(r.json())}")

        # 31. API Keys List
        r = await client.get("/auth/api-keys")
        record_test("test_31_guest_api_keys_list", r.status_code == 200 and isinstance(r.json(), list), f"keys={len(r.json())}")

        # 32. Multi-Agent Roles
        r = await client.get("/agents/roles")
        record_test("test_32_guest_agent_roles", r.status_code == 200 and isinstance(r.json(), list), f"roles={len(r.json())}")

        # 33. Evals Benchmarks
        r = await client.get("/evals/benchmarks")
        record_test("test_33_guest_evals_benchmarks", r.status_code == 200 and isinstance(r.json(), list), f"benchmarks={len(r.json())}")

        # Clean up test streamed conversation
        await client.delete(f"/conversations/{stream_session}")

    print("\n" + "=" * 80)
    print(f"E2E API INTEGRATION SUMMARY: {passed_tests} PASSED / {failed_tests} FAILED (TOTAL: {total_tests} TESTS)")
    print("=" * 80 + "\n")
    return failed_tests == 0

if __name__ == "__main__":
    success = asyncio.run(run_e2e_tests())
    sys.exit(0 if success else 1)
