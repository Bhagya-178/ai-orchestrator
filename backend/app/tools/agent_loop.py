"""
ReAct (Reasoning + Acting) Agent Execution Engine.
Iteratively plans, selects tools, evaluates observations, and synthesizes final answers.
Supports multi-step reasoning with streaming step-by-step telemetry for frontend visualization.
"""

import json
import logging
import re
import time
from collections.abc import AsyncGenerator
from typing import Any

from app.ollama_client import ollama
from app.tools.registry import tool_registry

logger = logging.getLogger(__name__)

REACT_PROMPT_TEMPLATE = """You are an expert autonomous AI agent equipped with external tools.
To solve complex questions or perform actions, you can reason step by step and invoke available tools.

You have access to the following tools:
{tool_descriptions}

IMPORTANT INSTRUCTIONS:
- If the question can be answered using your existing knowledge (such as explaining concepts, theory, definitions, or writing code), DO NOT invoke any tool! Immediately output:
Thought: I now know the final answer
Final Answer: [your full, detailed response to the user]
- Only invoke a tool if you genuinely need external execution or computation that requires one of [{tool_names}]. Never output placeholder tool names like "tool".

Use the following format strictly:

Question: the input question you must answer
Thought: consider what step you should take next
Action: the name of the tool to use, exactly one of [{tool_names}]
Action Input: a valid JSON object representing the keyword arguments for the tool
Observation: the result of the tool action
... (this Thought/Action/Action Input/Observation cycle can repeat up to {max_iterations} times)
Thought: I now know the final answer
Final Answer: the comprehensive final response to the user

Begin!
Question: {question}
"""


EFFORT_ITERATIONS = {
    "low": 2,
    "medium": 5,
    "high": 10,
}

EFFORT_TEMPERATURE = {
    "low": 0.1,
    "medium": 0.2,
    "high": 0.3,
}


class ReActAgent:
    """Production-grade ReAct agent planner and execution supervisor."""

    def __init__(self, max_iterations: int = 5):
        self.max_iterations = max_iterations

    def _build_tool_context(self, active_tool_names: list[str] | None = None) -> tuple[str, str]:
        """Format descriptions and names of available tools."""
        descriptions = []
        names = []

        all_names = active_tool_names or tool_registry.list_tools()
        for name in all_names:
            tool = tool_registry.get(name)
            if tool:
                schema_json = json.dumps(tool.parameters_schema.get("properties", {}), indent=2)
                descriptions.append(
                    f"Tool: {tool.name}\n"
                    f"Description: {tool.description}\n"
                    f"Parameters Schema:\n{schema_json}\n"
                )
                names.append(tool.name)

        return "\n".join(descriptions), ", ".join(names)

    async def run_stream(
        self,
        question: str,
        model: str,
        active_tools: list[str] | None = None,
        effort_level: str = "medium",
    ) -> AsyncGenerator[dict[str, Any], None]:
        """
        Execute the multi-step ReAct agent loop, yielding real-time execution steps.

        Yields events:
            - {"type": "thought", "content": str}
            - {"type": "tool_start", "tool": str, "input": dict, "iteration": int}
            - {"type": "tool_result", "tool": str, "result": Any, "elapsed_ms": float}
            - {"type": "token", "content": str}
            - {"type": "done", "total_steps": int, "tools_used": list[str]}
        """
        tool_descriptions, tool_names = self._build_tool_context(active_tools)
        scratchpad = ""
        tools_used = []
        iteration = 0

        clean_effort = effort_level.lower() if effort_level else "medium"
        max_iters = EFFORT_ITERATIONS.get(clean_effort, self.max_iterations)
        temperature = EFFORT_TEMPERATURE.get(clean_effort, 0.2)

        logger.info(f"Starting ReAct loop ({clean_effort} effort, {max_iters} iters) for model '{model}' with tools [{tool_names}]")

        yield {
            "type": "thought",
            "content": f"ReAct agent initialized ({clean_effort.capitalize()} Effort: {max_iters} max tool iterations).",
        }

        while iteration < max_iters:
            iteration += 1

            prompt = (
                f"{REACT_PROMPT_TEMPLATE.format(tool_descriptions=tool_descriptions, tool_names=tool_names, max_iterations=max_iters, question=question)}"
                f"{scratchpad}\nThought:"
            )

            response_text = ""
            async for chunk in ollama.generate_stream(
                model=model,
                prompt=prompt,
                options={"temperature": temperature, "stop": ["\nObservation:"]},
            ):
                token = chunk.get("response", "")
                response_text += token

            step_text = f"Thought:{response_text}"
            scratchpad += f"\n{step_text.strip()}"

            # Check if Final Answer reached
            if "Final Answer:" in step_text:
                final_answer = step_text.split("Final Answer:", 1)[1].strip()
                yield {"type": "thought", "content": "Synthesized final answer."}
                # Stream the final answer tokens
                yield {"type": "token", "content": final_answer}
                yield {"type": "done", "total_steps": iteration, "tools_used": tools_used}
                return

            # Parse Action and Action Input
            action_match = re.search(r"Action:\s*([a-zA-Z0-9_\-]+)", step_text)
            action_input_match = re.search(r"Action Input:\s*(\{.*\}|\[.*\]|.+)", step_text, re.DOTALL)

            if not action_match:
                # No clear tool action detected; treat as direct response
                clean_text = step_text.replace("Thought:", "").strip()
                yield {"type": "token", "content": clean_text}
                yield {"type": "done", "total_steps": iteration, "tools_used": tools_used}
                return

            tool_name = action_match.group(1).strip()
            # If the LLM output a generic placeholder like "tool" or an unknown tool name,
            # don't emit a bogus tool call or waste time looping. Treat the answer directly.
            if tool_name.lower() in ("tool", "none", "null", "undefined") or not tool_registry.get(tool_name):
                clean_text = step_text.replace("Thought:", "").split("Action:")[0].strip()
                if not clean_text:
                    clean_text = response_text.replace("Thought:", "").strip()
                if clean_text:
                    yield {"type": "token", "content": clean_text}
                yield {"type": "done", "total_steps": iteration, "tools_used": tools_used}
                return

            raw_input = action_input_match.group(1).strip() if action_input_match else "{}"

            # Parse input kwargs
            clean_input = re.sub(r"^```(?:json)?|```$", "", raw_input.strip(), flags=re.MULTILINE).strip()
            input_kwargs = {}
            try:
                parsed = json.loads(clean_input)
                if isinstance(parsed, dict):
                    input_kwargs = parsed
                else:
                    input_kwargs = {"query": str(parsed), "expression": str(parsed)}
            except Exception:
                json_match = re.search(r"(\{.*\})", clean_input, re.DOTALL)
                if json_match:
                    try:
                        input_kwargs = json.loads(json_match.group(1))
                    except Exception:
                        pass
                if not input_kwargs:
                    val = clean_input.strip("\"' \n")
                    input_kwargs = {"query": val, "expression": val}

            # Bridge expression and query parameters if missing
            if "query" in input_kwargs and "expression" not in input_kwargs:
                input_kwargs["expression"] = input_kwargs["query"]
            elif "expression" in input_kwargs and "query" not in input_kwargs:
                input_kwargs["query"] = input_kwargs["expression"]

            # Extract preceding thought
            thought_text = ""
            if "Action:" in step_text:
                thought_text = step_text.split("Action:")[0].replace("Thought:", "").strip()
                if thought_text:
                    yield {"type": "thought", "content": thought_text}

            # Emit tool call event
            yield {
                "type": "tool_start",
                "tool": tool_name,
                "input": input_kwargs,
                "iteration": iteration,
            }

            # Execute tool
            tool = tool_registry.get(tool_name)
            t0 = time.perf_counter()
            if not tool:
                observation = f"Error: Tool '{tool_name}' is not registered. Available tools: [{tool_names}]"
                elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
            else:
                tools_used.append(tool_name)
                try:
                    tool_result = await tool.execute(**input_kwargs)
                    observation = json.dumps(tool_result, default=str) if isinstance(tool_result, (dict, list)) else str(tool_result)
                    elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
                except Exception as ex:
                    observation = f"Tool execution failed: {str(ex)}"
                    elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)

            yield {
                "type": "tool_result",
                "tool": tool_name,
                "result": observation,
                "elapsed_ms": elapsed_ms,
            }

            # Append observation to scratchpad
            scratchpad += f"\nObservation: {observation}"

        # Max iterations reached - prompt for final synthesis
        synthesis_prompt = (
            f"Question: {question}\n"
            f"Notes and tool findings:\n{scratchpad}\n\n"
            f"Synthesize a clear and complete answer to the original question based on the findings above:"
        )

        async for chunk in ollama.generate_stream(
            model=model,
            prompt=synthesis_prompt,
            options={"temperature": 0.3},
        ):
            token = chunk.get("response", "")
            yield {"type": "token", "content": token}

        yield {"type": "done", "total_steps": iteration, "tools_used": tools_used}


react_agent = ReActAgent()
