"""
Semantic Vector Caching Layer.

Optimizes LLM turn response times by matching incoming user queries against
historically generated answers using cosine similarity of vector embeddings.

Features:
- O(1) Exact query hash matching
- Semantic similarity matching via cosine similarity (default threshold: 0.92)
- LRU cache eviction and configurable TTL expiration
- Telemetry reporting: hit rate, tokens saved, latency saved
"""

import hashlib
import logging
import math
import time
from typing import Any, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


def cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
    """Compute cosine similarity between two float vectors."""
    if len(vec1) != len(vec2) or not vec1:
        return 0.0

    dot = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = math.sqrt(sum(a * a for a in vec1))
    norm2 = math.sqrt(sum(b * b for b in vec2))

    if norm1 == 0.0 or norm2 == 0.0:
        return 0.0

    return dot / (norm1 * norm2)


class CacheEntry(BaseModel):
    key_hash: str
    query: str
    embedding: list[float]
    response: str
    model: str
    tokens_saved: int
    created_at: float
    last_accessed: float
    access_count: int = 1


class SemanticCache:
    """In-memory semantic vector cache with LRU eviction and cosine similarity matching."""

    def __init__(
        self,
        similarity_threshold: float = 0.92,
        max_entries: int = 1000,
        ttl_seconds: int = 86400,  # 24 hours
    ):
        self.similarity_threshold = similarity_threshold
        self.max_entries = max_entries
        self.ttl_seconds = ttl_seconds

        # Storage
        self.exact_cache: dict[str, CacheEntry] = {}
        self.entries: list[CacheEntry] = []

        # Telemetry
        self.total_lookups = 0
        self.exact_hits = 0
        self.semantic_hits = 0
        self.misses = 0
        self.total_tokens_saved = 0

    def _normalize_query(self, query: str) -> str:
        """Normalize query by stripping and lowercasing."""
        return " ".join(query.strip().lower().split())

    def _hash_query(self, normalized_query: str) -> str:
        """MD5 hash of normalized query."""
        return hashlib.md5(normalized_query.encode("utf-8")).hexdigest()

    def get(
        self,
        query: str,
        query_embedding: Optional[list[float]] = None,
    ) -> Optional[dict[str, Any]]:
        """
        Check cache for exact or semantically similar query match.
        """
        self.total_lookups += 1
        now = time.time()
        norm_q = self._normalize_query(query)
        q_hash = self._hash_query(norm_q)

        # 1. Exact match check
        if q_hash in self.exact_cache:
            entry = self.exact_cache[q_hash]
            if now - entry.created_at <= self.ttl_seconds:
                entry.last_accessed = now
                entry.access_count += 1
                self.exact_hits += 1
                self.total_tokens_saved += entry.tokens_saved
                return {
                    "hit": True,
                    "type": "exact",
                    "similarity": 1.0,
                    "response": entry.response,
                    "model": entry.model,
                    "tokens_saved": entry.tokens_saved,
                }
            else:
                # Expired
                self._remove_entry(entry)

        # 2. Semantic vector match check
        if query_embedding and self.entries:
            best_entry: Optional[CacheEntry] = None
            best_sim = -1.0

            for entry in self.entries:
                if now - entry.created_at > self.ttl_seconds:
                    continue

                sim = cosine_similarity(query_embedding, entry.embedding)
                if sim > best_sim:
                    best_sim = sim
                    best_entry = entry

            if best_entry and best_sim >= self.similarity_threshold:
                best_entry.last_accessed = now
                best_entry.access_count += 1
                self.semantic_hits += 1
                self.total_tokens_saved += best_entry.tokens_saved
                return {
                    "hit": True,
                    "type": "semantic",
                    "similarity": round(best_sim, 4),
                    "response": best_entry.response,
                    "model": best_entry.model,
                    "tokens_saved": best_entry.tokens_saved,
                }

        self.misses += 1
        return None

    def put(
        self,
        query: str,
        response: str,
        model: str,
        embedding: Optional[list[float]] = None,
        tokens_saved: int = 150,
    ) -> None:
        """Store a generated query/response pair into cache."""
        now = time.time()
        norm_q = self._normalize_query(query)
        q_hash = self._hash_query(norm_q)

        # If embedding not provided, generate a deterministic bag-of-words pseudo-embedding
        emb = embedding or self._fallback_embedding(norm_q)

        entry = CacheEntry(
            key_hash=q_hash,
            query=query,
            embedding=emb,
            response=response,
            model=model,
            tokens_saved=tokens_saved,
            created_at=now,
            last_accessed=now,
        )

        # Evict oldest if capacity reached
        if len(self.entries) >= self.max_entries:
            self._evict_lru()

        self.exact_cache[q_hash] = entry
        self.entries.append(entry)

    def _evict_lru(self) -> None:
        """Evict least recently accessed cache entry."""
        if not self.entries:
            return
        self.entries.sort(key=lambda e: e.last_accessed)
        oldest = self.entries.pop(0)
        self.exact_cache.pop(oldest.key_hash, None)

    def _remove_entry(self, entry: CacheEntry) -> None:
        """Remove a specific entry."""
        self.exact_cache.pop(entry.key_hash, None)
        if entry in self.entries:
            self.entries.remove(entry)

    def clear(self) -> None:
        """Flush cache."""
        self.exact_cache.clear()
        self.entries.clear()

    def get_metrics(self) -> dict[str, Any]:
        """Return cache health and efficiency metrics."""
        total_hits = self.exact_hits + self.semantic_hits
        hit_rate = (total_hits / self.total_lookups * 100.0) if self.total_lookups > 0 else 0.0
        # Estimated $0.002 per 1k tokens saved
        est_cost_saved = (self.total_tokens_saved / 1000.0) * 0.002

        return {
            "cached_entries": len(self.entries),
            "total_lookups": self.total_lookups,
            "total_hits": total_hits,
            "exact_hits": self.exact_hits,
            "semantic_hits": self.semantic_hits,
            "misses": self.misses,
            "hit_rate_percent": round(hit_rate, 2),
            "total_tokens_saved": self.total_tokens_saved,
            "estimated_cost_saved_usd": round(est_cost_saved, 4),
        }

    def _fallback_embedding(self, text: str, dims: int = 128) -> list[float]:
        """Deterministic hash embedding used when dense embedding model is unavailable."""
        vec = [0.0] * dims
        tokens = text.split()
        if not tokens:
            return vec
        for tok in tokens:
            h = int(hashlib.sha256(tok.encode("utf-8")).hexdigest(), 16)
            idx = h % dims
            vec[idx] += 1.0

        # L2 normalize
        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            vec = [x / norm for x in vec]
        return vec


semantic_cache = SemanticCache()
