from dotenv import load_dotenv
import os

load_dotenv()

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
APP_NAME = os.getenv("APP_NAME", "AI Orchestrator")

OLLAMA_KEEP_ALIVE = os.getenv("OLLAMA_KEEP_ALIVE", "10s")

DATABASE_URL = os.getenv("DATABASE_URL")

PROCESSOR_MODEL="qwen2.5:1.5b"