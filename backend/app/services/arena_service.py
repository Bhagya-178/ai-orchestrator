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

    async def _stream_tokens(
        self,
        model_name: str,
        prompt: str,
        system_prompt: str | None = None,
        options: dict[str, Any] | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream tokens from Ollama using chat stream first, fallback to generate stream."""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        try:
            async for line in ollama.stream_chat(model=model_name, messages=messages, options=options):
                try:
                    data = json.loads(line)
                    token = data.get("message", {}).get("content", "")
                    if token:
                        yield token
                except Exception:
                    continue
        except Exception as chat_ex:
            logger.warning(
                "stream_chat failed for %s (%s), falling back to generate_stream",
                model_name,
                chat_ex,
            )
            full_prompt = f"{system_prompt}\n\nUser: {prompt}" if system_prompt else prompt
            async for chunk in ollama.generate_stream(model=model_name, prompt=full_prompt, options=options):
                token = chunk.get("response", "")
                if token:
                    yield token

    async def stream_dual_battle(
        self,
        prompt: str,
        model_a: str,
        model_b: str,
        system_prompt: str | None = None,
        blind: bool = False,
        sequential: bool = True,
    ) -> AsyncGenerator[str, None]:
        """
        Stream responses from Model A and Model B using an SSE stream.
        When sequential=True (default, optimized for local single-GPU setups):
        1. Model A streams until completion.
        2. Model A is explicitly unloaded from GPU VRAM (keep_alive: 0).
        3. Model B loads into GPU VRAM and streams until completion.
        4. Model B is explicitly unloaded from GPU VRAM.
        This prevents GPU out-of-memory (OOM) crashes and system RAM paging slowdowns.
        """
        options = {"temperature": 0.7}

        if sequential:
            # === SIDE A ===
            t_start_a = time.perf_counter()
            first_token_a: float | None = None
            token_count_a = 0

            try:
                async for token in self._stream_tokens(
                    model_name=model_a,
                    prompt=prompt,
                    system_prompt=system_prompt,
                    options=options,
                ):
                    now = time.perf_counter()
                    if first_token_a is None:
                        first_token_a = now
                    token_count_a += 1
                    yield f"data: {json.dumps({'side': 'A', 'type': 'token', 'token': token})}\n\n"

                t_end_a = time.perf_counter()
                total_duration_a = max(t_end_a - t_start_a, 0.001)
                ttft_ms_a = round(((first_token_a or t_end_a) - t_start_a) * 1000, 2)
                tok_sec_a = round(token_count_a / total_duration_a, 2)

                yield f"data: {json.dumps({'side': 'A', 'type': 'metrics', 'metrics': {'model': 'Model A' if blind else model_a, 'real_model': model_a, 'token_count': token_count_a, 'duration_ms': round(total_duration_a * 1000, 2), 'ttft_ms': ttft_ms_a, 'tokens_per_second': tok_sec_a}})}\n\n"
            except Exception as ex:
                logger.error(f"Arena battle Model A ({model_a}) stream error: {ex}")
                yield f"data: {json.dumps({'side': 'A', 'type': 'error', 'error': str(ex)})}\n\n"
            finally:
                # Explicitly unload Model A from GPU VRAM before loading Model B
                try:
                    logger.info(f"Unloading Model A ({model_a}) from GPU VRAM...")
                    await ollama.unload_model(model_a)
                    await asyncio.sleep(0.15)  # brief grace period for VRAM deallocation
                except Exception as e:
                    logger.debug(f"Failed to unload Model A ({model_a}): {e}")

            # === SIDE B ===
            t_start_b = time.perf_counter()
            first_token_b: float | None = None
            token_count_b = 0

            try:
                async for token in self._stream_tokens(
                    model_name=model_b,
                    prompt=prompt,
                    system_prompt=system_prompt,
                    options=options,
                ):
                    now = time.perf_counter()
                    if first_token_b is None:
                        first_token_b = now
                    token_count_b += 1
                    yield f"data: {json.dumps({'side': 'B', 'type': 'token', 'token': token})}\n\n"

                t_end_b = time.perf_counter()
                total_duration_b = max(t_end_b - t_start_b, 0.001)
                ttft_ms_b = round(((first_token_b or t_end_b) - t_start_b) * 1000, 2)
                tok_sec_b = round(token_count_b / total_duration_b, 2)

                yield f"data: {json.dumps({'side': 'B', 'type': 'metrics', 'metrics': {'model': 'Model B' if blind else model_b, 'real_model': model_b, 'token_count': token_count_b, 'duration_ms': round(total_duration_b * 1000, 2), 'ttft_ms': ttft_ms_b, 'tokens_per_second': tok_sec_b}})}\n\n"
            except Exception as ex:
                logger.error(f"Arena battle Model B ({model_b}) stream error: {ex}")
                yield f"data: {json.dumps({'side': 'B', 'type': 'error', 'error': str(ex)})}\n\n"
            finally:
                # Explicitly unload Model B from GPU VRAM
                try:
                    logger.info(f"Unloading Model B ({model_b}) from GPU VRAM...")
                    await ollama.unload_model(model_b)
                    await asyncio.sleep(0.15)
                except Exception as e:
                    logger.debug(f"Failed to unload Model B ({model_b}): {e}")

            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return

        # Concurrent execution branch (for multi-GPU or cloud clusters)
        queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()

        async def stream_side(side: str, model_name: str):
            t_start = time.perf_counter()
            first_token_time: float | None = None
            token_count = 0

            try:
                async for token in self._stream_tokens(
                    model_name=model_name,
                    prompt=prompt,
                    system_prompt=system_prompt,
                    options=options,
                ):
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
                try:
                    await ollama.unload_model(model_name)
                except Exception:
                    pass
                await queue.put(None)  # Sentinel for this task

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
