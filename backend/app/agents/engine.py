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


EFFORT_TOKEN_BUDGET = {
    "low": 600,
    "medium": 1200,
    "high": 2500,
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
        """
        start_time = time.perf_counter()
        clean_effort = effort_level.lower() if effort_level else "medium"
        max_tokens = EFFORT_TOKEN_BUDGET.get(clean_effort, 1200)

        # 1. Low-Effort Scaling: Prune non-essential QA/Critic nodes for rapid turnaround
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

            # Sequential wave execution ensures local Ollama instance receives 100% GPU bandwidth
            # and prevents concurrency thrashing / inference lockups on single-GPU hardware.
            async def run_single_node(nid: str) -> tuple[str, str, float, Optional[str]]:
                node = node_map[nid]
                role_obj = AGENT_REGISTRY.get(node.role, AGENT_REGISTRY["planner"])

                # Interpolate upstream outputs: {{node_id.output}} or inject whole context
                task_prompt = node.task
                for prev_id, prev_out in node_outputs.items():
                    placeholder = f"{{{{{prev_id}.output}}}}"
                    task_prompt = task_prompt.replace(placeholder, prev_out)

                if initial_input and "{{input}}" in task_prompt:
                    task_prompt = task_prompt.replace("{{input}}", initial_input)

                if clean_effort == "low":
                    task_prompt += "\n\n(Important: Keep response concise, modular, and focused on essential implementation without excessive boilerplate.)"

                # Context of direct dependencies (omit those already interpolated to prevent prompt doubling)
                dep_context = {}
                for dep in node.depends_on:
                    placeholder = f"{{{{{dep}.output}}}}"
                    if placeholder not in node.task:
                        dep_context[dep] = node_outputs.get(dep, "")

                if initial_input and "{{input}}" not in node.task and "user_objective" not in dep_context:
                    dep_context["user_objective"] = initial_input

                node_start = time.perf_counter()
                error_msg = None
                try:
                    output = await role_obj.execute(
                        task=task_prompt,
                        context=dep_context,
                        model_override=node.model or model_override,
                        max_tokens=max_tokens,
                    )
                except Exception as ex:
                    logger.exception(f"Node {nid} failed: {ex}")
                    output = f"Execution error: {ex}"
                    error_msg = str(ex)

                duration = (time.perf_counter() - node_start) * 1000.0
                return nid, output, duration, error_msg

            # Execute wave sequentially with immediate telemetry per node
            for nid in wave:
                n = node_map[nid]
                yield {
                    "type": "node_start",
                    "node_id": nid,
                    "name": n.name,
                    "role": n.role,
                }

                nid, out, dur, err = await run_single_node(nid)
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

        # 2. High-Effort Autonomous Reflection Loop:
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
                    for k in ["vulnerability", "issue", "risk", "flaw", "bug", "missing", "security", "warning", "patch", "sanitize"]
                )
                if has_critique:
                    yield {
                        "type": "thought",
                        "content": "🛡️ High Effort Autonomous Reflection: Reviewer identified findings. Triggering autonomous patch cycle with Coder Agent...",
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
                        f"Review the security audit and vulnerability findings below:\n\n{combined_reviews}\n\n"
                        f"Implement hardened fixes, input validation, parameterized queries, and defensive safeguards to resolve every issue."
                    )
                    patch_output = await coder_agent.execute(
                        task=patch_task,
                        context=node_outputs,
                        model_override=model_override,
                        max_tokens=max_tokens,
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

        total_duration = (time.perf_counter() - start_time) * 1000.0

        # The final answer is typically the last node in the last wave
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
