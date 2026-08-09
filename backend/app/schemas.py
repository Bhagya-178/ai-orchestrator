from pydantic import BaseModel
from typing import Optional

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    success: bool
    session_id: str
    intent: str
    model: str
    latency_ms: float
    response: str


class HealthResponse(BaseModel):
    status: str
    ollama: str


class ModelsResponse(BaseModel):
    models: list[str]