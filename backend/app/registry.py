import os

from app.config import settings

RAG_MODEL = settings.RAG_MODEL

MODEL_REGISTRY = {
    "reasoning": os.getenv("MODEL_REASONING", "deepseek-r1:8b"),
    "coding": os.getenv("MODEL_CODING", "qwen2.5-coder:7b"),
    "study": os.getenv("MODEL_STUDY", "gemma4:e4b"),
    "general": os.getenv("MODEL_GENERAL", "qwen3:8b"),
}