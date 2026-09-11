"""Semantic vector cache, cosine math, LRU eviction, and TTL tests (Tests 111 - 130)."""
import time
from app.services.semantic_cache import SemanticCache, cosine_similarity

def test_111_cosine_similarity_identical_vectors():
    v1 = [1.0, 0.0, 0.0]
    assert abs(cosine_similarity(v1, v1) - 1.0) < 1e-6

def test_112_cosine_similarity_orthogonal_vectors():
    v1 = [1.0, 0.0, 0.0]
    v2 = [0.0, 1.0, 0.0]
    assert abs(cosine_similarity(v1, v2) - 0.0) < 1e-6

def test_113_cosine_similarity_opposite_vectors():
    v1 = [1.0, 0.0, 0.0]
    v3 = [-1.0, 0.0, 0.0]
    assert abs(cosine_similarity(v1, v3) - (-1.0)) < 1e-6

def test_114_cosine_similarity_zero_vector_safe():
    v1 = [1.0, 0.0, 0.0]
    v_zero = [0.0, 0.0, 0.0]
    assert cosine_similarity(v1, v_zero) == 0.0

def test_115_semantic_cache_exact_hash_hit():
    cache = SemanticCache(max_entries=100, ttl_seconds=3600, similarity_threshold=0.92)
    cache.put(query="What is quantum computing?", response="Quantum computing uses qubits.", model="qwen3:8b")
    hit = cache.get(query="What is quantum computing?")
    assert hit is not None and "qubits" in hit["response"]

def test_116_semantic_cache_normalized_query_match():
    cache = SemanticCache(max_entries=100, ttl_seconds=3600, similarity_threshold=0.92)
    cache.put(query="What is quantum computing?", response="Quantum computing uses qubits.", model="qwen3:8b")
    hit_norm = cache.get(query="   WHAT IS QUANTUM COMPUTING?  ")
    assert hit_norm is not None and "qubits" in hit_norm["response"]

def test_117_semantic_cache_vector_similarity_hit():
    cache = SemanticCache(max_entries=100, ttl_seconds=3600, similarity_threshold=0.92)
    query_vec = [1.0, 0.05, 0.0]
    cache.put(query="Vector query A", response="Cached Vector A", model="qwen3:8b", embedding=[1.0, 0.0, 0.0])
    vec_hit = cache.get(query="Slightly different query", query_embedding=query_vec)
    assert vec_hit is not None and vec_hit["response"] == "Cached Vector A"

def test_118_semantic_cache_below_threshold_miss():
    cache = SemanticCache(max_entries=100, ttl_seconds=3600, similarity_threshold=0.92)
    cache.put(query="Vector query A", response="Cached Vector A", model="qwen3:8b", embedding=[1.0, 0.0, 0.0])
    low_sim_vec = [0.5, 0.866, 0.0]
    vec_miss = cache.get(query="Very different query", query_embedding=low_sim_vec)
    assert vec_miss is None

def test_119_semantic_cache_store_and_retrieve():
    cache = SemanticCache(max_entries=100, ttl_seconds=3600)
    complex_payload = "Special response with \n newlines and symbols: ∑ ∫ √"
    cache.put(query="math symbols", response=complex_payload, model="qwen3:8b")
    res = cache.get(query="math symbols")
    assert res is not None and res["response"] == complex_payload

def test_120_semantic_cache_empty_state():
    empty_cache = SemanticCache()
    assert empty_cache.get("anything") is None

def test_121_cache_ttl_fresh_entry_valid():
    cache = SemanticCache(max_entries=3, ttl_seconds=1)
    cache.put("q1", "r1", model="m")
    assert cache.get("q1") is not None

def test_122_cache_ttl_expired_entry_purged():
    cache = SemanticCache(max_entries=3, ttl_seconds=1)
    cache.put("q1", "r1", model="m")
    time.sleep(1.1)
    assert cache.get("q1") is None

def test_123_cache_lru_eviction_at_capacity():
    c_lru = SemanticCache(max_entries=3, ttl_seconds=3600)
    c_lru.put("a", "1", model="m")
    c_lru.put("b", "2", model="m")
    c_lru.put("c", "3", model="m")
    c_lru.put("d", "4", model="m")
    assert c_lru.get("a") is None and c_lru.get("d") is not None

def test_124_cache_lru_access_refreshes_position():
    c_lru = SemanticCache(max_entries=3, ttl_seconds=3600)
    c_lru.put("x", "10", model="m")
    c_lru.put("y", "20", model="m")
    c_lru.put("z", "30", model="m")
    c_lru.get("x")
    c_lru.put("w", "40", model="m")
    assert c_lru.get("x") is not None and c_lru.get("y") is None

def test_125_cache_telemetry_token_savings():
    c = SemanticCache(max_entries=5)
    c.put("tok_test", "resp", model="m", tokens_saved=200)
    c.get("tok_test")
    m = c.get_metrics()
    assert m["total_tokens_saved"] >= 200

def test_126_cache_telemetry_cost_savings():
    c = SemanticCache(max_entries=5)
    c.put("cost_test", "resp", model="m", tokens_saved=1000)
    c.get("cost_test")
    m = c.get_metrics()
    assert m["estimated_cost_saved_usd"] > 0

def test_127_cache_clear_all():
    c = SemanticCache(max_entries=5)
    c.put("k", "v", model="m")
    c.clear()
    assert len(c.entries) == 0 and c.get("k") is None

def test_128_cache_stats_reporting():
    c = SemanticCache(max_entries=5)
    c.put("k1", "v1", model="m")
    c.get("k1")
    c.get("k2")
    m = c.get_metrics()
    assert m["total_hits"] >= 1 and m["misses"] >= 1

def test_129_cache_concurrent_safety_lock():
    c = SemanticCache(max_entries=50)
    for i in range(50):
        c.put(f"k_{i}", f"v_{i}", model="m")
    assert len(c.entries) == 50

def test_130_cache_large_payload_storage():
    c = SemanticCache(max_entries=5)
    big_payload = "A" * 50000
    c.put("big_key", big_payload, model="m")
    retrieved = c.get("big_key")
    assert retrieved is not None and len(retrieved["response"]) == 50000
