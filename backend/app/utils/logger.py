"""
Logging utilities for the application.

Configures a rotating file handler to keep log file sizes in check,
and provides helper functions for structured request logging.
"""
import json
import logging
import os
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
LOG_DIR = PROJECT_ROOT / "logs"

# Ensure logs/ directory is created safely
os.makedirs(LOG_DIR, exist_ok=True)

LOG_FILE = LOG_DIR / "requests.log"
APP_LOG_FILE = LOG_DIR / "app.log"

# Setup basic app logging with rotation
app_logger = logging.getLogger("app")
app_logger.setLevel(logging.INFO)

if not app_logger.handlers:
    # 5 MB max size, keeping 3 backups
    handler = RotatingFileHandler(APP_LOG_FILE, maxBytes=5*1024*1024, backupCount=3, encoding="utf-8")
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    handler.setFormatter(formatter)
    app_logger.addHandler(handler)
    
    # Allow other loggers to use this format
    root_logger = logging.getLogger()
    if not root_logger.handlers:
        root_logger.addHandler(handler)
        root_logger.setLevel(logging.INFO)


def log_request(data: dict) -> None:
    """Log structured request metrics to the dedicated requests.log file."""
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

    # Write directly to the structured log file
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(metadata) + "\\n")
            f.flush()
    except Exception as e:
        app_logger.error("Failed to write to requests log: %s", e)