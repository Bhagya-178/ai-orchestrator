import asyncio
import sys
import os

backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

from app.tools.agent_loop import react_agent

async def main():
    print("================================================================================")
    print("Testing ReAct Multi-Loop with Sequential Tools (datetime -> calculator)")
    print("================================================================================")
    
    question = (
        "Perform these two actions step by step:\n"
        "1. First, use the datetime tool to check the current date and time.\n"
        "2. Second, use the calculator tool to calculate 1234 * 5.\n"
        "3. Provide the final answer with both results."
    )
    model = "qwen2.5:1.5b"
    
    print(f"Model: {model}")
    print(f"Prompt:\n{question}\n")
    
    events = []
    tools_called = []
    
    async for event in react_agent.run_stream(question=question, model=model):
        events.append(event)
        etype = event.get("type")
        if etype == "thought":
            print(f"[THOUGHT]: {event.get('content')}")
        elif etype == "tool_start":
            tool_name = event.get('tool')
            tools_called.append(tool_name)
            print(f"[TOOL START - Loop {event.get('iteration')}]: {tool_name} with {event.get('input')}")
        elif etype == "tool_result":
            print(f"[TOOL RESULT - {event.get('tool')}]: {event.get('result')[:120]}... ({event.get('elapsed_ms')}ms)")
        elif etype == "token":
            print(f"{event.get('content')}", end="", flush=True)
        elif etype == "done":
            print(f"\n[DONE]: Completed in {event.get('total_steps')} iterations. Tools called: {event.get('tools_used')}")

    print(f"\nSummary: {len(events)} events emitted, {len(tools_called)} tool calls made: {tools_called}")
    assert len(tools_called) >= 1, "At least one tool should have been called"
    print("\n[SUCCESS] ReAct multi-loop sequential test completed successfully!")

if __name__ == "__main__":
    asyncio.run(main())
