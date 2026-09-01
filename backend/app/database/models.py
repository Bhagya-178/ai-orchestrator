"""
ORM models for the AI Orchestrator database.

Conventions:
- All timestamps use database-side UTC via func.now().
- Foreign keys with ondelete="CASCADE" to prevent orphan rows.
- ORM relationships defined for convenient access.
"""

from uuid import uuid4

from sqlalchemy import (
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


class RequestLog(Base):
    """Telemetry log for every chat request processed."""

    __tablename__ = "request_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

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
    filename = Column(String, index=True, nullable=False)
    content_type = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    session_id = Column(String, index=True)
    doc_metadata = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

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