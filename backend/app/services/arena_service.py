"""
Multi-Model Arena Evaluation and Concurrent Dual-Stream Service.
Executes simultaneous generations across two distinct LLMs on identical prompts,
measuring Time-To-First-Token (TTFT), tokens/sec, and total latency with side-by-side telemetry.
"""

import asyncio
import json
import logging
import time
from collections.abc import AsyncGenerator
from typing import Any

from app.ollama_client import ollama

logger = logging.getLogger(__name__)


class ArenaBattleService:
    """Manages concurrent generation sessions for Model Arena comparisons."""

    def __init__(self):
        self._vote_history: list[dict[str, Any]] = []

    async def stream_dual_battle(
        self,
        prompt: str,
        model_a: str,
        model_b: str,
        system_prompt: str | None = None,
        blind: bool = False,
    ) -> AsyncGenerator[str, None]:
        """
        Stream concurrent responses from Model A and Model B using an interleaved SSE stream.
        """
        queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()

        async def stream_side(side: str, model_name: str):
            t_start = time.perf_counter()
            first_token_time: float | None = None
            token_count = 0

            options = {"temperature": 0.7}
            full_prompt = f"{system_prompt}\n\nUser: {prompt}" if system_prompt else prompt

            try:
                async for chunk in ollama.generate_stream(model=model_name, prompt=full_prompt, options=options):
                    token = chunk.get("response", "")
                    if token:
                        now = time.perf_counter()
                        if first_token_time is None:
                            first_token_time = now
                        token_count += 1
                        await queue.put({
                            "side": side,
                            "type": "token",
                            "token": token,
                        })

                t_end = time.perf_counter()
                total_duration = max(t_end - t_start, 0.001)
                ttft_ms = round(((first_token_time or t_end) - t_start) * 1000, 2)
                tok_sec = round(token_count / total_duration, 2)

                await queue.put({
                    "side": side,
                    "type": "metrics",
                    "metrics": {
                        "model": "Model " + side if blind else model_name,
                        "real_model": model_name,
                        "token_count": token_count,
                        "duration_ms": round(total_duration * 1000, 2),
                        "ttft_ms": ttft_ms,
                        "tokens_per_second": tok_sec,
                    },
                })
            except Exception as ex:
                await queue.put({
                    "side": side,
                    "type": "error",
                    "error": str(ex),
                })
            finally:
                await queue.put(None)  # Sentinel for this task

        # Launch both generations concurrently
        task_a = asyncio.create_task(stream_side("A", model_a))
        task_b = asyncio.create_task(stream_side("B", model_b))

        completed_tasks = 0
        while completed_tasks < 2:
            event = await queue.get()
            if event is None:
                completed_tasks += 1
            else:
                yield f"data: {json.dumps(event)}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    def record_vote(self, user_id: str, prompt: str, model_a: str, model_b: str, winner: str) -> dict[str, Any]:
        """Record user preference vote ('A', 'B', 'tie', or 'both_bad')."""
        record = {
            "user_id": user_id,
            "prompt": prompt,
            "model_a": model_a,
            "model_b": model_b,
            "winner": winner,
            "timestamp": time.time(),
        }
        self._vote_history.append(record)
        return {"status": "recorded", "vote_id": len(self._vote_history)}

    def get_leaderboard(self) -> list[dict[str, Any]]:
        """Calculate Elo or win-rate leaderboard across models."""
        stats: dict[str, dict[str, int]] = {}

        for vote in self._vote_history:
            mA = vote["model_a"]
            mB = vote["model_b"]
            w = vote["winner"]

            for m in (mA, mB):
                if m not in stats:
                    stats[m] = {"battles": 0, "wins": 0, "losses": 0, "ties": 0}

            stats[mA]["battles"] += 1
            stats[mB]["battles"] += 1

            if w == "A":
                stats[mA]["wins"] += 1
                stats[mB]["losses"] += 1
            elif w == "B":
                stats[mB]["wins"] += 1
                stats[mA]["losses"] += 1
            elif w == "tie":
                stats[mA]["ties"] += 1
                stats[mB]["ties"] += 1

        leaderboard = []
        for model_name, data in stats.items():
            battles = max(data["battles"], 1)
            win_rate = round((data["wins"] / battles) * 100, 1)
            leaderboard.append({
                "model": model_name,
                "battles": data["battles"],
                "wins": data["wins"],
                "losses": data["losses"],
                "ties": data["ties"],
                "win_rate": win_rate,
            })

        return sorted(leaderboard, key=lambda x: x["win_rate"], reverse=True)


arena_service = ArenaBattleService()
