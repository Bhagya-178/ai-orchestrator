from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
)

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
    done_reason = Column(String)


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