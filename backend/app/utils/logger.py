import json
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
LOG_FILE = PROJECT_ROOT / "logs" / "requests.log"

LOG_FILE.parent.mkdir(exist_ok=True)


def log_request(data: dict):

    metadata = {
        "timestamp": datetime.now().isoformat(),

        # User
        "question": data.get("question"),
        "optimized_prompt": data.get("optimized_prompt"),

        # Processor
        "intent": data.get("intent"),
        "task_type": data.get("task_type"),
        "intent_confidence": data.get("intent_confidence"),
        "entities": data.get("entities"),
        "processor_reason": data.get("processor_reason"),

        # Models
        "processor_model": data.get("processor_model"),
        "target_model": data.get("target_model"),

        # Latencies
        "processor_latency_ms": data.get("processor_latency_ms"),
        "routing_latency_ms": data.get("routing_latency_ms"),
        "generation_latency_ms": data.get("generation_latency_ms"),
        "total_latency_ms": data.get("total_latency_ms"),

        # System Metrics
        "cpu_percent": data.get("cpu_percent"),
        "tokens_per_second": data.get("tokens_per_second"),

        # Context
        "context_tokens": data.get("context_tokens"),
        "context_window": data.get("context_window"),
        "context_usage_percent": data.get("context_usage_percent"),

        # Ollama Metrics
        "model_load_time_ms": data.get("model_load_time_ms"),
        "prompt_eval_time_ms": data.get("prompt_eval_time_ms"),
        "generation_time_ms": data.get("generation_time_ms"),

        # Token Usage
        "prompt_tokens": data.get("prompt_tokens"),
        "completion_tokens": data.get("completion_tokens"),

        # Response
        "response_length": data.get("response_length"),
    }

    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(metadata) + "\n")
        f.flush()