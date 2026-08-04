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