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
    intent_override: str = "auto"
    effort_level: str = "medium"
    is_pinned: bool = False
    system_prompt: str = ""


class ConversationUpdateRequest(BaseModel):
    intent_override: str | None = None
    effort_level: str | None = None
    title: str | None = None
    is_pinned: bool | None = None
    system_prompt: str | None = None


class ConversationExportResponse(BaseModel):
    id: str
    title: str
    markdown: str
    json_data: dict


class RegenerateRequest(BaseModel):
    session_id: str
    intent_override: str | None = None
    effort_level: str | None = "medium"
    use_rag: bool = True


class DocumentResponse(BaseModel):
    id: str
    filename: str
    content_type: str
    file_size: int
    session_id: str | None
    metadata: dict
    created_at: str


# --- Authentication & User Management Schemas ---

class UserRegisterRequest(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6)
    full_name: str | None = ""


class UserLoginRequest(BaseModel):
    email: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    custom_instructions: str = ""
    created_at: str


class UserUpdateRequest(BaseModel):
    full_name: str | None = None
    custom_instructions: str | None = None
    password: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class OtpRegisterResponse(BaseModel):
    success: bool = True
    message: str
    email: str
    cooldown_seconds: int = 60
    dev_otp: str | None = None


class VerifyOtpRequest(BaseModel):
    email: str = Field(..., min_length=3)
    otp: str = Field(..., min_length=6, max_length=6)


class ResendOtpRequest(BaseModel):
    email: str = Field(..., min_length=3)