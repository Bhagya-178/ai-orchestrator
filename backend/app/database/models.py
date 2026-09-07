"""
ORM models for the AI Orchestrator database.

Conventions:
- All timestamps use database-side UTC via func.now().
- Foreign keys with ondelete="CASCADE" to prevent orphan rows.
- ORM relationships defined for convenient access.
"""

from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.database.database import Base


class User(Base):
    """Registered user account for authentication, RBAC, and data isolation."""

    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, default="")
    role = Column(String, default="user")  # "user" | "admin"
    is_active = Column(Boolean, default=True)
    custom_instructions = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="user", cascade="all, delete-orphan")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")


class RefreshToken(Base):
    """Cryptographic refresh token for maintaining authenticated user sessions."""

    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    token_hash = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="refresh_tokens")


class RequestLog(Base):
    """Telemetry log for every chat request processed."""

    __tablename__ = "request_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    session_id = Column(String, index=True, nullable=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)

    # User request
    question = Column(Text)
    optimized_prompt = Column(Text)

    # Processor
    intent = Column(String)
    task_type = Column(String)
    intent_confidence = Column(Float)
    entities = Column(JSONB, default=list)
    processor_reason = Column(Text)

    processor_model = Column(String)
    target_model = Column(String)

    # Performance
    processor_latency_ms = Column(Float)
    routing_latency_ms = Column(Float)
    generation_latency_ms = Column(Float)
    total_latency_ms = Column(Float)

    cpu_percent = Column(Float)
    tokens_per_second = Column(Float)

    # Context
    context_tokens = Column(Integer)
    context_window = Column(Integer)
    context_usage_percent = Column(Float)

    # Ollama metrics
    model_load_time_ms = Column(Float)
    prompt_eval_time_ms = Column(Float)
    generation_time_ms = Column(Float)

    prompt_tokens = Column(Integer)
    completion_tokens = Column(Integer)

    # Response
    response_length = Column(Integer)


class Conversation(Base):
    """Metadata and persistent settings for a conversation session."""

    __tablename__ = "conversations"

    id = Column(String, primary_key=True, index=True)  # session_id
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True)
    title = Column(String, default="New Conversation")
    intent_override = Column(String, default="auto")  # "auto" | "general" | "coding" | "reasoning" | "study"
    effort_level = Column(String, default="medium")   # "low" | "medium" | "high"
    is_pinned = Column(Boolean, default=False)
    system_prompt = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    user = relationship("User", back_populates="conversations")


class ConversationMessage(Base):
    """A single message in a conversation thread."""

    __tablename__ = "conversation_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True, nullable=False)
    role = Column(String, nullable=False)  # "user" | "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SessionSummary(Base):
    """Rolling summary for a session (Phase 2).

    Oldest turns are folded into a single summary row so the model context
    stays bounded instead of replaying the whole history every turn.
    """

    __tablename__ = "session_summaries"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, index=True, nullable=False)
    summary = Column(Text, default="")
    last_summarized_message_id = Column(Integer, default=0)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class Document(Base):
    """Uploaded document for RAG."""

    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True)
    filename = Column(String, index=True, nullable=False)
    content_type = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    session_id = Column(String, index=True)
    doc_metadata = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="documents")

    # ORM relationship — enables doc.chunks access and cascade deletes
    chunks = relationship(
        "DocumentChunk",
        back_populates="document",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class DocumentChunk(Base):
    """Text chunk with embedding reference."""

    __tablename__ = "document_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_id = Column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    qdrant_point_id = Column(String, unique=True, index=True)
    chunk_metadata = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # ORM relationship back to parent
    document = relationship("Document", back_populates="chunks")


class Workspace(Base):
    """Collaborative multi-tenant workspace for teams."""

    __tablename__ = "workspaces"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, default="")
    owner_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    settings = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", foreign_keys=[owner_id])
    members = relationship("WorkspaceMember", back_populates="workspace", cascade="all, delete-orphan")


class WorkspaceMember(Base):
    """Membership mapping connecting users to workspaces with RBAC roles."""

    __tablename__ = "workspace_members"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(String, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String, default="member")  # "owner" | "admin" | "member" | "viewer"
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    workspace = relationship("Workspace", back_populates="members")
    user = relationship("User")


class AuditLog(Base):
    """Audit logging tracking security events, API actions, and administrative changes."""

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(String, nullable=True, index=True)
    user_id = Column(String, nullable=True, index=True)
    action = Column(String, nullable=False, index=True)
    resource_type = Column(String, nullable=True)
    resource_id = Column(String, nullable=True)
    details = Column(JSONB, default=dict)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ApiKey(Base):
    """Programmatic API keys for external developers and CLI integrations."""

    __tablename__ = "api_keys"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    key_prefix = Column(String(16), nullable=False, index=True)
    key_hash = Column(String(64), unique=True, nullable=False, index=True)
    scopes = Column(JSONB, default=list)  # ["chat:read", "chat:write", "rag:read", "rag:admin", "agents:run"]
    is_active = Column(Boolean, default=True)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")


class WebhookEndpoint(Base):
    """Registered webhook subscriptions for asynchronous event callbacks."""

    __tablename__ = "webhook_endpoints"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    url = Column(String, nullable=False)
    secret = Column(String, nullable=False)  # Secret for HMAC-SHA256 signatures
    events = Column(JSONB, default=list)    # ["workflow.completed", "document.indexed", "eval.finished"]
    description = Column(String, default="")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")


class WebhookDelivery(Base):
    """Delivery log and dispatch status for webhook events."""

    __tablename__ = "webhook_deliveries"

    id = Column(Integer, primary_key=True, index=True)
    webhook_id = Column(String, ForeignKey("webhook_endpoints.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String, nullable=False, index=True)
    payload = Column(JSONB, default=dict)
    response_status = Column(Integer, nullable=True)
    response_body = Column(Text, nullable=True)
    duration_ms = Column(Float, default=0.0)
    success = Column(Boolean, default=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class EvaluationRun(Base):
    """Benchmark test run recording LLM-as-a-judge scores and evaluations."""

    __tablename__ = "evaluation_runs"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    dataset_name = Column(String, nullable=False, index=True)
    model_name = Column(String, nullable=False, index=True)
    judge_model = Column(String, nullable=False)
    total_test_cases = Column(Integer, default=0)
    passed_cases = Column(Integer, default=0)
    summary_scores = Column(JSONB, default=dict)  # {"faithfulness": 0.92, "relevance": 0.88, ...}
    detailed_results = Column(JSONB, default=list)
    duration_seconds = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())