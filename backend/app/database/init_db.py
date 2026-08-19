import asyncio
import logging

from sqlalchemy import inspect as sa_inspect

from app.database.database import engine, Base
from app.database import models  # noqa: F401 — registers models with Base

logger = logging.getLogger(__name__)

# Tables that must exist before the app is considered initialised.
_REQUIRED_TABLES = frozenset(Base.metadata.tables.keys())


async def init_db():
    """Create database tables only when they are missing."""

    async with engine.connect() as conn:
        existing = await conn.run_sync(
            lambda sync_conn: set(sa_inspect(sync_conn).get_table_names())
        )

    missing = _REQUIRED_TABLES - existing

    if not missing:
        logger.info("All database tables already exist — skipping creation.")
        return

    logger.info("Missing tables %s — running create_all …", missing)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created successfully.")


if __name__ == "__main__":
    asyncio.run(init_db())