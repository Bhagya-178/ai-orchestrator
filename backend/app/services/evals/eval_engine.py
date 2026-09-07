"""
LLM-as-a-Judge Evaluation Engine.

Provides automated evaluation pipelines:
- Faithfulness: Degree to which claims in output are grounded in retrieved context
- Answer Relevance: Degree to which output directly answers the user's prompt
- Hallucination Score: Detected ungrounded or fabricated assertions
- Rubric Adherence: Point-by-point verification against test case rubrics
"""

import json
import logging
import re
import time
from typing import Any, Optional

from app.database.database import get_session_factory
from app.database.models import EvaluationRun
from app.ollama_client import ollama
from app.services.evals.benchmarks import DATASET_MAP, BenchmarkDataset, TestCase

logger = logging.getLogger(__name__)


def compute_heuristic_faithfulness(answer: str, context: str) -> float:
    """Heuristic grounding score measuring word and phrase overlap with context."""
    if not context:
        return 1.0  # Context not applicable

    context_words = set(re.findall(r"\w+", context.lower()))
    answer_words = re.findall(r"\w+", answer.lower())

    if not answer_words:
        return 0.0

    # Words longer than 3 chars
    significant_words = [w for w in answer_words if len(w) > 3]
    if not significant_words:
        return 0.5

    overlap = sum(1 for w in significant_words if w in context_words)
    return round(min(1.0, overlap / len(significant_words)), 3)


def compute_heuristic_relevance(answer: str, prompt: str) -> float:
    """Heuristic relevance score measuring how well response addresses prompt tokens."""
    prompt_words = set(re.findall(r"\w+", prompt.lower()))
    answer_words = set(re.findall(r"\w+", answer.lower()))

    if not prompt_words:
        return 1.0

    significant_prompt = [w for w in prompt_words if len(w) > 3]
    if not significant_prompt:
        return 0.8

    overlap = sum(1 for w in significant_prompt if w in answer_words)
    return round(min(1.0, 0.4 + (0.6 * (overlap / len(significant_prompt)))), 3)


class EvaluationEngine:
    """Orchestrates LLM-as-a-Judge test executions and scorecards."""

    async def evaluate_single_turn(
        self,
        test_case: TestCase,
        candidate_response: str,
        judge_model: str = "qwen3:8b",
    ) -> dict[str, Any]:
        """Judge a candidate response against a test case rubric and ground truth."""
        judge_prompt = f"""You are an impartial, highly rigorous AI Benchmark Judge.
Evaluate the candidate response to the following prompt according to the rubric and ground truth.

### Prompt:
{test_case.prompt}

### Context (if any):
{test_case.context or 'None provided'}

### Ground Truth Reference:
{test_case.ground_truth}

### Rubric Items:
{chr(10).join(f"- {r}" for r in test_case.rubric)}

### Candidate Response to Evaluate:
{candidate_response}

Provide your evaluation as a valid JSON object ONLY with the following exact keys:
{{
  "faithfulness": <float between 0.0 and 1.0>,
  "relevance": <float between 0.0 and 1.0>,
  "hallucination_score": <float between 0.0 and 1.0, where 0.0 is zero hallucination and 1.0 is total hallucination>,
  "rubric_passed": <integer count of rubric items satisfied>,
  "total_rubric": <integer total rubric items>,
  "passed": <boolean, true if candidate satisfies requirements>,
  "reasoning": "<short sentence explaining verdict>"
}}
Do not write anything outside the JSON object."""

        try:
            raw_judge = await ollama.generate(
                prompt=judge_prompt,
                model=judge_model,
                temperature=0.0,
            )
            # Extract JSON
            match = re.search(r"\{.*\}", raw_judge, re.DOTALL)
            if match:
                parsed = json.loads(match.group(0))
                return parsed
        except Exception as ex:
            logger.warning(f"Judge model generation failed: {ex}. Using heuristic scoring.")

        # Heuristic fallback if judge model fails
        faithfulness = compute_heuristic_faithfulness(candidate_response, test_case.context)
        relevance = compute_heuristic_relevance(candidate_response, test_case.prompt)
        hallucination = round(1.0 - faithfulness, 3) if test_case.context else 0.0
        passed = (relevance >= 0.6) and (hallucination <= 0.4)

        return {
            "faithfulness": faithfulness,
            "relevance": relevance,
            "hallucination_score": hallucination,
            "rubric_passed": len(test_case.rubric) if passed else max(0, len(test_case.rubric) - 1),
            "total_rubric": len(test_case.rubric),
            "passed": passed,
            "reasoning": "Scored via heuristic fallback",
        }

    async def run_benchmark(
        self,
        dataset_id: str,
        target_model: str,
        judge_model: str = "qwen3:8b",
        user_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """Run complete benchmark dataset against target model, scoring all test cases."""
        dataset = DATASET_MAP.get(dataset_id)
        if not dataset:
            raise ValueError(f"Dataset '{dataset_id}' not found. Available: {list(DATASET_MAP.keys())}")

        start_time = time.perf_counter()
        results = []
        passed_count = 0

        total_faithfulness = 0.0
        total_relevance = 0.0
        total_hallucination = 0.0

        for tc in dataset.test_cases:
            # 1. Query target model
            prompt_full = tc.prompt
            if tc.context:
                prompt_full = f"Context:\n{tc.context}\n\nQuestion: {tc.prompt}"

            try:
                candidate_response = await ollama.generate(
                    prompt=prompt_full,
                    model=target_model,
                    temperature=0.2,
                )
            except Exception as ex:
                candidate_response = f"[Error querying target model]: {ex}"

            # 2. Judge response
            verdict = await self.evaluate_single_turn(tc, candidate_response, judge_model=judge_model)

            is_pass = verdict.get("passed", False)
            if is_pass:
                passed_count += 1

            f_score = float(verdict.get("faithfulness", 0.0))
            r_score = float(verdict.get("relevance", 0.0))
            h_score = float(verdict.get("hallucination_score", 0.0))

            total_faithfulness += f_score
            total_relevance += r_score
            total_hallucination += h_score

            results.append({
                "test_case_id": tc.id,
                "prompt": tc.prompt,
                "candidate_response": candidate_response,
                "ground_truth": tc.ground_truth,
                "verdict": verdict,
            })

        duration = time.perf_counter() - start_time
        num_tests = len(dataset.test_cases)
        summary = {
            "pass_rate": round(passed_count / num_tests if num_tests > 0 else 0.0, 3),
            "avg_faithfulness": round(total_faithfulness / num_tests if num_tests > 0 else 0.0, 3),
            "avg_relevance": round(total_relevance / num_tests if num_tests > 0 else 0.0, 3),
            "avg_hallucination": round(total_hallucination / num_tests if num_tests > 0 else 0.0, 3),
        }

        # Persist run to database
        session_factory = get_session_factory()
        async with session_factory() as db:
            run_record = EvaluationRun(
                user_id=user_id,
                dataset_name=dataset.id,
                model_name=target_model,
                judge_model=judge_model,
                total_test_cases=num_tests,
                passed_cases=passed_count,
                summary_scores=summary,
                detailed_results=results,
                duration_seconds=round(duration, 2),
            )
            db.add(run_record)
            await db.commit()
            await db.refresh(run_record)
            run_id = run_record.id

        return {
            "run_id": run_id,
            "dataset_id": dataset.id,
            "dataset_name": dataset.name,
            "target_model": target_model,
            "judge_model": judge_model,
            "total_test_cases": num_tests,
            "passed_cases": passed_count,
            "summary_scores": summary,
            "duration_seconds": round(duration, 2),
            "results": results,
        }


eval_engine = EvaluationEngine()
