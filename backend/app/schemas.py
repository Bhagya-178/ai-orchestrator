from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    session_id: str | None = None
    use_rag: bool = True  # frontend can toggle document context on/off


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


class ConversationResponse(BaseModel):
    id: str
    title: str
    updatedAt: str
    createdAt: str


class DocumentResponse(BaseModel):
    id: str
    filename: str
    content_type: str
    file_size: int
    session_id: str | None
    metadata: dict
    created_at: str