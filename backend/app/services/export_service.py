"""
Conversation export service.
Formats chat history into clean, portable Markdown (.md) and JSON documents.
"""

from datetime import datetime, timezone
from typing import Any
from app.database.models import Conversation, ConversationMessage


class ExportService:
    """Handles formatting of conversation histories into exportable documents."""

    @staticmethod
    def to_markdown(conversation: Conversation, messages: list[ConversationMessage]) -> str:
        created_str = conversation.created_at.strftime("%Y-%m-%d %H:%M:%S UTC") if conversation.created_at else "N/A"
        
        md_lines = [
            f"# {conversation.title}",
            "",
            f"- **Date**: {created_str}",
            f"- **Session ID**: `{conversation.id}`",
            f"- **Model Intent**: `{conversation.intent_override}`",
            f"- **Effort Level**: `{conversation.effort_level}`",
            "",
            "---",
            "",
        ]

        for msg in messages:
            role_header = "### 👤 User" if msg.role == "user" else "### 🤖 Assistant"
            md_lines.append(role_header)
            md_lines.append("")
            md_lines.append(msg.content.strip())
            md_lines.append("")
            md_lines.append("---")
            md_lines.append("")

        return "\n".join(md_lines)

    @staticmethod
    def to_json_dict(conversation: Conversation, messages: list[ConversationMessage]) -> dict[str, Any]:
        return {
            "id": conversation.id,
            "title": conversation.title,
            "intent_override": conversation.intent_override,
            "effort_level": conversation.effort_level,
            "is_pinned": bool(conversation.is_pinned),
            "system_prompt": conversation.system_prompt or "",
            "created_at": conversation.created_at.isoformat() if conversation.created_at else "",
            "updated_at": conversation.updated_at.isoformat() if conversation.updated_at else "",
            "messages": [
                {
                    "id": msg.id,
                    "role": msg.role,
                    "content": msg.content,
                    "created_at": msg.created_at.isoformat() if msg.created_at else "",
                }
                for msg in messages
            ],
        }


export_service = ExportService()
