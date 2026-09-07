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


async def init_db(max_retries: int = 15, delay: float = 2.0) -> None:
    """Create database tables only when they are missing, with connection retries for Docker startup."""
    engine = get_engine()

    existing: set[str] = set()
    for attempt in range(1, max_retries + 1):
        try:
            async with engine.connect() as conn:
                existing = await conn.run_sync(
                    lambda sync_conn: set(sa_inspect(sync_conn).get_table_names())
                )
            break
        except Exception as e:
            if attempt == max_retries:
                logger.error("Failed to connect to database after %d attempts: %s", max_retries, e)
                raise
            logger.warning(
                "Database not ready yet (attempt %d/%d): %s. Retrying in %.1fs...",
                attempt,
                max_retries,
                e,
                delay,
            )
            await asyncio.sleep(delay)

    missing = _REQUIRED_TABLES - existing

    if missing:
        logger.info("Missing tables %s — running create_all …", missing)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created successfully.")
    else:
        logger.info("All database tables already exist — skipping creation.")

    # Auto-migrations for backward compatibility and Auth integration
    try:
        from sqlalchemy import text
        from app.auth.security import hash_password

        async with engine.begin() as conn:
            # Users table
            await conn.execute(
                text("""
                CREATE TABLE IF NOT EXISTS users (
                    id VARCHAR PRIMARY KEY,
                    email VARCHAR UNIQUE NOT NULL,
                    hashed_password VARCHAR NOT NULL,
                    full_name VARCHAR DEFAULT '',
                    role VARCHAR DEFAULT 'user',
                    is_active BOOLEAN DEFAULT TRUE,
                    custom_instructions TEXT DEFAULT '',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                """)
            )

            # Refresh tokens table
            await conn.execute(
                text("""
                CREATE TABLE IF NOT EXISTS refresh_tokens (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
                    token_hash VARCHAR UNIQUE NOT NULL,
                    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                """)
            )

            # Request logs additions
            await conn.execute(
                text("ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS session_id VARCHAR;")
            )
            await conn.execute(
                text("ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL;")
            )

            # Conversations table & columns
            await conn.execute(
                text("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id VARCHAR PRIMARY KEY,
                    user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
                    title VARCHAR DEFAULT 'New Conversation',
                    intent_override VARCHAR DEFAULT 'auto',
                    effort_level VARCHAR DEFAULT 'medium',
                    is_pinned BOOLEAN DEFAULT FALSE,
                    system_prompt TEXT DEFAULT '',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                """)
            )
            await conn.execute(
                text("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE;")
            )
            await conn.execute(
                text("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS intent_override VARCHAR DEFAULT 'auto';")
            )
            await conn.execute(
                text("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS effort_level VARCHAR DEFAULT 'medium';")
            )
            await conn.execute(
                text("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;")
            )
            await conn.execute(
                text("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS system_prompt TEXT DEFAULT '';")
            )

            # Documents table user_id
            await conn.execute(
                text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE;")
            )

            # Workspaces, Workspace Members, and Audit Logs
            await conn.execute(
                text("""
                CREATE TABLE IF NOT EXISTS workspaces (
                    id VARCHAR PRIMARY KEY,
                    name VARCHAR NOT NULL,
                    slug VARCHAR UNIQUE NOT NULL,
                    description VARCHAR DEFAULT '',
                    owner_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
                    settings JSONB DEFAULT '{}',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                """)
            )
            await conn.execute(
                text("""
                CREATE TABLE IF NOT EXISTS workspace_members (
                    id SERIAL PRIMARY KEY,
                    workspace_id VARCHAR REFERENCES workspaces(id) ON DELETE CASCADE,
                    user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
                    role VARCHAR DEFAULT 'member',
                    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                """)
            )
            await conn.execute(
                text("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id SERIAL PRIMARY KEY,
                    workspace_id VARCHAR,
                    user_id VARCHAR,
                    action VARCHAR NOT NULL,
                    resource_type VARCHAR,
                    resource_id VARCHAR,
                    details JSONB DEFAULT '{}',
                    ip_address VARCHAR,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                """)
            )

            # API Keys table
            await conn.execute(
                text("""
                CREATE TABLE IF NOT EXISTS api_keys (
                    id VARCHAR PRIMARY KEY,
                    user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
                    name VARCHAR NOT NULL,
                    key_prefix VARCHAR(16) NOT NULL,
                    key_hash VARCHAR(64) UNIQUE NOT NULL,
                    scopes JSONB DEFAULT '[]',
                    is_active BOOLEAN DEFAULT TRUE,
                    last_used_at TIMESTAMP WITH TIME ZONE,
                    expires_at TIMESTAMP WITH TIME ZONE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                """)
            )

            # Webhook Endpoints table
            await conn.execute(
                text("""
                CREATE TABLE IF NOT EXISTS webhook_endpoints (
                    id VARCHAR PRIMARY KEY,
                    user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
                    url VARCHAR NOT NULL,
                    secret VARCHAR NOT NULL,
                    events JSONB DEFAULT '[]',
                    description VARCHAR DEFAULT '',
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                """)
            )

            # Webhook Deliveries table
            await conn.execute(
                text("""
                CREATE TABLE IF NOT EXISTS webhook_deliveries (
                    id SERIAL PRIMARY KEY,
                    webhook_id VARCHAR REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
                    event_type VARCHAR NOT NULL,
                    payload JSONB DEFAULT '{}',
                    response_status INTEGER,
                    response_body TEXT,
                    duration_ms FLOAT DEFAULT 0.0,
                    success BOOLEAN DEFAULT FALSE,
                    error_message TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                """)
            )

            # Evaluation Runs table
            await conn.execute(
                text("""
                CREATE TABLE IF NOT EXISTS evaluation_runs (
                    id VARCHAR PRIMARY KEY,
                    user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
                    dataset_name VARCHAR NOT NULL,
                    model_name VARCHAR NOT NULL,
                    judge_model VARCHAR NOT NULL,
                    total_test_cases INTEGER DEFAULT 0,
                    passed_cases INTEGER DEFAULT 0,
                    summary_scores JSONB DEFAULT '{}',
                    detailed_results JSONB DEFAULT '[]',
                    duration_seconds FLOAT DEFAULT 0.0,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                """)
            )

            # Seed default admin user if no users exist
            check_user = await conn.execute(text("SELECT id FROM users LIMIT 1;"))
            row = check_user.fetchone()
            admin_id = "admin-default-uuid"
            if not row:
                admin_pw_hash = hash_password("admin123")
                await conn.execute(
                    text("""
                    INSERT INTO users (id, email, hashed_password, full_name, role, is_active)
                    VALUES (:id, :email, :pwd, :name, 'admin', TRUE)
                    ON CONFLICT (email) DO NOTHING;
                    """),
                    {"id": admin_id, "email": "admin@local.host", "pwd": admin_pw_hash, "name": "Local Admin"}
                )
                logger.info("Created default administrator user: admin@local.host (password: admin123)")
            else:
                admin_id = row[0]

            # Backfill existing session IDs from conversation_messages into conversations with real titles
            await conn.execute(
                text("""
                INSERT INTO conversations (id, user_id, title, intent_override, effort_level, created_at, updated_at)
                SELECT 
                    cm.session_id, 
                    :admin_id, 
                    COALESCE(
                        (
                            SELECT SUBSTRING(content FROM 1 FOR 45) 
                            FROM conversation_messages 
                            WHERE session_id = cm.session_id AND role = 'user' AND content IS NOT NULL AND TRIM(content) != '' 
                            ORDER BY created_at ASC NULLS LAST, id ASC 
                            LIMIT 1
                        ),
                        'New Conversation'
                    ),
                    'auto', 
                    'medium', 
                    COALESCE(MIN(cm.created_at), NOW()), 
                    COALESCE(MAX(cm.created_at), NOW())
                FROM conversation_messages cm
                WHERE cm.session_id NOT IN (SELECT id FROM conversations)
                GROUP BY cm.session_id
                ON CONFLICT (id) DO NOTHING;
                """),
                {"admin_id": admin_id}
            )

            # Repair any conversations whose titles were previously set to generic defaults
            await conn.execute(
                text("""
                UPDATE conversations c
                SET title = SUBSTRING(first_msg.content FROM 1 FOR 45)
                FROM (
                    SELECT DISTINCT ON (session_id) session_id, content
                    FROM conversation_messages
                    WHERE role = 'user' AND content IS NOT NULL AND TRIM(content) != ''
                    ORDER BY session_id, created_at ASC NULLS LAST, id ASC
                ) first_msg
                WHERE c.id = first_msg.session_id 
                  AND (c.title IS NULL OR c.title = 'New Conversation' OR c.title = 'New Chat' OR c.title = '');
                """)
            )

            # Assign any orphaned conversations and documents to admin
            await conn.execute(
                text("UPDATE conversations SET user_id = :admin_id WHERE user_id IS NULL;"),
                {"admin_id": admin_id}
            )
            await conn.execute(
                text("UPDATE documents SET user_id = :admin_id WHERE user_id IS NULL;"),
                {"admin_id": admin_id}
            )

        logger.info("Checked column and table migrations successfully with Auth and User Isolation.")
    except Exception as e:
        logger.warning("Auto-migration check skipped or failed: %s", e)


if __name__ == "__main__":
    asyncio.run(init_db())