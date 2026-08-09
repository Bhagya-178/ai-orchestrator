"""
Conversation memory persisted to PostgreSQL.

History survives server restarts and can be reloaded for any session.
All methods are async and take the request's DB session.

Future (Phase 2/3) growth lives here: summarization of old turns and
retrieval of relevant context can extend get_history() without the
pipeline changing.
"""

from sqlalchemy import delete, select

from app.database.models import ConversationMessage


class MemoryService:

    async def get_history(self, db, session_id: str) -> list[dict]:
        """Return this session's messages as [{"role", "content"}, ...]."""
        if db is None:
            return []

        result = await db.execute(
            select(ConversationMessage)
            .where(ConversationMessage.session_id == session_id)
            .order_by(ConversationMessage.id)
        )

        return [
            {"role": row.role, "content": row.content}
            for row in result.scalars().all()
        ]

    async def add_message(self, db, session_id: str, role: str, content: str) -> None:
        """Persist one message for a session."""
        if db is None:
            return

        db.add(ConversationMessage(session_id=session_id, role=role, content=content))
        await db.commit()

    async def clear_history(self, db, session_id: str) -> None:
        """Delete all messages for a session."""
        if db is None:
            return

        await db.execute(
            delete(ConversationMessage).where(
                ConversationMessage.session_id == session_id
            )
        )
        await db.commit()


memory_service = MemoryService()
