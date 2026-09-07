"""
LLM Evaluation & Benchmarking Router.

Endpoints:
- GET /evals/benchmarks: List all curated benchmark datasets.
- POST /evals/run: Execute evaluation benchmark against a target model.
- GET /evals/history: List historical evaluation runs and summary scorecards.
- GET /evals/history/{run_id}: Get detailed test case results for a run.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_optional_user
from app.database.models import EvaluationRun, User
from app.database.session import get_db
from app.services.evals.benchmarks import DATASET_MAP
from app.services.evals.eval_engine import eval_engine

router = APIRouter(prefix="/evals", tags=["Evaluations"])


class RunBenchmarkRequest(BaseModel):
    dataset_id: str = Field(..., description="ID of benchmark dataset to execute")
    target_model: str = Field(default="qwen2.5:1.5b", description="Model being tested")
    judge_model: str = Field(default="qwen3:8b", description="Model acting as evaluator")


@router.get("/benchmarks")
async def list_benchmarks():
    """List available benchmark datasets with category and test case counts."""
    return [
        {
            "id": ds.id,
            "name": ds.name,
            "description": ds.description,
            "category": ds.category,
            "test_case_count": len(ds.test_cases),
        }
        for ds in DATASET_MAP.values()
    ]


@router.post("/run")
async def run_benchmark(
    req: RunBenchmarkRequest,
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Run an evaluation benchmark against a model using LLM-as-a-judge scoring."""
    if req.dataset_id not in DATASET_MAP:
        raise HTTPException(
            status_code=404,
            detail=f"Benchmark dataset '{req.dataset_id}' not found. Available: {list(DATASET_MAP.keys())}",
        )

    user_id = current_user.id if current_user else None
    result = await eval_engine.run_benchmark(
        dataset_id=req.dataset_id,
        target_model=req.target_model,
        judge_model=req.judge_model,
        user_id=user_id,
    )
    return result


@router.get("/history")
async def list_eval_history(
    db: AsyncSession = Depends(get_db),
):
    """List historical evaluation runs and aggregate metrics."""
    stmt = select(EvaluationRun).order_by(EvaluationRun.created_at.desc()).limit(30)
    res = await db.execute(stmt)
    runs = res.scalars().all()

    return [
        {
            "id": r.id,
            "dataset_name": r.dataset_name,
            "model_name": r.model_name,
            "judge_model": r.judge_model,
            "total_test_cases": r.total_test_cases,
            "passed_cases": r.passed_cases,
            "summary_scores": r.summary_scores,
            "duration_seconds": r.duration_seconds,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        }
        for r in runs
    ]


@router.get("/history/{run_id}")
async def get_eval_run_detail(
    run_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get full test case breakdown and judge reasoning for a specific run."""
    run = await db.get(EvaluationRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Evaluation run not found")

    return {
        "id": run.id,
        "dataset_name": run.dataset_name,
        "model_name": run.model_name,
        "judge_model": run.judge_model,
        "total_test_cases": run.total_test_cases,
        "passed_cases": run.passed_cases,
        "summary_scores": run.summary_scores,
        "detailed_results": run.detailed_results,
        "duration_seconds": run.duration_seconds,
        "created_at": run.created_at.isoformat() if run.created_at else "",
    }
