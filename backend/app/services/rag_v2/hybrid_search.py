"""
Hybrid Search Service combining Dense Vector Search (Qdrant) and Sparse Lexical Search (BM25)
using Reciprocal Rank Fusion (RRF) and Cross-Scoring.
"""

from typing import Any
from app.services.rag_service import rag_service
from app.services.rag_v2.bm25_index import bm25_index


def reciprocal_rank_fusion(
    dense_results: list[dict[str, Any]],
    sparse_results: list[dict[str, Any]],
    k: int = 60,
    top_n: int = 10,
) -> list[dict[str, Any]]:
    """
    Combine dense and sparse ranking lists using Reciprocal Rank Fusion (RRF).
    Formula: RRF_score(d) = sum(1 / (k + rank(d)))
    """
    rrf_scores: dict[str, float] = {}
    chunk_data: dict[str, dict[str, Any]] = {}
    dense_ranks: dict[str, int] = {}
    sparse_ranks: dict[str, int] = {}

    # Dense ranks
    for rank, item in enumerate(dense_results, 1):
        cid = str(item.get("id") or item.get("chunk_id"))
        rrf_scores[cid] = rrf_scores.get(cid, 0.0) + (1.0 / (k + rank))
        chunk_data[cid] = item
        dense_ranks[cid] = rank

    # Sparse ranks
    for rank, item in enumerate(sparse_results, 1):
        cid = str(item.get("chunk_id") or item.get("id"))
        rrf_scores[cid] = rrf_scores.get(cid, 0.0) + (1.0 / (k + rank))
        sparse_ranks[cid] = rank
        if cid not in chunk_data:
            chunk_data[cid] = item.get("metadata", item)

    sorted_chunks = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)[:top_n]

    results = []
    for cid, rrf_score in sorted_chunks:
        raw = chunk_data[cid]
        results.append({
            "chunk_id": cid,
            "rrf_score": round(rrf_score, 6),
            "dense_rank": dense_ranks.get(cid),
            "sparse_rank": sparse_ranks.get(cid),
            "text": raw.get("text") or raw.get("payload", {}).get("text", ""),
            "metadata": raw.get("metadata") or raw.get("payload", {}),
        })

    return results


class HybridRAGService:
    """Orchestrates hybrid dense + sparse retrieval."""

    async def search(
        self,
        query: str,
        limit: int = 5,
        session_id: str | None = None,
        document_ids: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """
        Execute dense vector search and BM25 sparse search concurrently, then fuse results.
        """
        # 1. Dense retrieval from Qdrant
        try:
            dense_hits = await rag_service.search(
                query=query,
                limit=limit * 2,
                session_id=session_id,
                document_ids=document_ids,
            )
        except Exception:
            dense_hits = []

        # 2. Sparse retrieval from BM25
        try:
            sparse_hits = bm25_index.search(
                query=query,
                top_k=limit * 2,
                filter_doc_ids=document_ids,
            )
        except Exception:
            sparse_hits = []

        # 3. Reciprocal Rank Fusion
        fused = reciprocal_rank_fusion(
            dense_results=dense_hits,
            sparse_results=sparse_hits,
            k=60,
            top_n=limit,
        )

        return fused


hybrid_rag_service = HybridRAGService()
