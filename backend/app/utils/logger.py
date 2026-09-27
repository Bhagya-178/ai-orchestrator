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
try:
    os.makedirs(LOG_DIR, exist_ok=True)
except Exception:
    pass

APP_LOG_FILE = LOG_DIR / "app.log"

# Setup basic app logging with rotation
app_logger = logging.getLogger("app")
app_logger.setLevel(logging.INFO)

if not app_logger.handlers:
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    try:
        # 5 MB max size, keeping 3 backups
        handler: logging.Handler = RotatingFileHandler(APP_LOG_FILE, maxBytes=5*1024*1024, backupCount=3, encoding="utf-8")
    except Exception:
        handler = logging.StreamHandler()
    handler.setFormatter(formatter)
    app_logger.addHandler(handler)
    
    # Allow other loggers to use this format
    root_logger = logging.getLogger()
    if not root_logger.handlers:
        root_logger.addHandler(handler)
        root_logger.setLevel(logging.INFO)


def log_request(data: dict) -> None:
    """Legacy request logger (metrics are stored directly in PostgreSQL request_logs)."""
    pass