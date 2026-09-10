import asyncio
import json
import os
import sys

backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

from app.services.chat_pipeline import chat_pipeline

async def main():
    print("Testing chat_pipeline.stream_chat with multi-loop request...")
    prompt = "Step by step: check the current time using datetime, and calculate 25 * 4 using calculator."
    
    events_received = []
    async for sse_line in chat_pipeline.stream_chat(
        session_id="test-multiloop-session",
        message=prompt,
        db=None,
        use_rag=False,
        intent_override="coding",
        effort_level="high",
    ):
        if sse_line.startswith("data: "):
            payload = sse_line.replace("data: ", "").strip()
            if payload != "[DONE]":
                try:
                    data = json.loads(payload)
                    events_received.append(data)
                    etype = data.get("type")
                    if etype == "thought":
                        print(f"  [STREAM THOUGHT]: {data.get('content')}")
                    elif etype == "tool_start":
                        print(f"  [STREAM TOOL START]: {data.get('tool')} with {data.get('input')}")
                    elif etype == "tool_result":
                        print(f"  [STREAM TOOL RESULT]: {data.get('tool')} -> {data.get('result')[:60]}... ({data.get('elapsed_ms')}ms)")
                    elif etype == "token":
                        print(data.get("token", ""), end="", flush=True)
                    elif etype == "done":
                        print(f"\n  [STREAM DONE]: {data.get('total_steps')} steps, tools: {data.get('tools_used')}")
                except Exception as e:
                    print(f"Parse error: {e}, payload: {payload}")

    print(f"\nTotal SSE events received: {len(events_received)}")
    types = [e.get("type") for e in events_received]
    print(f"Event types present: {set(types)}")
    assert "tool_start" in types or "thought" in types, "Tool steps should be streamed"
    print("\n[SUCCESS] Chat pipeline multi-loop streaming works!")

if __name__ == "__main__":
    asyncio.run(main())
