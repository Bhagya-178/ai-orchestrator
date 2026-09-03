"""
Database service for saving and retrieving request metrics/logs.
"""
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import RequestLog

logger = logging.getLogger(__name__)


class DatabaseService:
    """Service to handle database operations for request logging."""

    async def save_request_log(
        self,
        db: AsyncSession,
        data: dict,
    ) -> RequestLog | None:
        """Save a new request log entry to the database."""
        try:
            log = RequestLog(
                session_id=data.get("session_id"),
                question=data.get("question", ""),
                optimized_prompt=data.get("optimized_prompt", ""),
                intent=data.get("intent", ""),
                task_type=data.get("task_type"),
                intent_confidence=data.get("intent_confidence"),
                entities=data.get("entities"),
                processor_reason=data.get("processor_reason"),
                processor_model=data.get("processor_model", ""),
                target_model=data.get("target_model", ""),
                processor_latency_ms=data.get("processor_latency_ms", 0.0),
                routing_latency_ms=data.get("routing_latency_ms", 0.0),
                generation_latency_ms=data.get("generation_latency_ms", 0.0),
                total_latency_ms=data.get("total_latency_ms", 0.0),
                cpu_percent=data.get("cpu_percent", 0.0),
                tokens_per_second=data.get("tokens_per_second", 0.0),
                context_tokens=data.get("context_tokens", 0),
                context_window=data.get("context_window", 0),
                context_usage_percent=data.get("context_usage_percent", 0.0),
                model_load_time_ms=data.get("model_load_time_ms", 0.0),
                prompt_eval_time_ms=data.get("prompt_eval_time_ms", 0.0),
                generation_time_ms=data.get("generation_time_ms", 0.0),
                prompt_tokens=data.get("prompt_tokens", 0),
                completion_tokens=data.get("completion_tokens", 0),
                response_length=data.get("response_length", 0),
            )
            
            db.add(log)
            await db.commit()
            await db.refresh(log)
            return log
        except Exception as e:
            logger.exception("Failed to save request log: %s", e)
            return None

    async def get_logs(
        self,
        db: AsyncSession,
    ) -> list[RequestLog]:
        """Retrieve all request logs from the database."""
        try:
            result = await db.execute(select(RequestLog))
            return list(result.scalars().all())
        except Exception as e:
            logger.exception("Failed to retrieve request logs: %s", e)
            return []

    async def delete_logs(
        self,
        db: AsyncSession,
    ) -> None:
        """Delete all request logs from the database."""
        try:
            result = await db.execute(select(RequestLog))
            logs = result.scalars().all()

            for log in logs:
                await db.delete(log)

            await db.commit()
        except Exception as e:
            logger.exception("Failed to delete request logs: %s", e)


database_service = DatabaseService()