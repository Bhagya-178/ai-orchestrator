"""
Async SQLAlchemy engine and session factory.

The engine is created lazily on first use (not at import time) so that
import errors from a missing DATABASE_URL don't crash unrelated modules.
"""

import logging
from typing import TYPE_CHECKING

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncEngine

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lazy engine singleton
# ---------------------------------------------------------------------------
_engine: "AsyncEngine | None" = None


def get_engine() -> "AsyncEngine":
    """Return the shared async engine, creating it on first call."""
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            settings.DATABASE_URL,
            echo=False,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,
            pool_recycle=1800,
        )
        logger.info("Database engine created (pool_size=5, max_overflow=10)")
    return _engine


# ---------------------------------------------------------------------------
# Session factory — binds to the lazy engine
# ---------------------------------------------------------------------------
def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Return a session factory bound to the shared engine."""
    return async_sessionmaker(
        bind=get_engine(),
        class_=AsyncSession,
        expire_on_commit=False,
    )


# Backward-compatible alias used by session.py and init_db.py.
# Accessing this triggers engine creation, which is fine at startup.
engine = property(lambda self: get_engine())  # type: ignore[arg-type]


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""
