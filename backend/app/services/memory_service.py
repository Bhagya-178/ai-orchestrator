"""
Conversation memory persisted to PostgreSQL.

History survives server restarts and can be reloaded for any session.
All methods are async and take the request's DB session.

Phase 2 (summarization) lives here:
  - maybe_summarize() folds the oldest turns of a long session into a
    rolling SessionSummary and prunes the raw rows, keeping the model
    context bounded.
  - get_history() returns the summary (as a system message) plus the most
    recent raw messages. Before any summarization happens it returns the
    full history untouched, so no context is ever silently dropped.
"""
import logging

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database.models import ConversationMessage, SessionSummary
from app.ollama_client import ollama

logger = logging.getLogger(__name__)

_SUMMARY_SYSTEM_PROMPT = (
    "You maintain a rolling summary of a conversation. The user gives you the "
    "previous summary (if any) followed by the newest messages. Merge them into "
    "ONE updated summary. Keep it concise but preserve: the user's name, facts, "
    "preferences and goals, key decisions, unresolved questions, and anything "
    "needed to answer future follow-ups. Write in the same language as the "
    "conversation."
)


class MemoryService:
    """Service to handle conversation memory and rolling summarization."""

    async def get_history(self, db: AsyncSession, session_id: str) -> list[dict]:
        """Return this session's messages as [{"role", "content"}, ...].

        Once a rolling summary exists, it is prepended as a system message
        and only the most recent MAX_RAW_MESSAGES raw messages are
        returned. Before any summarization, the full history is returned.
        """
        if db is None:
            return []

        summary = await self.get_summary(db, session_id)

        result = await db.execute(
            select(ConversationMessage)
            .where(ConversationMessage.session_id == session_id)
            .order_by(ConversationMessage.id)
        )
        rows = result.scalars().all()

        if summary and len(rows) > settings.MAX_RAW_MESSAGES:
            rows = rows[-settings.MAX_RAW_MESSAGES:]

        messages = [
            {"role": row.role, "content": row.content}
            for row in rows
        ]

        if summary:
            messages.insert(
                0,
                {
                    "role": "system",
                    "content": f"Summary of the earlier conversation: {summary}",
                },
            )

        return messages

    async def add_message(self, db: AsyncSession, session_id: str, role: str, content: str) -> None:
        """Persist one message for a session."""
        if db is None:
            return

        db.add(ConversationMessage(session_id=session_id, role=role, content=content))
        await db.commit()

    async def clear_history(self, db: AsyncSession, session_id: str) -> None:
        """Delete all messages and the rolling summary for a session."""
        if db is None:
            return

        await db.execute(
            delete(ConversationMessage).where(
                ConversationMessage.session_id == session_id
            )
        )
        await db.execute(
            delete(SessionSummary).where(
                SessionSummary.session_id == session_id
            )
        )
        await db.commit()

    # ------------------------------------------------------------------
    # Phase 2: rolling summarization
    # ------------------------------------------------------------------

    async def get_summary(self, db: AsyncSession, session_id: str) -> str | None:
        """Return the rolling summary for a session, or None."""
        if db is None:
            return None

        result = await db.execute(
            select(SessionSummary).where(SessionSummary.session_id == session_id)
        )
        row = result.scalars().first()
        return row.summary if row else None

    async def save_summary(
        self,
        db: AsyncSession,
        session_id: str,
        summary: str,
        last_summarized_message_id: int,
    ) -> None:
        """Upsert the rolling summary for a session."""
        if db is None:
            return

        result = await db.execute(
            select(SessionSummary).where(SessionSummary.session_id == session_id)
        )
        row = result.scalars().first()

        if row is None:
            db.add(
                SessionSummary(
                    session_id=session_id,
                    summary=summary,
                    last_summarized_message_id=last_summarized_message_id,
                )
            )
        else:
            row.summary = summary
            row.last_summarized_message_id = last_summarized_message_id

        await db.commit()

    async def maybe_summarize(self, db: AsyncSession, session_id: str) -> None:
        """Fold the oldest turns into a rolling summary once the session grows.

        No-op below SUMMARIZE_THRESHOLD messages, and a no-op if the
        summarizer model call fails — the session keeps its raw history and
        nothing is pruned. Never raises into the pipeline.
        """
        if db is None:
            return

        result = await db.execute(
            select(ConversationMessage)
            .where(ConversationMessage.session_id == session_id)
            .order_by(ConversationMessage.id)
        )
        rows = list(result.scalars().all())

        if len(rows) <= settings.SUMMARIZE_THRESHOLD:
            return

        # Keep the most recent raw messages; fold everything older.
        to_summarize = rows[:-settings.MAX_RAW_MESSAGES]
        if not to_summarize:
            return

        last_summarized_id = to_summarize[-1].id

        transcript = "\\n".join(
            f"{row.role.capitalize()}: {row.content}"
            for row in to_summarize
        )
        previous = await self.get_summary(db, session_id) or "(none)"

        await self._do_summarize(db, session_id, previous, transcript, to_summarize, last_summarized_id)

    async def _do_summarize(self, db: AsyncSession, session_id: str, previous: str, transcript: str, to_summarize: list, last_summarized_id: int) -> None:
        """Performs the actual summarization and database update."""
        try:
            response = await ollama.chat(
                model=settings.SUMMARY_MODEL,
                messages=[
                    {"role": "system", "content": _SUMMARY_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": (
                            f"PREVIOUS SUMMARY:\\n{previous}\\n\\n"
                            f"NEW MESSAGES:\\n{transcript}\\n\\n"
                            f"UPDATED SUMMARY:"
                        ),
                    },
                ],
            )
        except Exception as e:
            # Summarizer unavailable or failed? Keep the raw history; never fail the turn.
            logger.exception("Failed to summarize conversation history. Error: %s", e)
            return
        finally:
            # Unload summary model to free VRAM/RAM on RTX 4050
            try:
                await ollama.unload_model(settings.SUMMARY_MODEL)
            except Exception as unload_e:
                logger.warning("Failed to unload summary model: %s", unload_e)

        summary = response.get("message", {}).get("content", "").strip()
        if not summary:
            return

        try:
            await self.save_summary(db, session_id, summary, last_summarized_id)

            # Prune the folded rows so the table stays bounded.
            await db.execute(
                delete(ConversationMessage).where(
                    ConversationMessage.session_id == session_id,
                    ConversationMessage.id.in_(
                        [row.id for row in to_summarize]
                    ),
                )
            )
            await db.commit()
        except Exception as db_e:
            logger.exception("Database error while saving summary: %s", db_e)

memory_service = MemoryService()
