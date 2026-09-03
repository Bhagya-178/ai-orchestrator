import asyncio
import httpx
import uuid
from app.main import app
from app.ollama_client import ollama

async def run_tests():
    print("Running Backend Tests via ASGI...")
    await ollama.startup()

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test", timeout=120.0) as client:
        res = await client.get("/health")
        print(f"Health Check: {res.status_code} - {res.json()}")

        session_id = str(uuid.uuid4())
        print(f"\n--- Starting tests for session: {session_id} ---")

        # 1. Simple chat
        print("\n[Test 1] Simple Chat")
        res = await client.post("/chat", json={
            "message": "Hello! What is your name?",
            "session_id": session_id,
            "use_rag": False
        })
        print(res.status_code, res.json())

        # 2. Tool Calling (Deterministic)
        print("\n[Test 2] Tool Calling (Calculator)")
        res = await client.post("/chat", json={
            "message": "What is 45 * 10?",
            "session_id": session_id,
            "use_rag": False
        })
        print(res.status_code, res.json())

        # 3. Intent Override with Tool Call (Should still use tool)
        print("\n[Test 3] Intent Override (Coding) but ask for Math")
        res = await client.post("/chat", json={
            "message": "What is 100 / 25?",
            "session_id": session_id,
            "use_rag": False,
            "intent_override": "coding"
        })
        print(res.status_code, res.json())

        # 4. Vulnerability Test 1: Massive Payload
        print("\n[Test 4] Massive Message Payload")
        res = await client.post("/chat", json={
            "message": "A" * 30000,
            "session_id": session_id,
            "use_rag": False
        })
        print(res.status_code, "Payload handled without crashing. Return:", str(res.json())[:100] + '...')

        # 5. Intent Override to general
        print("\n[Test 5] Intent Override (General) no tools")
        res = await client.post("/chat", json={
            "message": "Write a tiny poem.",
            "session_id": session_id,
            "use_rag": False,
            "intent_override": "general",
            "effort_level": "low"
        })
        print(res.status_code, res.json())
        
    await ollama.shutdown()
    print("\nAll tests completed.")

if __name__ == "__main__":
    asyncio.run(run_tests())
