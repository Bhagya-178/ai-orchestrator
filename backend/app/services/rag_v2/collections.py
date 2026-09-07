"""
Knowledge Base Collections and Tagging Management.
Enables grouping documents into logical collections (e.g. 'Engineering Docs', 'Legal', 'Financial Reports')
and filtering retrieval by collection.
"""

from typing import Any
from datetime import datetime, timezone
import uuid


class CollectionManager:
    """Manages document collections and category tagging in memory and metadata."""

    def __init__(self):
        self._collections: dict[str, dict[str, Any]] = {
            "default": {
                "id": "default",
                "name": "General Knowledge",
                "description": "Default repository for uploaded files and documents.",
                "color": "#3b82f6",
                "document_ids": [],
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        }

    def create_collection(self, name: str, description: str = "", color: str = "#3b82f6") -> dict[str, Any]:
        cid = str(uuid.uuid4())
        col = {
            "id": cid,
            "name": name,
            "description": description,
            "color": color,
            "document_ids": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self._collections[cid] = col
        return col

    def list_collections(self) -> list[dict[str, Any]]:
        return list(self._collections.values())

    def add_document_to_collection(self, collection_id: str, document_id: str) -> bool:
        col = self._collections.get(collection_id)
        if not col:
            return False
        if document_id not in col["document_ids"]:
            col["document_ids"].append(document_id)
        return True

    def remove_document_from_collection(self, collection_id: str, document_id: str) -> bool:
        col = self._collections.get(collection_id)
        if not col:
            return False
        if document_id in col["document_ids"]:
            col["document_ids"].remove(document_id)
        return True

    def get_collection_documents(self, collection_id: str) -> list[str]:
        col = self._collections.get(collection_id)
        return col["document_ids"] if col else []


collection_manager = CollectionManager()
