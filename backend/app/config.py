"""
Centralized application configuration.

All settings are read from environment variables with sensible defaults.
Fails fast with a clear error if required values (DATABASE_URL) are missing.
"""

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def _parse_cors_origins(raw: str) -> list[str]:
    """Parse comma-separated CORS origins into a list."""
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def _require_env(key: str) -> str:
    """Read a required environment variable or fail fast."""
    value = os.getenv(key)
    if not value:
        raise RuntimeError(
            f"Required environment variable '{key}' is not set. "
            f"Check your .env file or Docker environment."
        )
    return value


@dataclass(frozen=True)
class Settings:
    """Immutable application settings. Created once at startup."""

    # --- Ollama ---
    OLLAMA_URL: str = "http://localhost:11434"
    OLLAMA_KEEP_ALIVE: str = "0"

    # --- Database ---
    DATABASE_URL: str = ""  # Required — validated in _load_settings

    # --- Models ---
    PROCESSOR_MODEL: str = "qwen2.5:1.5b"
    SUMMARY_MODEL: str = "qwen2.5:1.5b"
    RAG_MODEL: str = "qwen3:8b"

    # --- RAG ---
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_COLLECTION: str = "documents"
    EMBEDDING_MODEL: str = "bge-m3:latest"

    # --- App ---
    APP_NAME: str = "AI Orchestrator"
    CORS_ORIGINS: tuple[str, ...] = ("http://localhost:3000", "http://127.0.0.1:3000")

    # --- Memory Service ---
    MAX_RAW_MESSAGES: int = 20
    SUMMARIZE_THRESHOLD: int = 15


def _load_settings() -> Settings:
    """Build a Settings instance from the environment."""
    database_url = _require_env("DATABASE_URL")

    cors_raw = os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    )

    return Settings(
        OLLAMA_URL=os.getenv("OLLAMA_URL", "http://localhost:11434"),
        OLLAMA_KEEP_ALIVE=os.getenv("OLLAMA_KEEP_ALIVE", "0"),
        DATABASE_URL=database_url,
        PROCESSOR_MODEL=os.getenv("PROCESSOR_MODEL", "qwen2.5:1.5b"),
        SUMMARY_MODEL=os.getenv("SUMMARY_MODEL", "qwen2.5:1.5b"),
        RAG_MODEL=os.getenv("RAG_MODEL", "qwen3:8b"),
        QDRANT_URL=os.getenv("QDRANT_URL", "http://localhost:6333"),
        QDRANT_COLLECTION=os.getenv("QDRANT_COLLECTION", "documents"),
        EMBEDDING_MODEL=os.getenv("EMBEDDING_MODEL", "bge-m3:latest"),
        APP_NAME=os.getenv("APP_NAME", "AI Orchestrator"),
        CORS_ORIGINS=tuple(_parse_cors_origins(cors_raw)),
        MAX_RAW_MESSAGES=int(os.getenv("MAX_RAW_MESSAGES", "20")),
        SUMMARIZE_THRESHOLD=int(os.getenv("SUMMARIZE_THRESHOLD", "15")),
    )


settings = _load_settings()

# ---------------------------------------------------------------------------
# Backward-compatible module-level exports.
# Existing code that does `from app.config import OLLAMA_URL` still works.
# New code should prefer `from app.config import settings`.
# ---------------------------------------------------------------------------
OLLAMA_URL = settings.OLLAMA_URL
OLLAMA_KEEP_ALIVE = settings.OLLAMA_KEEP_ALIVE
DATABASE_URL = settings.DATABASE_URL
PROCESSOR_MODEL = settings.PROCESSOR_MODEL
SUMMARY_MODEL = settings.SUMMARY_MODEL
RAG_MODEL = settings.RAG_MODEL
QDRANT_URL = settings.QDRANT_URL
QDRANT_COLLECTION = settings.QDRANT_COLLECTION
EMBEDDING_MODEL = settings.EMBEDDING_MODEL
APP_NAME = settings.APP_NAME