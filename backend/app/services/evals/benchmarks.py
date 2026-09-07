"""
Curated Evaluation Benchmark Datasets for LLM Assessment.

Includes:
- Coding & Algorithm Suite
- Multi-step Logic & Reasoning Suite
- RAG Faithfulness & Grounding Suite
"""

from pydantic import BaseModel, Field


class TestCase(BaseModel):
    id: str
    prompt: str
    context: str = ""
    ground_truth: str = ""
    test_type: str = "general"  # "coding" | "reasoning" | "rag"
    rubric: list[str] = Field(default_factory=list)


class BenchmarkDataset(BaseModel):
    id: str
    name: str
    description: str
    category: str
    test_cases: list[TestCase]


BENCHMARK_CODING = BenchmarkDataset(
    id="coding_standard",
    name="Python & TypeScript Core Algorithms",
    description="Evaluates algorithmic correctness, edge case handling, and type safety.",
    category="coding",
    test_cases=[
        TestCase(
            id="code_01",
            prompt="Write a Python function `is_valid_parentheses(s: str) -> bool` using a stack that verifies matching parentheses '()', '[]', '{}'.",
            ground_truth="def is_valid_parentheses(s: str) -> bool:\n    stack = []\n    mapping = {')': '(', ']': '[', '}': '{'}\n    for char in s:\n        if char in mapping.values():\n            stack.append(char)\n        elif char in mapping:\n            if not stack or stack.pop() != mapping[char]:\n                return False\n    return len(stack) == 0",
            test_type="coding",
            rubric=["Uses stack data structure", "Handles empty string", "Returns boolean", "O(N) time complexity"],
        ),
        TestCase(
            id="code_02",
            prompt="Write a TypeScript function `debounce<T extends (...args: any[]) => any>(fn: T, delayMs: number): (...args: Parameters<T>) => void` with proper timer cleanup.",
            ground_truth="function debounce<T extends (...args: any[]) => any>(fn: T, delayMs: number) {\n  let timer: any;\n  return (...args: Parameters<T>) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), delayMs);\n  };\n}",
            test_type="coding",
            rubric=["Strong TypeScript generics", "Proper clearTimeout usage", "Preserves parameter typing"],
        ),
        TestCase(
            id="code_03",
            prompt="Write a Python class `LRUCache(capacity: int)` implementing `get(key: int) -> int` and `put(key: int, value: int) -> None` in O(1) time.",
            ground_truth="from collections import OrderedDict\nclass LRUCache:\n    def __init__(self, capacity: int):\n        self.cap = capacity\n        self.cache = OrderedDict()\n    def get(self, key: int) -> int:\n        if key not in self.cache:\n            return -1\n        self.cache.move_to_end(key)\n        return self.cache[key]\n    def put(self, key: int, value: int) -> None:\n        if key in self.cache:\n            self.cache.move_to_end(key)\n        self.cache[key] = value\n        if len(self.cache) > self.cap:\n            self.cache.popitem(last=False)",
            test_type="coding",
            rubric=["O(1) time complexity for get/put", "Correct eviction of least recently used key"],
        ),
    ],
)

BENCHMARK_REASONING = BenchmarkDataset(
    id="reasoning_logic",
    name="Multi-Step Logic & Deduction",
    description="Tests multi-hop analytical reasoning, deduction, and mathematical proof.",
    category="reasoning",
    test_cases=[
        TestCase(
            id="reas_01",
            prompt="A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How much does the ball cost? Show your algebraic steps.",
            ground_truth="Let ball = x. Bat = x + 1.00. x + (x + 1.00) = 1.10 -> 2x + 1.00 = 1.10 -> 2x = 0.10 -> x = $0.05. The ball costs 5 cents.",
            test_type="reasoning",
            rubric=["Correct final answer: $0.05", "Shows explicit linear algebraic steps"],
        ),
        TestCase(
            id="reas_02",
            prompt="Alice is taller than Bob. Charlie is shorter than Bob. David is taller than Alice. Order all four people from shortest to tallest.",
            ground_truth="Charlie < Bob < Alice < David.",
            test_type="reasoning",
            rubric=["Identifies Charlie as shortest", "Identifies David as tallest", "Strict ordering Charlie, Bob, Alice, David"],
        ),
    ],
)

BENCHMARK_RAG = BenchmarkDataset(
    id="rag_faithfulness",
    name="RAG Grounding & Hallucination Resistance",
    description="Checks whether the model restricts answers strictly to the retrieved context without hallucination.",
    category="rag",
    test_cases=[
        TestCase(
            id="rag_01",
            prompt="What is the port number and primary algorithm used by the QuantumMesh cache?",
            context="The QuantumMesh caching service runs exclusively on TCP port 9443 and utilizes the HyperClock-64 eviction heuristic.",
            ground_truth="Port: TCP 9443. Algorithm: HyperClock-64 eviction heuristic.",
            test_type="rag",
            rubric=["Mentions port 9443", "Mentions HyperClock-64", "Does not hallucinate Redis or Memcached"],
        ),
        TestCase(
            id="rag_02",
            prompt="Who founded the Chronos Foundation and in what year according to the provided text?",
            context="The Chronos Foundation was established in 2021 by Dr. Elena Vance to research distributed time synchronisation.",
            ground_truth="Founded in 2021 by Dr. Elena Vance.",
            test_type="rag",
            rubric=["Mentions Dr. Elena Vance", "Mentions 2021", "Refrains from mentioning external people"],
        ),
    ],
)

DATASET_MAP: dict[str, BenchmarkDataset] = {
    BENCHMARK_CODING.id: BENCHMARK_CODING,
    BENCHMARK_REASONING.id: BENCHMARK_REASONING,
    BENCHMARK_RAG.id: BENCHMARK_RAG,
}
