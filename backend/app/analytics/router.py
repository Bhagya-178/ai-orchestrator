"""
API Router for Telemetry, Token Consumption, and Cost Analytics.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_optional_user
from app.database.session import get_db
from app.database.models import User
from app.analytics.metrics_aggregator import analytics_aggregator

router = APIRouter(prefix="/analytics", tags=["Telemetry & Analytics"])


@router.get("/overview")
async def get_analytics_overview(
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve aggregate usage, tokens, turns, and cost estimate."""
    # If admin or unauthenticated guest, show global overview; if user, show their own
    uid = None if (not current_user or current_user.role == "admin") else current_user.id
    return await analytics_aggregator.get_overview(db, user_id=uid)


@router.get("/models")
async def get_model_analytics(
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve usage breakdown and token distribution grouped by model."""
    uid = None if (not current_user or current_user.role == "admin") else current_user.id
    return await analytics_aggregator.get_model_distribution(db, user_id=uid)


@router.get("/system")
async def get_system_telemetry(
    current_user: User | None = Depends(get_optional_user),
):
    """Retrieve live host CPU, memory, process footprint, and database pool telemetry."""
    return await analytics_aggregator.get_system_telemetry()
