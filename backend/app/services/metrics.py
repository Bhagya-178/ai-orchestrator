"""
Metrics payload builder for request logging and DB persistence.

Kept out of the chat pipeline so the payload shape can grow (Phase 5:
benchmarking, caching stats, ...) without touching orchestration code.
"""

import json

import psutil

from app.config import PROCESSOR_MODEL

CONTEXT_WINDOW = 32768


def build_request_data(
    *,
    message: str,
    processed: dict,
    model: str,
    processor_latency_ms: float,
    routing_latency_ms: float,
    generation_latency_ms: float,
    total_latency_ms: float,
    response: str,
    ollama_response: dict,
) -> dict:
    """Assemble the full metrics payload for logging and DB persistence.

    Uses .get() with defaults throughout so a missing/renamed field in
    Ollama's response never turns into an unhandled KeyError.
    """

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
    cpu_percent = psutil.cpu_percent(interval=None)

    return {
        "question": message,
        "optimized_prompt": processed["optimized_prompt"],
        "intent": processed["intent"],
        # Processor metadata, useful for debugging routing decisions
        "task_type": processed.get("task_type"),
        "intent_confidence": processed.get("confidence"),
        "entities": json.dumps(processed.get("entities", [])),
        "processor_reason": processed.get("reason"),
        "processor_model": PROCESSOR_MODEL,
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
        "done_reason": ollama_response.get("done_reason"),
    }
