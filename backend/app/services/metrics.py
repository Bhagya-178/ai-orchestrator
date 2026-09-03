"""
Metrics payload builder for request logging and DB persistence.

Kept out of the chat pipeline so the payload shape can grow (Phase 5:
benchmarking, caching stats, ...) without touching orchestration code.
"""

import asyncio
import json
from typing import Any

import psutil

from app.config import settings

CONTEXT_WINDOW = 32768


async def build_request_data(
    message: str,
    processed: dict[str, Any],
    model: str,
    processor_latency_ms: float,
    routing_latency_ms: float,
    generation_latency_ms: float,
    total_latency_ms: float,
    response: str,
    ollama_response: dict[str, Any],
    session_id: str | None = None
) -> dict[str, Any]:
    """Compile metric points from a completed chat turn."""
    prompt_tokens = ollama_response.get("prompt_eval_count", 0)
    completion_tokens = ollama_response.get("eval_count", 0)
    total_tokens = prompt_tokens + completion_tokens

    eval_count = ollama_response.get("eval_count", 0)
    eval_duration_ns = ollama_response.get("eval_duration", 0)
    prompt_eval_count = ollama_response.get("prompt_eval_count", 0)
    load_duration_ns = ollama_response.get("load_duration", 0)
    prompt_eval_duration_ns = ollama_response.get("prompt_eval_duration", 0)

    tokens_per_second = (
        round(eval_count / (eval_duration_ns / 1_000_000_000), 2)
        if eval_duration_ns > 0
        else 0
    )
    context_usage_percent = (
        round(prompt_eval_count / CONTEXT_WINDOW * 100, 2)
        if CONTEXT_WINDOW > 0
        else 0
    )
    
    # psutil.cpu_percent can be blocking, so we run it in a thread
    cpu_percent = await asyncio.to_thread(psutil.cpu_percent, interval=None)

    return {
        "session_id": session_id,
        "question": message,
        "optimized_prompt": processed.get("optimized_prompt", ""),
        "intent": processed.get("intent", ""),
        # Processor metadata, useful for debugging routing decisions
        "task_type": processed.get("task_type"),
        "intent_confidence": processed.get("confidence"),
        "entities": json.dumps(processed.get("entities", [])),
        "processor_reason": processed.get("reason"),
        "processor_model": settings.PROCESSOR_MODEL,
        "target_model": model,
        "processor_latency_ms": processor_latency_ms,
        "cpu_percent": cpu_percent,
        "tokens_per_second": tokens_per_second,
        "context_tokens": prompt_eval_count,
        "context_window": CONTEXT_WINDOW,
        "context_usage_percent": context_usage_percent,
        "routing_latency_ms": routing_latency_ms,
        "generation_latency_ms": generation_latency_ms,
        "total_latency_ms": total_latency_ms,
        "model_load_time_ms": round(load_duration_ns / 1_000_000, 2),
        "prompt_eval_time_ms": round(prompt_eval_duration_ns / 1_000_000, 2),
        "generation_time_ms": round(eval_duration_ns / 1_000_000, 2),
        "prompt_tokens": prompt_eval_count,
        "completion_tokens": eval_count,
        "response_length": len(response),
    }
