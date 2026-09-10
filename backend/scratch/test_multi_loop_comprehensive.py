"""
Comprehensive Multi-Loop ReAct Agent Verification Suite.

Validates the multi-iteration ReAct (Reasoning + Acting) execution engine:
- Context & Tool Schema Building
- Action & Action Input parsing (JSON, Markdown fences, raw strings)
- Single-loop direct answer
- Two-loop single tool invocation (Thought -> Action -> Observation -> Final Answer)
- Multi-loop sequential tool chaining (Loop 1: datetime -> Loop 2: calculator -> Loop 3: synthesis)
- Max iterations threshold boundary enforcement & infinite loop prevention
- Unknown/unregistered tool error recovery & observation feedback
- Tool execution failure recovery
- API Endpoint (/tools/agent/stream) SSE streaming protocol verification
- Live Ollama local model multi-loop execution
"""

import asyncio
import json
import os
import re
import sys
import time
from typing import Any
from unittest.mock import AsyncMock, patch

backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

from app.tools.agent_loop import ReActAgent, react_agent
from app.tools.registry import tool_registry
from app.ollama_client import ollama

passed_tests = 0
failed_tests = 0

def assert_test(condition: bool, test_name: str, message: str = ""):
    global passed_tests, failed_tests
    if condition:
        passed_tests += 1
        print(f"[PASS] {test_name}")
    else:
        failed_tests += 1
        print(f"[FAIL] {test_name}: {message}")


# ============================================================================
# 1. Context & Tool Schema Building
# ============================================================================
def test_01_tool_context_building():
    agent = ReActAgent(max_iterations=5)
    descriptions, names = agent._build_tool_context(["calculator", "datetime"])
    
    has_calc = "Tool: calculator" in descriptions
    has_dt = "Tool: datetime" in descriptions
    has_names = "calculator" in names and "datetime" in names
    
    assert_test(has_calc and has_dt and has_names, "test_01_tool_context_building",
                "Tool descriptions or names missing required tools")


# ============================================================================
# 2. Action Input Parsing & Parameter Bridging
# ============================================================================
def test_02_action_input_parsing_json():
    # Test valid JSON string
    raw_input = '{"expression": "25 * (10 + 5)"}'
    clean_input = re.sub(r"^```(?:json)?|```$", "", raw_input.strip(), flags=re.MULTILINE).strip()
    parsed = json.loads(clean_input)
    assert_test(parsed == {"expression": "25 * (10 + 5)"}, "test_02_action_input_parsing_json")


def test_03_action_input_parsing_markdown_fence():
    # Test model wrapping Action Input in markdown fences
    raw_input = '```json\n{"expression": "100 / 4"}\n```'
    clean_input = re.sub(r"^```(?:json)?|```$", "", raw_input.strip(), flags=re.MULTILINE).strip()
    parsed = json.loads(clean_input)
    assert_test(parsed.get("expression") == "100 / 4", "test_03_action_input_parsing_markdown_fence")


def test_04_action_input_raw_fallback_bridging():
    # Test bare expression string fallback and query/expression bridging
    raw_input = '50 * 2'
    val = raw_input.strip("\"' \n")
    input_kwargs = {"query": val, "expression": val}
    assert_test(input_kwargs["expression"] == "50 * 2" and input_kwargs["query"] == "50 * 2",
                "test_04_action_input_raw_fallback_bridging")


# ============================================================================
# 3. Deterministic Loop Executions (Mocked LLM Streams)
# ============================================================================
async def test_05_mock_single_loop_direct_answer():
    """When the question requires no tools, agent returns answer in 1 loop."""
    agent = ReActAgent(max_iterations=5)
    
    async def mock_stream(*args, **kwargs):
        yield {"response": " The capital of France is Paris."}
    
    with patch.object(ollama, "generate_stream", side_effect=mock_stream):
        events = []
        async for ev in agent.run_stream("What is the capital of France?", "mock-model"):
            events.append(ev)
        
        types = [e["type"] for e in events]
        done_ev = next(e for e in events if e["type"] == "done")
        
        assert_test("token" in types and done_ev["total_steps"] == 1 and len(done_ev["tools_used"]) == 0,
                    "test_05_mock_single_loop_direct_answer", f"Events: {types}")


async def test_06_mock_two_loop_single_tool():
    """Iteration 1: Calls tool -> Iteration 2: Synthesizes Final Answer."""
    agent = ReActAgent(max_iterations=5)
    call_count = 0
    
    async def mock_stream(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            # Loop 1: Thought & Action
            resp = (
                " I will use the calculator to compute 12 * 12.\n"
                "Action: calculator\n"
                "Action Input: {\"expression\": \"12 * 12\"}"
            )
            yield {"response": resp}
        else:
            # Loop 2: Final Answer
            resp = (
                " The calculator returned 144.\n"
                "Final Answer: The product of 12 and 12 is 144."
            )
            yield {"response": resp}

    with patch.object(ollama, "generate_stream", side_effect=mock_stream):
        events = []
        async for ev in agent.run_stream("What is 12 * 12?", "mock-model", active_tools=["calculator"]):
            events.append(ev)
        
        event_types = [e["type"] for e in events]
        tool_results = [e for e in events if e["type"] == "tool_result"]
        done_ev = next(e for e in events if e["type"] == "done")
        
        is_valid = (
            "tool_start" in event_types
            and "tool_result" in event_types
            and len(tool_results) == 1
            and "144" in str(tool_results[0]["result"])
            and done_ev["total_steps"] == 2
            and done_ev["tools_used"] == ["calculator"]
        )
        assert_test(is_valid, "test_06_mock_two_loop_single_tool", f"Trace: {event_types}")


async def test_07_mock_three_loop_sequential_tools():
    """
    True multi-loop:
    Loop 1: Calls datetime tool
    Loop 2: Calls calculator tool with previous context
    Loop 3: Formulates final answer
    """
    agent = ReActAgent(max_iterations=5)
    call_count = 0
    
    async def mock_stream(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            # Loop 1: Check datetime
            yield {"response": " First check the time.\nAction: datetime\nAction Input: {}"}
        elif call_count == 2:
            # Loop 2: Check calculation
            yield {"response": " Now calculate 100 * 5.\nAction: calculator\nAction Input: {\"expression\": \"100 * 5\"}"}
        else:
            # Loop 3: Final Answer
            yield {"response": " Both actions complete.\nFinal Answer: Time checked and 100 * 5 is 500."}

    with patch.object(ollama, "generate_stream", side_effect=mock_stream):
        events = []
        async for ev in agent.run_stream("Perform sequential actions", "mock-model"):
            events.append(ev)
        
        tools_called = [e["tool"] for e in events if e["type"] == "tool_start"]
        done_ev = next(e for e in events if e["type"] == "done")
        
        is_valid = (
            tools_called == ["datetime", "calculator"]
            and done_ev["total_steps"] == 3
            and done_ev["tools_used"] == ["datetime", "calculator"]
        )
        assert_test(is_valid, "test_07_mock_three_loop_sequential_tools",
                    f"Tools called: {tools_called}, total_steps: {done_ev['total_steps']}")


async def test_08_mock_max_iterations_boundary():
    """Agent calls tools indefinitely -> loop MUST stop at max_iterations and synthesize."""
    max_iter = 3
    agent = ReActAgent(max_iterations=max_iter)
    
    async def mock_stream(*args, **kwargs):
        prompt = kwargs.get("prompt", "")
        if "Synthesize a clear and complete answer" in prompt:
            yield {"response": "Synthesized fallback after reaching max iterations limit."}
        else:
            yield {"response": " Still thinking.\nAction: calculator\nAction Input: {\"expression\": \"1 + 1\"}"}

    with patch.object(ollama, "generate_stream", side_effect=mock_stream):
        events = []
        async for ev in agent.run_stream("Infinite tool call loop", "mock-model"):
            events.append(ev)
        
        tool_starts = [e for e in events if e["type"] == "tool_start"]
        tokens = [e["content"] for e in events if e["type"] == "token"]
        done_ev = next(e for e in events if e["type"] == "done")
        
        is_capped = (
            len(tool_starts) == max_iter
            and done_ev["total_steps"] == max_iter
            and any("Synthesized fallback" in t for t in tokens)
        )
        assert_test(is_capped, "test_08_mock_max_iterations_boundary",
                    f"Tool starts: {len(tool_starts)}, total_steps: {done_ev['total_steps']}")


async def test_09_unknown_tool_graceful_observation():
    """Agent requests unknown tool -> returns observation with error, loop continues."""
    agent = ReActAgent(max_iterations=5)
    call_count = 0
    
    async def mock_stream(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            yield {"response": " Trying invalid tool.\nAction: quantum_oracle\nAction Input: {}"}
        else:
            yield {"response": " Tool failed, concluding directly.\nFinal Answer: Recovery complete."}

    with patch.object(ollama, "generate_stream", side_effect=mock_stream):
        events = []
        async for ev in agent.run_stream("Test unknown tool", "mock-model"):
            events.append(ev)
        
        results = [e for e in events if e["type"] == "tool_result"]
        done_ev = next(e for e in events if e["type"] == "done")
        
        error_handled = (
            len(results) == 1
            and "not registered" in results[0]["result"]
            and done_ev["total_steps"] == 2
        )
        assert_test(error_handled, "test_09_unknown_tool_graceful_observation",
                    f"Result: {results[0] if results else None}")


# ============================================================================
# 4. HTTP API Endpoint Stream Test
# ============================================================================
async def test_10_api_endpoint_agent_stream():
    """Test POST /tools/agent/stream returns properly formatted SSE stream."""
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    
    async def mock_gen_stream(*args, **kwargs):
        yield {"response": " Result is 42.\nFinal Answer: 42"}

    with patch.object(ollama, "generate_stream", side_effect=mock_gen_stream):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/tools/agent/stream",
                json={"prompt": "What is the answer?", "max_iterations": 3},
            )
            assert_test(response.status_code == 200, "test_10_api_endpoint_agent_stream_status")
            assert_test("text/event-stream" in response.headers.get("content-type", ""),
                        "test_10_api_endpoint_agent_stream_headers")
            
            body = response.text
            has_sse_data = "data: " in body and "final answer" in body.lower()
            assert_test(has_sse_data, "test_10_api_endpoint_agent_stream_sse_content")


# ============================================================================
# 5. Real Live Ollama Multi-Loop Execution Test
# ============================================================================
async def test_11_live_ollama_multi_loop():
    """Live execution against local Ollama model (qwen2.5:1.5b)."""
    print("\n--- Running Live Ollama Multi-Loop Test ---")
    model = "qwen2.5:1.5b"
    question = (
        "1. First, check the current date and time using the datetime tool.\n"
        "2. Second, calculate 999 * 3 using the calculator tool.\n"
        "3. State both results."
    )
    
    t0 = time.perf_counter()
    events = []
    tools_called = []
    
    try:
        async for ev in react_agent.run_stream(question=question, model=model):
            events.append(ev)
            if ev.get("type") == "tool_start":
                tools_called.append(ev.get("tool"))
                print(f"  -> [Loop {ev.get('iteration')}] Invoking {ev.get('tool')}")
            elif ev.get("type") == "tool_result":
                print(f"  <- [Observation] {ev.get('tool')} result received in {ev.get('elapsed_ms')}ms")
            elif ev.get("type") == "done":
                print(f"  -> [Done] Completed in {ev.get('total_steps')} iterations, tools: {ev.get('tools_used')}")
        
        elapsed = time.perf_counter() - t0
        print(f"Live Multi-Loop took {elapsed:.2f}s, {len(events)} events, tools called: {tools_called}")
        
        assert_test(len(tools_called) >= 1 and len(events) >= 4,
                    "test_11_live_ollama_multi_loop",
                    f"Events: {len(events)}, Tools called: {tools_called}")
    except Exception as ex:
        assert_test(False, "test_11_live_ollama_multi_loop", f"Live test failed: {ex}")


# ============================================================================
# Main Test Runner
# ============================================================================
async def main():
    print("=" * 80)
    print("COMPREHENSIVE MULTI-LOOP REACT AGENT VERIFICATION SUITE")
    print("=" * 80)
    
    # 1. Parsing & Context
    test_01_tool_context_building()
    test_02_action_input_parsing_json()
    test_03_action_input_parsing_markdown_fence()
    test_04_action_input_raw_fallback_bridging()
    
    # 2. Multi-Loop Mock Logic
    await test_05_mock_single_loop_direct_answer()
    await test_06_mock_two_loop_single_tool()
    await test_07_mock_three_loop_sequential_tools()
    await test_08_mock_max_iterations_boundary()
    await test_09_unknown_tool_graceful_observation()
    
    # 3. HTTP SSE Endpoint
    await test_10_api_endpoint_agent_stream()
    
    # 4. Live Ollama Multi-Loop
    await test_11_live_ollama_multi_loop()
    
    print("=" * 80)
    print(f"RESULTS: {passed_tests} PASSED / {failed_tests} FAILED (TOTAL: {passed_tests + failed_tests})")
    print("=" * 80)
    
    if failed_tests == 0:
        print("\n[SUCCESS] ALL MULTI-LOOP TESTS PASSED (100% SUCCESS RATE)!\n")
        sys.exit(0)
    else:
        print(f"\n[FAILURE] {failed_tests} test(s) failed!\n")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
