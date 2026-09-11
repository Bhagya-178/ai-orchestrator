"""Hybrid search tests: BM25 sparse index, RRF reciprocal rank fusion, and chunking (Tests 131 - 150)."""
from app.services.rag_v2.bm25_index import BM25Index, _tokenize
from app.services.rag_v2.hybrid_search import reciprocal_rank_fusion

def get_indexed_bm25():
    bm25 = BM25Index()
    corpus = [
        {"id": "doc1", "text": "FastAPI is a modern high performance web framework for building APIs with Python."},
        {"id": "doc2", "text": "PostgreSQL is a powerful open source object-relational database system."},
        {"id": "doc3", "text": "Docker packages applications into containers for consistent deployment."},
    ]
    bm25.index_chunks(corpus)
    return bm25

def test_131_bm25_tokenization_and_stemming():
    tokens = _tokenize("FastAPI & Python high-performance!")
    assert "fastapi" in tokens and "python" in tokens

def test_132_bm25_term_frequency_calculation():
    bm25 = get_indexed_bm25()
    tf = bm25.inverted_index.get("python", {}).get("doc1", 0)
    assert tf >= 1

def test_133_bm25_idf_calculation_rare_terms():
    bm25 = get_indexed_bm25()
    idf_fastapi = bm25.idf.get("fastapi", 0.0)
    assert idf_fastapi > 0

def test_134_bm25_common_term_low_score():
    bm25 = get_indexed_bm25()
    idf_fastapi = bm25.idf.get("fastapi", 0.0)
    idf_is = bm25.idf.get("is", 0.0)
    assert idf_is < idf_fastapi

def test_135_bm25_exact_match_ranking():
    bm25 = get_indexed_bm25()
    results = bm25.search("FastAPI framework Python", top_k=3)
    assert len(results) > 0 and results[0]["chunk_id"] == "doc1"

def test_136_bm25_empty_query_returns_empty():
    bm25 = get_indexed_bm25()
    assert bm25.search("") == []

def test_137_bm25_unseen_term_zero_score():
    bm25 = get_indexed_bm25()
    assert len(bm25.search("nonexistentword12345")) == 0

def test_138_bm25_top_k_parameter_enforcement():
    bm25 = get_indexed_bm25()
    assert len(bm25.search("is", top_k=1)) <= 1

def test_139_bm25_incremental_document_addition():
    bm25 = get_indexed_bm25()
    bm25.index_chunks([{"id": "doc4", "text": "Qdrant is a vector database for semantic search."}])
    qdrant_res = bm25.search("Qdrant vector")
    assert len(qdrant_res) > 0 and qdrant_res[0]["chunk_id"] == "doc4"

def test_140_bm25_clear_index():
    bm25 = BM25Index()
    assert len(bm25.search("FastAPI")) == 0

DENSE_RESULTS = [
    {"id": "docA", "score": 0.95},
    {"id": "docB", "score": 0.88},
    {"id": "docC", "score": 0.72},
]
SPARSE_RESULTS = [
    {"id": "docB", "score": 12.5},
    {"id": "docA", "score": 9.2},
    {"id": "docD", "score": 6.1},
]

def test_141_rrf_blending_dense_and_sparse():
    fused = reciprocal_rank_fusion(DENSE_RESULTS, SPARSE_RESULTS, k=60)
    top_ids = [item["chunk_id"] for item in fused]
    assert "docA" in top_ids[:2] and "docB" in top_ids[:2]

def test_142_rrf_duplicate_suppression():
    fused = reciprocal_rank_fusion(DENSE_RESULTS, SPARSE_RESULTS, k=60)
    top_ids = [item["chunk_id"] for item in fused]
    assert len(top_ids) == len(set(top_ids))

def test_143_rrf_empty_dense_list():
    fused = reciprocal_rank_fusion([], SPARSE_RESULTS, k=60)
    assert len(fused) == 3 and fused[0]["chunk_id"] == "docB"

def test_144_rrf_empty_sparse_list():
    fused = reciprocal_rank_fusion(DENSE_RESULTS, [], k=60)
    assert len(fused) == 3 and fused[0]["chunk_id"] == "docA"

def test_145_rrf_both_lists_empty():
    assert reciprocal_rank_fusion([], [], k=60) == []

def chunk_text(text: str, chunk_size: int = 100, overlap: int = 20) -> list[str]:
    words = text.split()
    if not words:
        return []
    chunks = []
    step = max(1, chunk_size - overlap)
    for i in range(0, len(words), step):
        chunk = " ".join(words[i : i + chunk_size])
        chunks.append(chunk)
        if i + chunk_size >= len(words):
            break
    return chunks

def test_146_chunking_fixed_size_split():
    doc_words = "word " * 250
    chunks = chunk_text(doc_words, chunk_size=100, overlap=20)
    assert len(chunks) >= 3

def test_147_chunking_sliding_window_overlap():
    doc_words = "word " * 250
    chunks = chunk_text(doc_words, chunk_size=100, overlap=20)
    c1 = set(chunks[0].split())
    c2 = set(chunks[1].split())
    assert len(c1.intersection(c2)) > 0

def test_148_chunking_short_document_single_chunk():
    assert len(chunk_text("Hello short document world", chunk_size=100)) == 1

def test_149_chunking_empty_document_safe():
    assert chunk_text("") == []

def test_150_rrf_k_parameter_influence():
    fused = reciprocal_rank_fusion(DENSE_RESULTS, SPARSE_RESULTS, k=10)
    assert len(fused) == 4
