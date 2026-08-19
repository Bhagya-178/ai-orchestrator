from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import RequestLog


class DatabaseService:

    async def save_request_log(
        self,
        db: AsyncSession,
        data: dict,
    ):

        log = RequestLog(

            question=data["question"],
            optimized_prompt=data["optimized_prompt"],

            intent=data["intent"],
            task_type=data.get("task_type"),
            intent_confidence=data.get("intent_confidence"),
            entities=data.get("entities"),
            processor_reason=data.get("processor_reason"),

            processor_model=data["processor_model"],
            target_model=data["target_model"],

            processor_latency_ms=data["processor_latency_ms"],
            routing_latency_ms=data["routing_latency_ms"],
            generation_latency_ms=data["generation_latency_ms"],
            total_latency_ms=data["total_latency_ms"],

            cpu_percent=data["cpu_percent"],
            tokens_per_second=data["tokens_per_second"],

            context_tokens=data["context_tokens"],
            context_window=data["context_window"],
            context_usage_percent=data["context_usage_percent"],

            model_load_time_ms=data["model_load_time_ms"],
            prompt_eval_time_ms=data["prompt_eval_time_ms"],
            generation_time_ms=data["generation_time_ms"],

            prompt_tokens=data["prompt_tokens"],
            completion_tokens=data["completion_tokens"],

            response_length=data["response_length"],
        )

        db.add(log)

        await db.commit()

        await db.refresh(log)

        return log

    async def get_logs(
        self,
        db: AsyncSession,
    ):

        result = await db.execute(
            select(RequestLog)
        )

        return result.scalars().all()

    async def delete_logs(
        self,
        db: AsyncSession,
    ):

        result = await db.execute(
            select(RequestLog)
        )

        logs = result.scalars().all()

        for log in logs:
            await db.delete(log)

        await db.commit()


database_service = DatabaseService()