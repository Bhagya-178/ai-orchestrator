"""
API Router for Model Arena, Dual-Stream Battle, and Leaderboards.
"""

from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.auth.dependencies import get_optional_user
from app.database.models import User
from app.services.arena_service import arena_service

router = APIRouter(prefix="/arena", tags=["Model Arena"])


class DualStreamRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    model_a: str = Field(...)
    model_b: str = Field(...)
    system_prompt: str | None = None
    blind: bool = False
    sequential: bool = True


class VoteRequest(BaseModel):
    prompt: str
    model_a: str
    model_b: str
    winner: Literal["A", "B", "tie", "both_bad"]


@router.post("/battle/stream")
async def stream_arena_battle(
    body: DualStreamRequest,
    current_user: User | None = Depends(get_optional_user),
):
    """
    Stream concurrent or sequential responses from Model A and Model B.
    By default sequential=True unloads Model A before loading Model B to protect local GPU VRAM.
    """
    return StreamingResponse(
        arena_service.stream_dual_battle(
            prompt=body.prompt,
            model_a=body.model_a,
            model_b=body.model_b,
            system_prompt=body.system_prompt,
            blind=body.blind,
            sequential=body.sequential,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/vote")
async def record_arena_vote(
    body: VoteRequest,
    current_user: User | None = Depends(get_optional_user),
):
    """Record user evaluation preference between Model A and Model B."""
    return arena_service.record_vote(
        user_id=current_user.id if current_user else "anonymous",
        prompt=body.prompt,
        model_a=body.model_a,
        model_b=body.model_b,
        winner=body.winner,
    )


@router.get("/leaderboard")
async def get_arena_leaderboard(
    current_user: User | None = Depends(get_optional_user),
):
    """Retrieve community win-rate leaderboard across models."""
    return arena_service.get_leaderboard()
