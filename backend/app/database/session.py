"""
FastAPI dependency that yields a database session per request.

Rolls back the transaction on unhandled exceptions to prevent
corrupted/dangling transactions from leaking back into the pool.
"""

import logging

from app.database.database import get_session_factory

logger = logging.getLogger(__name__)


async def get_db():
    """Yield an AsyncSession; rollback on error, close on exit."""
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            logger.exception("Database session rolled back due to unhandled error")
            raise