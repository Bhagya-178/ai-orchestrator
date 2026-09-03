"""
Create database tables only when they are missing.

This uses SQLAlchemy's create_all — it creates missing tables but does NOT
handle column-level migrations. For schema changes on existing tables,
use Alembic.
"""

import asyncio
import logging

from sqlalchemy import inspect as sa_inspect

from app.database import models  # noqa: F401 — registers models with Base
from app.database.database import Base, get_engine

logger = logging.getLogger(__name__)

# Tables that must exist before the app is considered initialised.
_REQUIRED_TABLES = frozenset(Base.metadata.tables.keys())


async def init_db() -> None:
    """Create database tables only when they are missing."""
    engine = get_engine()

    async with engine.connect() as conn:
        existing = await conn.run_sync(
            lambda sync_conn: set(sa_inspect(sync_conn).get_table_names())
        )

    missing = _REQUIRED_TABLES - existing

    if missing:
        logger.info("Missing tables %s — running create_all …", missing)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created successfully.")
    else:
        logger.info("All database tables already exist — skipping creation.")

    # Column-level auto migrations for backward compatibility
    try:
        from sqlalchemy import text
        async with engine.begin() as conn:
            await conn.execute(
                text("ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS session_id VARCHAR;")
            )
        logger.info("Checked column migrations successfully.")
    except Exception as e:
        logger.warning("Auto-migration check skipped or failed: %s", e)


if __name__ == "__main__":
    asyncio.run(init_db())