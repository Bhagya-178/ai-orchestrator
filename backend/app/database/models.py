from datetime import datetime
from uuid import uuid4

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.database.database import Base


class RequestLog(Base):

    __tablename__ = "request_logs"

    id = Column(Integer, primary_key=True, index=True)

    timestamp = Column(
        DateTime,
        default=datetime.utcnow,
    )

    # User request
    question = Column(Text)
    optimized_prompt = Column(Text)

    # Processor
    intent = Column(String)
    task_type = Column(String)
    intent_confidence = Column(Float)
    entities = Column(Text)
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

    __tablename__ = "conversation_messages"

    id = Column(Integer, primary_key=True, index=True)

    # A single session_id holds the whole conversation thread.
    session_id = Column(String, index=True)

    # "user" | "assistant"
    role = Column(String)
    content = Column(Text)

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
    )


class SessionSummary(Base):
    """Rolling summary for a session (Phase 2).

    Oldest turns are folded into a single summary row once the session
    grows, so the model context stays bounded instead of replaying the
    whole history every turn.
    """

    __tablename__ = "session_summaries"

    id = Column(Integer, primary_key=True, index=True)

    # One summary per session.
    session_id = Column(String, unique=True, index=True)

    summary = Column(Text, default="")

    # id of the last raw message folded into the summary.
    last_summarized_message_id = Column(Integer, default=0)

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )


class Document(Base):
    """Uploaded document for RAG."""

    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    filename = Column(String, index=True)
    content_type = Column(String)
    file_size = Column(Integer)
    session_id = Column(String, index=True)  # optional: associate with chat session
    doc_metadata = Column(JSONB, default={})  # extra info: pages, author, etc.
    created_at = Column(DateTime, default=datetime.utcnow)


class DocumentChunk(Base):
    """Text chunk with embedding reference."""

    __tablename__ = "document_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), index=True)
    chunk_index = Column(Integer)
    content = Column(Text)
    qdrant_point_id = Column(String, unique=True, index=True)  # reference to Qdrant
    chunk_metadata = Column(JSONB, default={})  # page_num, section, etc.
    created_at = Column(DateTime, default=datetime.utcnow)