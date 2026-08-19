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

from sqlalchemy import delete, select

from app.config import SUMMARY_MODEL
from app.database.models import ConversationMessage, SessionSummary
from app.ollama_client import ollama

# Once a session holds more than this many messages, the oldest turns are
# folded into a rolling summary instead of being sent raw to the model.
HISTORY_SUMMARIZE_AFTER = 20

# How many most-recent raw messages stay alongside the summary.
HISTORY_RECENT_MESSAGES = 8

_SUMMARY_SYSTEM_PROMPT = (
    "You maintain a rolling summary of a conversation. The user gives you the "
    "previous summary (if any) followed by the newest messages. Merge them into "
    "ONE updated summary. Keep it concise but preserve: the user's name, facts, "
    "preferences and goals, key decisions, unresolved questions, and anything "
    "needed to answer future follow-ups. Write in the same language as the "
    "conversation."
)


class MemoryService:

    async def get_history(self, db, session_id: str) -> list[dict]:
        """Return this session's messages as [{"role", "content"}, ...].

        Once a rolling summary exists, it is prepended as a system message
        and only the most recent HISTORY_RECENT_MESSAGES raw messages are
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

        if summary and len(rows) > HISTORY_RECENT_MESSAGES:
            rows = rows[-HISTORY_RECENT_MESSAGES:]

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

    async def add_message(self, db, session_id: str, role: str, content: str) -> None:
        """Persist one message for a session."""
        if db is None:
            return

        db.add(ConversationMessage(session_id=session_id, role=role, content=content))
        await db.commit()

    async def clear_history(self, db, session_id: str) -> None:
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

    async def get_summary(self, db, session_id: str) -> str | None:
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
        db,
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

    async def maybe_summarize(self, db, session_id: str) -> None:
        """Fold the oldest turns into a rolling summary once the session grows.

        No-op below HISTORY_SUMMARIZE_AFTER messages, and a no-op if the
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
        rows = result.scalars().all()

        if len(rows) <= HISTORY_SUMMARIZE_AFTER:
            return

        # Keep the most recent raw messages; fold everything older.
        to_summarize = rows[:-HISTORY_RECENT_MESSAGES]
        if not to_summarize:
            return

        last_summarized_id = to_summarize[-1].id

        transcript = "\n".join(
            f"{row.role.capitalize()}: {row.content}"
            for row in to_summarize
        )
        previous = await self.get_summary(db, session_id) or "(none)"

        try:
            response = await ollama.chat(
                model=SUMMARY_MODEL,
                messages=[
                    {"role": "system", "content": _SUMMARY_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": (
                            f"PREVIOUS SUMMARY:\n{previous}\n\n"
                            f"NEW MESSAGES:\n{transcript}\n\n"
                            f"UPDATED SUMMARY:"
                        ),
                    },
                ],
            )
        except Exception:
            # Summarizer unavailable? Keep the raw history; never fail the turn.
            return
        finally:
            # Unload summary model to free VRAM/RAM on RTX 4050
            try:
                await ollama.unload_model(SUMMARY_MODEL)
            except Exception:
                pass

        summary = response.get("message", {}).get("content", "").strip()
        if not summary:
            return

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


memory_service = MemoryService()
