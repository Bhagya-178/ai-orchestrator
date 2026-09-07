"""
Telemetry, Token Consumption and Cost Analytics Aggregator.
"""

import asyncio
import os
import psutil
from typing import Any
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import RequestLog, ConversationMessage, User
from app.database.database import get_engine

# Standard token cost estimations per 1M tokens (for analytical forecasting)
MODEL_COST_RATES = {
    "qwen2.5:1.5b": {"input_per_m": 0.10, "output_per_m": 0.20},
    "qwen3:8b": {"input_per_m": 0.50, "output_per_m": 1.00},
    "default": {"input_per_m": 0.30, "output_per_m": 0.60},
}


class AnalyticsAggregator:
    """Aggregates platform telemetry, token usage, cost projections, and system health."""

    async def get_overview(self, db: AsyncSession, user_id: str | None = None) -> dict[str, Any]:
        """Aggregate total requests, tokens, turns, and cost estimate."""
        base_query = select(
            func.count(RequestLog.id).label("total_requests"),
            func.coalesce(func.sum(RequestLog.prompt_tokens), 0).label("total_tokens_in"),
            func.coalesce(func.sum(RequestLog.completion_tokens), 0).label("total_tokens_out"),
            func.coalesce(func.avg(RequestLog.total_latency_ms), 0).label("avg_latency_ms"),
        )
        if user_id:
            base_query = base_query.where(RequestLog.user_id == user_id)

        res = await db.execute(base_query)
        row = res.one()

        tokens_in = int(row.total_tokens_in)
        tokens_out = int(row.total_tokens_out)
        total_tokens = tokens_in + tokens_out

        # Cost calculation based on average rates
        rate = MODEL_COST_RATES["default"]
        est_cost = (tokens_in / 1_000_000 * rate["input_per_m"]) + (tokens_out / 1_000_000 * rate["output_per_m"])

        # Count active conversations
        conv_query = select(func.count(ConversationMessage.id))
        conv_res = await db.execute(conv_query)
        total_messages = conv_res.scalar_one_or_none() or 0

        return {
            "total_requests": int(row.total_requests),
            "total_tokens": total_tokens,
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "total_messages": int(total_messages),
            "avg_latency_ms": round(float(row.avg_latency_ms), 2),
            "estimated_cost_usd": round(est_cost, 4),
        }

    async def get_model_distribution(self, db: AsyncSession, user_id: str | None = None) -> list[dict[str, Any]]:
        """Return usage breakdown grouped by model name."""
        query = (
            select(
                RequestLog.target_model.label("model_used"),
                func.count(RequestLog.id).label("request_count"),
                func.coalesce(func.sum(RequestLog.prompt_tokens), 0).label("tokens_in"),
                func.coalesce(func.sum(RequestLog.completion_tokens), 0).label("tokens_out"),
            )
            .group_by(RequestLog.target_model)
            .order_by(desc("request_count"))
        )
        if user_id:
            query = query.where(RequestLog.user_id == user_id)

        res = await db.execute(query)
        models = []
        for row in res.all():
            m_name = row.model_used or "unknown"
            t_in = int(row.tokens_in)
            t_out = int(row.tokens_out)
            rates = MODEL_COST_RATES.get(m_name, MODEL_COST_RATES["default"])
            cost = (t_in / 1_000_000 * rates["input_per_m"]) + (t_out / 1_000_000 * rates["output_per_m"])

            models.append({
                "model": m_name,
                "request_count": int(row.request_count),
                "total_tokens": t_in + t_out,
                "tokens_in": t_in,
                "tokens_out": t_out,
                "estimated_cost_usd": round(cost, 4),
            })

        return models

    async def get_system_telemetry(self) -> dict[str, Any]:
        """Collect live host and runtime process statistics."""
        def _get_cpu():
            return psutil.cpu_percent(interval=0.1)

        cpu_usage = await asyncio.to_thread(_get_cpu)
        mem = psutil.virtual_memory()
        proc = psutil.Process(os.getpid())
        proc_mem = proc.memory_info()

        # Database pool metrics
        engine = get_engine()
        pool = engine.pool
        pool_stats = {
            "size": pool.size(),
            "checkedin": pool.checkedin(),
            "checkedout": pool.checkedout(),
            "overflow": pool.overflow(),
        }

        return {
            "cpu_percent": cpu_usage,
            "memory_total_gb": round(mem.total / (1024**3), 2),
            "memory_used_gb": round(mem.used / (1024**3), 2),
            "memory_percent": mem.percent,
            "process_rss_mb": round(proc_mem.rss / (1024**2), 2),
            "db_pool": pool_stats,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


analytics_aggregator = AnalyticsAggregator()
