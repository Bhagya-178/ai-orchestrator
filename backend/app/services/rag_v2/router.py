"""
API Router for Hybrid RAG 2.0, Document Collections, and Chunk Inspection.
"""

from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth.dependencies import get_optional_user
from app.database.models import User
from app.services.rag_v2.hybrid_search import hybrid_rag_service
from app.services.rag_v2.collections import collection_manager
from app.services.rag_service import rag_service

router = APIRouter(prefix="/rag/v2", tags=["Hybrid RAG 2.0"])


class HybridSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    limit: int = Field(default=5, ge=1, le=20)
    collection_id: str | None = None
    session_id: str | None = None


class CreateCollectionRequest(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = ""
    color: str = "#3b82f6"


class AddDocumentToCollectionRequest(BaseModel):
    document_id: str


@router.post("/search")
async def perform_hybrid_search(
    body: HybridSearchRequest,
    current_user: User | None = Depends(get_optional_user),
):
    """
    Perform hybrid vector + BM25 keyword search with Reciprocal Rank Fusion (RRF).
    """
    doc_filter = None
    if body.collection_id:
        doc_filter = collection_manager.get_collection_documents(body.collection_id)

    hits = await hybrid_rag_service.search(
        query=body.query,
        limit=body.limit,
        session_id=body.session_id,
        document_ids=doc_filter,
    )
    return {
        "query": body.query,
        "total_hits": len(hits),
        "results": hits,
    }


@router.get("/collections")
async def list_collections(
    current_user: User | None = Depends(get_optional_user),
):
    """List all knowledge base collections."""
    return collection_manager.list_collections()


@router.post("/collections")
async def create_collection(
    body: CreateCollectionRequest,
    current_user: User | None = Depends(get_optional_user),
):
    """Create a new knowledge base collection."""
    return collection_manager.create_collection(
        name=body.name,
        description=body.description,
        color=body.color,
    )


@router.post("/collections/{collection_id}/documents")
async def add_document_to_collection(
    collection_id: str,
    body: AddDocumentToCollectionRequest,
    current_user: User | None = Depends(get_optional_user),
):
    """Add an existing document into a collection."""
    ok = collection_manager.add_document_to_collection(collection_id, body.document_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Collection not found")
    return {"status": "added", "collection_id": collection_id, "document_id": body.document_id}


@router.get("/documents/{document_id}/chunks")
async def inspect_document_chunks(
    document_id: str,
    current_user: User | None = Depends(get_optional_user),
):
    """Inspect raw chunks, token lengths, and metadata of an ingested document."""
    try:
        chunks = await rag_service.get_raw_chunks(document_id)
        return {
            "document_id": document_id,
            "total_chunks": len(chunks),
            "chunks": chunks,
        }
    except Exception as ex:
        raise HTTPException(status_code=500, detail=f"Failed retrieving chunks: {str(ex)}")
