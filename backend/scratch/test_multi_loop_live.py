import asyncio
import sys
import os

backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

from app.tools.agent_loop import react_agent

async def main():
    print("Testing ReAct multi-loop with Ollama...")
    question = "What is 15 * 8? Then divide that result by 3. Use the calculator tool."
    model = "qwen2.5:1.5b"
    
    print(f"Question: {question}")
    print(f"Model: {model}\n")
    
    event_count = 0
    tools_used = []
    async for event in react_agent.run_stream(question=question, model=model):
        event_count += 1
        etype = event.get("type")
        if etype == "thought":
            print(f"[THOUGHT]: {event.get('content')}")
        elif etype == "tool_start":
            print(f"[TOOL START]: {event.get('tool')} with input {event.get('input')} (Iteration {event.get('iteration')})")
        elif etype == "tool_result":
            print(f"[TOOL RESULT]: {event.get('tool')} -> {event.get('result')} ({event.get('elapsed_ms')}ms)")
        elif etype == "token":
            print(f"[TOKEN]: {event.get('content')}", end="", flush=True)
        elif etype == "done":
            print(f"\n[DONE]: Total steps={event.get('total_steps')}, Tools used={event.get('tools_used')}")
            tools_used = event.get('tools_used', [])

    print(f"\nTotal events emitted: {event_count}")
    print(f"Tools used: {tools_used}")

if __name__ == "__main__":
    asyncio.run(main())
