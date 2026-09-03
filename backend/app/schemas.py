from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    session_id: str | None = None
    use_rag: bool = True  # frontend can toggle document context on/off
    intent_override: str | None = None  # e.g., 'coding', 'reasoning', 'study', 'general', 'auto' (None)
    effort_level: str | None = "medium"  # 'low', 'medium', 'high'


class ChatMetrics(BaseModel):
    total_requests: int
    average_latency_ms: float
    total_prompt_tokens: int
    total_completion_tokens: int
    average_tokens_per_second: float

class MetricsResponse(BaseModel):
    session_id: str
    metrics: ChatMetrics


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