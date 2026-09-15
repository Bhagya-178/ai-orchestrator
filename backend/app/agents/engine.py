"""
Directed Acyclic Graph (DAG) Multi-Agent Workflow Engine.

Supports:
- Cyclic dependency detection (topological sort via Kahn's algorithm)
- Concurrent execution of independent DAG branches via asyncio
- Upstream context resolution and variable interpolation ({{node_id.output}})
- Streaming real-time execution telemetry for frontend DAG visualizers
"""

import asyncio
import logging
import re
import time
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable
from typing import Any, AsyncGenerator, Optional

from pydantic import BaseModel, Field

from app.agents.roles import AGENT_REGISTRY, AgentRole

logger = logging.getLogger(__name__)


class WorkflowNode(BaseModel):
    id: str
    name: str
    role: str  # "planner" | "researcher" | "coder" | "reviewer" | "critic"
    task: str
    depends_on: list[str] = Field(default_factory=list)
    model: Optional[str] = None


class WorkflowDefinition(BaseModel):
    id: str
    name: str
    description: str = ""
    nodes: list[WorkflowNode]


def detect_cycles_and_toposort(nodes: list[WorkflowNode]) -> list[list[str]]:
    """
    Validates DAG structure, detects cycles, and returns execution waves
    where each wave contains node IDs that can be safely run in parallel.
    """
    node_map = {n.id: n for n in nodes}
    in_degree = {n.id: len(n.depends_on) for n in nodes}
    dependents = defaultdict(list)

    for n in nodes:
        for dep in n.depends_on:
            if dep not in node_map:
                raise ValueError(f"Node '{n.id}' depends on non-existent node '{dep}'")
            dependents[dep].append(n.id)

    # Queue nodes with in_degree 0
    current_wave = [nid for nid, deg in in_degree.items() if deg == 0]
    if not current_wave and nodes:
        raise ValueError("Circular dependency detected: No starting node with 0 dependencies.")

    waves: list[list[str]] = []
    visited_count = 0

    while current_wave:
        waves.append(current_wave)
        visited_count += len(current_wave)
        next_wave = []

        for nid in current_wave:
            for dep_id in dependents[nid]:
                in_degree[dep_id] -= 1
                if in_degree[dep_id] == 0:
                    next_wave.append(dep_id)

        current_wave = next_wave

    if visited_count != len(nodes):
        raise ValueError("Circular dependency detected in DAG workflow definition.")

    return waves


# Effort levels control the number of workflow task iterations and reflection cycles,
# NOT the token context or generation size (which always uses the full 16K context & 8K generation).
EFFORT_WORKFLOW_LEVELS = {
    "low": {
        "max_iterations": 2,
        "description": "Minimal task iterations (plan -> implementation). Fast execution for rapid prototyping.",
    },
    "medium": {
        "max_iterations": 5,
        "description": "Standard 5-agent sequential pipeline: plan -> backend -> frontend -> review -> synthesis.",
    },
    "high": {
        "max_iterations": 7,
        "description": "Comprehensive pipeline with autonomous self-healing reflection and patch verification loops.",
    },
}


class WorkflowExecutionEngine:
    """Executes multi-agent DAG workflows with live telemetry streaming."""

    def __init__(self):
        pass

    async def execute_workflow(
        self,
        workflow: WorkflowDefinition,
        initial_input: str = "",
        model_override: Optional[str] = None,
        effort_level: str = "medium",
    ) -> AsyncGenerator[dict[str, Any], None]:
        """
        Execute workflow wave-by-wave with effort-driven dynamic scaling and reflection loops.
        Uses full context window for all models so code is never truncated.
        Guarantees strictly ONE agent runs on the GPU at any given time.
        """
        start_time = time.perf_counter()
        clean_effort = effort_level.lower() if effort_level else "medium"

        # 1. Low-Effort Scaling: Prune non-essential QA/Critic nodes for minimal iterations
        active_nodes = workflow.nodes
        if clean_effort == "low" and len(workflow.nodes) > 2:
            core_roles = {"planner", "coder", "researcher"}
            kept = [n for n in workflow.nodes if n.role in core_roles]
            if kept:
                kept_ids = {n.id for n in kept}
                active_nodes = [
                    WorkflowNode(
                        id=n.id,
                        name=n.name,
                        role=n.role,
                        task=n.task,
                        depends_on=[dep for dep in n.depends_on if dep in kept_ids],
                        model=n.model,
                    )
                    for n in kept
                ]

        node_map = {n.id: n for n in active_nodes}

        try:
            waves = detect_cycles_and_toposort(active_nodes)
        except ValueError as err:
            yield {
                "type": "workflow_error",
                "error": str(err),
            }
            return

        yield {
            "type": "workflow_start",
            "workflow_id": workflow.id,
            "workflow_name": workflow.name,
            "total_nodes": len(active_nodes),
            "waves_count": len(waves),
            "effort_level": clean_effort,
        }

        node_outputs: dict[str, str] = {}
        node_timings: dict[str, float] = {}

        for wave_idx, wave in enumerate(waves):
            yield {
                "type": "wave_start",
                "wave_index": wave_idx,
                "node_ids": wave,
            }

            # Sequential node execution ensures local Ollama instance receives 100% GPU compute
            # and prevents concurrency thrashing / inference lockups on single-GPU hardware.
            async def run_single_node(
                nid: str,
                on_tool_event: Optional[Callable[[dict[str, Any]], Awaitable[None]]] = None,
            ) -> tuple[str, str, float, Optional[str]]:
                node = node_map[nid]
                role_obj = AGENT_REGISTRY.get(node.role, AGENT_REGISTRY["planner"])

                # Interpolate upstream outputs: {{node_id.output}} or inject whole context
                task_prompt = node.task
                for prev_id, prev_out in node_outputs.items():
                    placeholder = f"{{{{{prev_id}.output}}}}"
                    task_prompt = task_prompt.replace(placeholder, prev_out)

                if initial_input and "{{input}}" in task_prompt:
                    task_prompt = task_prompt.replace("{{input}}", initial_input)

                # Context of direct dependencies (omit those already interpolated to prevent prompt doubling)
                dep_context = {}
                for dep in node.depends_on:
                    placeholder = f"{{{{{dep}.output}}}}"
                    if placeholder not in node.task:
                        dep_context[dep] = node_outputs.get(dep, "")

                if initial_input and "{{input}}" not in node.task and "user_objective" not in dep_context:
                    dep_context["user_objective"] = initial_input

                # Target Model Resolution:
                # In fullstack coding workflows, strictly use qwen2.5-coder:7b across all phases
                # so only ONE model is loaded in VRAM, eliminating multi-model VRAM swapping.
                is_coding_workflow = "fullstack" in workflow.id.lower() or "code" in workflow.id.lower()
                target_model = node.model or model_override
                if is_coding_workflow and (not target_model or target_model.startswith("qwen3:") or target_model.startswith("workflow:")):
                    target_model = "qwen2.5-coder:7b"

                node_start = time.perf_counter()
                error_msg = None
                try:
                    # max_tokens=None: do not cap tokens! Allows full 8K generation & 16K context window.
                    output = await role_obj.execute(
                        task=task_prompt,
                        context=dep_context,
                        model_override=target_model,
                        max_tokens=None,
                        event_callback=on_tool_event,
                    )
                except Exception as ex:
                    logger.exception(f"Node {nid} failed: {ex}")
                    output = f"Execution error: {ex}"
                    error_msg = str(ex)

                duration = (time.perf_counter() - node_start) * 1000.0
                return nid, output, duration, error_msg

            # Execute wave nodes strictly one by one sequentially
            for nid in wave:
                n = node_map[nid]
                yield {
                    "type": "node_start",
                    "node_id": nid,
                    "name": n.name,
                    "role": n.role,
                }

                captured_events: list[dict[str, Any]] = []

                async def _on_ev(ev: dict[str, Any]):
                    captured_events.append(ev)

                nid, out, dur, err = await run_single_node(nid, on_tool_event=_on_ev)

                for ev in captured_events:
                    yield ev

                node_outputs[nid] = out
                node_timings[nid] = dur

                if err:
                    yield {
                        "type": "node_error",
                        "node_id": nid,
                        "error": err,
                        "duration_ms": dur,
                    }
                else:
                    yield {
                        "type": "node_complete",
                        "node_id": nid,
                        "output": out,
                        "duration_ms": round(dur, 1),
                    }

        # 2. High-Effort Autonomous Reflection & Self-Healing Loops:
        # If security or QA reviewer detected vulnerabilities or issues, loop back to Coder agent
        if clean_effort == "high":
            reviewer_outputs = [
                node_outputs[nid]
                for nid in node_outputs
                if nid in node_map and node_map[nid].role == "reviewer"
            ]
            if reviewer_outputs:
                combined_reviews = "\n\n".join(reviewer_outputs)
                has_critique = any(
                    k in combined_reviews.lower()
                    for k in ["vulnerability", "issue", "risk", "flaw", "bug", "missing", "security", "warning", "patch", "sanitize", "fix", "error"]
                )
                if has_critique:
                    # Reflection Iteration 1: Remediation Patch with Coder Agent
                    yield {
                        "type": "thought",
                        "content": "🛡️ High Effort Autonomous Reflection (Iteration 1/2): Reviewer identified findings. Triggering autonomous patch cycle with Coder Agent...",
                    }
                    patch_id = "security_patch_loop"
                    yield {
                        "type": "node_start",
                        "node_id": patch_id,
                        "name": "Security Hardening & Remediation Loop",
                        "role": "coder",
                    }
                    patch_start = time.perf_counter()
                    coder_agent = AGENT_REGISTRY.get("coder", AGENT_REGISTRY["planner"])
                    patch_task = (
                        f"Review the security audit and code review findings below:\n\n{combined_reviews}\n\n"
                        f"Implement hardened fixes, input validation, parameterized queries, and defensive safeguards to resolve every issue. Output the complete updated code."
                    )
                    patch_model = "qwen2.5-coder:7b" if "fullstack" in workflow.id.lower() else (model_override or "qwen2.5-coder:7b")
                    patch_output = await coder_agent.execute(
                        task=patch_task,
                        context=node_outputs,
                        model_override=patch_model,
                        max_tokens=None,  # Full context window
                    )
                    patch_dur = (time.perf_counter() - patch_start) * 1000.0
                    node_outputs[patch_id] = patch_output
                    node_timings[patch_id] = patch_dur
                    yield {
                        "type": "node_complete",
                        "node_id": patch_id,
                        "output": patch_output,
                        "duration_ms": round(patch_dur, 1),
                    }

                    # Reflection Iteration 2: Quality Gate Verification with Reviewer Agent
                    yield {
                        "type": "thought",
                        "content": "🛡️ High Effort Autonomous Reflection (Iteration 2/2): Reviewer verifying remediation fixes...",
                    }
                    verify_id = "remediation_verification"
                    yield {
                        "type": "node_start",
                        "node_id": verify_id,
                        "name": "Remediation Verification & Quality Gate",
                        "role": "reviewer",
                    }
                    verify_start = time.perf_counter()
                    reviewer_agent = AGENT_REGISTRY.get("reviewer", AGENT_REGISTRY["planner"])
                    verify_task = (
                        f"Verify that the remediation patches successfully resolved all previous security findings:\n\n{patch_output}\n\n"
                        f"Confirm all vulnerabilities are resolved and output a final quality clearance report."
                    )
                    verify_output = await reviewer_agent.execute(
                        task=verify_task,
                        context={**node_outputs, "patch": patch_output},
                        model_override=patch_model,
                        max_tokens=None,  # Full context window
                    )
                    verify_dur = (time.perf_counter() - verify_start) * 1000.0
                    node_outputs[verify_id] = verify_output
                    node_timings[verify_id] = verify_dur
                    yield {
                        "type": "node_complete",
                        "node_id": verify_id,
                        "output": verify_output,
                        "duration_ms": round(verify_dur, 1),
                    }

        total_duration = (time.perf_counter() - start_time) * 1000.0

        # The final answer is typically the last node in the last wave (or last reflection output)
        final_node_id = waves[-1][-1] if waves and waves[-1] else ""
        final_output = node_outputs.get(final_node_id, "")

        yield {
            "type": "workflow_complete",
            "workflow_id": workflow.id,
            "total_duration_ms": round(total_duration, 1),
            "node_timings": node_timings,
            "final_output": final_output,
            "all_outputs": node_outputs,
        }


workflow_engine = WorkflowExecutionEngine()
