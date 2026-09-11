"""LLM-as-a-judge heuristic evaluation and benchmark dataset tests (Tests 151 - 160)."""
from app.services.evals.benchmarks import DATASET_MAP
from app.services.evals.eval_engine import (
    compute_heuristic_faithfulness,
    compute_heuristic_relevance,
)

CONTEXT = "Quantum computers use quantum bits or qubits that can exist in superposition."
RESPONSE = "Quantum computers use qubits that exist in superposition."

def test_151_eval_faithfulness_grounded_response():
    score = compute_heuristic_faithfulness(RESPONSE, CONTEXT)
    assert score >= 0.7

def test_152_eval_faithfulness_hallucinated_claim():
    hallucinated = "Quantum computers use magic pixie dust to travel faster than light."
    f_low = compute_heuristic_faithfulness(hallucinated, CONTEXT)
    f_high = compute_heuristic_faithfulness(RESPONSE, CONTEXT)
    assert f_low < f_high

def test_153_eval_relevance_matching_query():
    query = "How does quantum superposition work?"
    score = compute_heuristic_relevance(RESPONSE, query)
    assert score >= 0.5

def test_154_eval_relevance_off_topic_query():
    off_topic = "How to bake a chocolate cake in an oven?"
    r_low = compute_heuristic_relevance(RESPONSE, off_topic)
    r_high = compute_heuristic_relevance(RESPONSE, "How does quantum superposition work?")
    assert r_low < r_high

def test_155_eval_score_normalization_bounds():
    f = compute_heuristic_faithfulness(RESPONSE, CONTEXT)
    r = compute_heuristic_relevance(RESPONSE, "quantum")
    assert 0.0 <= f <= 1.0 and 0.0 <= r <= 1.0

def test_156_eval_empty_context_faithfulness():
    f = compute_heuristic_faithfulness(RESPONSE, "")
    assert 0.0 <= f <= 1.0

def test_157_eval_empty_response_handling():
    r = compute_heuristic_relevance("", "query")
    assert 0.0 <= r <= 1.0

def test_158_eval_benchmark_dataset_presence():
    keys = list(DATASET_MAP.keys())
    assert "coding_standard" in keys and "rag_faithfulness" in keys and "reasoning_logic" in keys

def test_159_eval_benchmark_schema_valid():
    coding = DATASET_MAP["coding_standard"]
    assert len(coding.test_cases) > 0 and hasattr(coding.test_cases[0], "prompt")

def test_160_eval_radar_metric_keys():
    f = compute_heuristic_faithfulness(RESPONSE, CONTEXT)
    metrics = {"faithfulness": f, "relevance": 0.8, "hallucination": 1.0 - f}
    assert all(0.0 <= v <= 1.0 for v in metrics.values())
