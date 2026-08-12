from dotenv import load_dotenv
import os

load_dotenv()

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
APP_NAME = os.getenv("APP_NAME", "AI Orchestrator")

OLLAMA_KEEP_ALIVE = os.getenv("OLLAMA_KEEP_ALIVE", "0")

DATABASE_URL = os.getenv("DATABASE_URL")

PROCESSOR_MODEL="qwen2.5:1.5b"

# Phase 2 - model used to fold old conversation turns into a rolling summary.
SUMMARY_MODEL = os.getenv("SUMMARY_MODEL", "qwen2.5:1.5b")

# Phase 3 - RAG Configuration
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION", "documents")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "bge-m3:latest")