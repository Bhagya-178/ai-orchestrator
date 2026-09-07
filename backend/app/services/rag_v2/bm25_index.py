"""
In-Memory BM25Okapi Sparse Inverted Index for Hybrid RAG.
Computes exact lexical matching with document length normalization and inverse document frequency.
"""

import math
import re
from collections import Counter
from typing import Any


def _tokenize(text: str) -> list[str]:
    """Lowercase and extract alphanumeric word tokens."""
    return re.findall(r"\b[a-z0-9_]+\b", text.lower())


class BM25Index:
    """
    BM25Okapi implementation for sparse retrieval.
    Parameters:
        k1: Controls term frequency saturation (standard default: 1.5).
        b: Controls document length normalization (standard default: 0.75).
    """

    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.doc_ids: list[str] = []
        self.doc_metadata: dict[str, dict[str, Any]] = {}
        self.doc_lengths: dict[str, int] = {}
        self.avg_doc_length: float = 0.0
        self.inverted_index: dict[str, dict[str, int]] = {}  # term -> {doc_id: tf}
        self.idf: dict[str, float] = {}

    def index_chunks(self, chunks: list[dict[str, Any]]) -> None:
        """
        Index a batch of text chunks.
        Each chunk must have 'id' (or 'chunk_id') and 'text'.
        """
        total_len = 0
        for chunk in chunks:
            cid = str(chunk.get("id") or chunk.get("chunk_id"))
            text = chunk.get("text", "")
            tokens = _tokenize(text)
            tf = Counter(tokens)

            self.doc_ids.append(cid)
            self.doc_metadata[cid] = chunk
            self.doc_lengths[cid] = len(tokens)
            total_len += len(tokens)

            for term, count in tf.items():
                if term not in self.inverted_index:
                    self.inverted_index[term] = {}
                self.inverted_index[term][cid] = count

        n_docs = len(self.doc_ids)
        if n_docs > 0:
            self.avg_doc_length = total_len / n_docs

        # Precompute IDF for all terms
        # Standard BM25 IDF: log( (N - n(q) + 0.5) / (n(q) + 0.5) + 1 )
        for term, posting in self.inverted_index.items():
            df = len(posting)
            self.idf[term] = math.log(1.0 + (n_docs - df + 0.5) / (df + 0.5))

    def search(self, query: str, top_k: int = 10, filter_doc_ids: list[str] | None = None) -> list[dict[str, Any]]:
        """
        Score and rank indexed chunks against a text query.
        Returns top_k results with BM25 score and metadata.
        """
        tokens = _tokenize(query)
        if not tokens or not self.doc_ids:
            return []

        allowed = set(filter_doc_ids) if filter_doc_ids else None
        scores: dict[str, float] = Counter()

        for term in tokens:
            if term not in self.inverted_index:
                continue

            idf_val = self.idf.get(term, 0.0)
            posting = self.inverted_index[term]

            for doc_id, tf in posting.items():
                if allowed and doc_id not in allowed:
                    continue

                doc_len = self.doc_lengths.get(doc_id, 1)
                # BM25 TF formula: tf * (k1 + 1) / (tf + k1 * (1 - b + b * (doc_len / avg_len)))
                denom = tf + self.k1 * (1.0 - self.b + self.b * (doc_len / max(self.avg_doc_length, 1.0)))
                term_score = idf_val * (tf * (self.k1 + 1.0) / denom)
                scores[doc_id] += term_score

        top_results = []
        for doc_id, score in scores.most_common(top_k):
            top_results.append({
                "chunk_id": doc_id,
                "score": round(score, 4),
                "metadata": self.doc_metadata.get(doc_id, {}),
            })

        return top_results


bm25_index = BM25Index()
