import json
import time
import uuid
from typing import Any, AsyncGenerator
 
import psutil
from sqlalchemy.ext.asyncio import AsyncSession
 
from app.config import PROCESSOR_MODEL
from app.ollama_client import ollama
from app.processor.processor import processor 
from app.router import router
from app.services.database_service import database_service
from app.services.memory_service import memory_service
from app.utils.logger import log_request
 
CONTEXT_WINDOW = 32768
 
from app.services.tool_service import ToolService
tool_service = ToolService() 
 
# Fallback used when the processor call fails outright, so a single bad
# request never takes down the whole endpoint.
FALLBACK_PROCESSED: dict[str, Any] = {
    "status": "ready",
    "intent": "general",
    "task_type": "unknown",
    "confidence": 0.0,
    "optimized_prompt": "",  # filled in with the raw message at call time
    "needs_clarification": False,
    "clarification_questions": [],
    "entities": [],
    "reason": "processor_failed",
}
 
 
class ChatService:
    """Coordinates the Processor -> Router -> LLM pipeline for chat requests."""
 
    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
 
    async def chat(
        self,
        session_id: str,
        message: str,
        db: AsyncSession,
    ) -> dict[str, Any]:
        """Handle a single non-streaming chat turn end to end."""
 
        message = message.strip()
        session_id = session_id or str(uuid.uuid4())
 
        start_total = time.perf_counter()
 
        # 1. Processor: intent detection + prompt optimization
        processed, processor_latency_ms = await self._run_processor(message)
        
        try:
            await ollama.unload_model(PROCESSOR_MODEL)
        except Exception:
            pass  
          
        if processed["needs_clarification"]:
            return {
                "type": "clarification",
                "questions": processed["clarification_questions"],
            }
 
        optimized_message = processed["optimized_prompt"]
        intent = processed["intent"]
        tool_result = await self._execute_tool(processed)
        print("tool_result =", tool_result)
        
        if tool_result is not None:

          total_latency_ms = round(
        (time.perf_counter() - start_total) * 1000,
        2,
    )

          return {
        "session_id": session_id,
        "intent": intent,
        "model": tool_result["tool"],
        "latency_ms": total_latency_ms,
        "response": str(tool_result["result"]),
        }
        
        
        
        # 2. Router: pick the target model based on processor output
        routing, routing_latency_ms = await self._run_router(processed)
        model = routing["model"]
 
        # 3. Memory: build the message list sent to the model
        history = memory_service.get_history(session_id).copy()

        messages = history + [
          {
              "role": "user",
              "content": optimized_message,
          }
          ]
        # 4. Generation
        ollama_response, generation_latency_ms = await self._run_generation(
            model=model,
            messages=messages,
        )
        response = ollama_response.get("message", {}).get("content", "").strip()
 
        # 5. Persist conversation turns
        memory_service.add_message(session_id, "user", message)
        memory_service.add_message(session_id, "assistant", response)
 
        total_latency_ms = round((time.perf_counter() - start_total) * 1000, 2)
 
        # 6. Metrics + logging
        request_data = self._build_request_data(
            message=message,
            processed=processed,
            model=model,
            processor_latency_ms=processor_latency_ms,
            routing_latency_ms=routing_latency_ms,
            generation_latency_ms=generation_latency_ms,
            total_latency_ms=total_latency_ms,
            response=response,
            ollama_response=ollama_response,
        )
 
        log_request(request_data)
        await database_service.save_request_log(db=db, data=request_data)
 
        return {
            "session_id": session_id,
            "intent": intent,
            "model": model,
            "latency_ms": total_latency_ms,
            "response": response,
        }
 
    async def stream_chat(
        self,
        session_id: str,
        message: str,
    ) -> AsyncGenerator[str, None]:
        """Handle a streaming chat turn, yielding response tokens as they arrive."""
 
        message = message.strip()
        session_id = session_id or str(uuid.uuid4())
 
        processed, _ = await self._run_processor(message)
 
        try:
             await ollama.unload_model(PROCESSOR_MODEL)
        except Exception:
           pass

        if processed["needs_clarification"]:
            yield json.dumps(
                {
                    "type": "clarification",
                    "questions": processed["clarification_questions"],
                }
            )
            return
 
        optimized_message = processed["optimized_prompt"]
        routing, _ = await self._run_router(processed)
        model = routing["model"]
 
        history = memory_service.get_history(session_id).copy()
        messages = history + [{"role": "user", "content": optimized_message}]
 
        full_response = ""
 
        async for chunk in ollama.stream_chat(model=model, messages=messages):
            data = json.loads(chunk)
 
            if "message" in data:
                token = data["message"]["content"]
                full_response += token
                yield token
 
            if data.get("done"):
                memory_service.add_message(session_id, "user", message)
                memory_service.add_message(session_id, "assistant", full_response)
 
    # ------------------------------------------------------------------
    # Private helpers (single-responsibility building blocks)
    # ------------------------------------------------------------------
 
    async def _run_processor(self, message: str) -> tuple[dict[str, Any], float]:
        """Call the Processor and time the call.
 
        Falls back to a safe default payload if the processor raises, so a
        malformed response or a transient failure (timeout, bad JSON, etc.)
        degrades to a plain "general" turn instead of crashing the request.
        """
 
        start = time.perf_counter()
        try:
            processed = await processor.process(message)
        except Exception :
            processed = {
              **FALLBACK_PROCESSED,
              "optimized_prompt": message,
        }
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        return processed, latency_ms
 
    async def _run_router(self, processed: dict[str, Any]) -> tuple[dict[str, Any], float]:
        """Call the Router with the processor's output and time the call.
 
        Returns the full routing dict (not just the model name) so callers
        can access any additional routing metadata now or in the future.
        """
 
        start = time.perf_counter()
        routing = await router.select_model(processed)
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        return routing, latency_ms
    
    
    
    async def _execute_tool(
    self,
    processed: dict[str, Any], 
      ) -> dict[str, Any] | None:
     """
    Execute a tool if requested by the processor.
    Returns None when no tool is required.
    """

     if not processed.get("needs_tool"):
        return None

     return await tool_service.execute(
        processed["tool_name"],
        **processed.get("tool_args", {})
    )
    
    
    
    async def _run_generation(
        self,
        model: str,
        messages: list[dict[str, str]],
    ) -> tuple[dict[str, Any], float]:
        """Call Ollama for a chat completion and time the call."""
 
        start = time.perf_counter()
        ollama_response = await ollama.chat(model=model, messages=messages)
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        return ollama_response, latency_ms
 
    def _build_request_data(
        self,
        *,
        message: str,
        processed: dict[str, Any],
        model: str,
        processor_latency_ms: float,
        routing_latency_ms: float,
        generation_latency_ms: float,
        total_latency_ms: float,
        response: str,
        ollama_response: dict[str, Any],
    ) -> dict[str, Any]:
        """Assemble the full metrics payload for logging and DB persistence.
 
        Uses .get() with defaults throughout so a missing/renamed field in
        Ollama's response never turns into an unhandled KeyError.
        """
 
        eval_count = ollama_response.get("eval_count", 0)
        eval_duration_ns = ollama_response.get("eval_duration", 0)
        prompt_eval_count = ollama_response.get("prompt_eval_count", 0)
        load_duration_ns = ollama_response.get("load_duration", 0)
        prompt_eval_duration_ns = ollama_response.get("prompt_eval_duration", 0)
 
        tokens_per_second = (
            round(eval_count / (eval_duration_ns / 1_000_000_000), 2)
            if eval_duration_ns > 0
            else 0
        )
        context_usage_percent = (
            round(prompt_eval_count / CONTEXT_WINDOW * 100, 2)
            if CONTEXT_WINDOW > 0
            else 0
        )
        cpu_percent = psutil.cpu_percent(interval=None)
 
        return {
            "question": message,
            "optimized_prompt": processed["optimized_prompt"],
            "intent": processed["intent"],
            # Processor metadata, useful for debugging routing decisions
            "task_type": processed.get("task_type"),
            "intent_confidence": processed.get("confidence"),
            "entities": json.dumps(processed.get("entities", [])),
            "processor_reason": processed.get("reason"),
            "processor_model": PROCESSOR_MODEL,
            "target_model": model,
            "processor_latency_ms": processor_latency_ms,
            "cpu_percent": cpu_percent,
            "tokens_per_second": tokens_per_second,
            "context_tokens": prompt_eval_count,
            "context_window": CONTEXT_WINDOW,
            "context_usage_percent": context_usage_percent,
            "routing_latency_ms": routing_latency_ms,
            "generation_latency_ms": generation_latency_ms,
            "total_latency_ms": total_latency_ms,
            "model_load_time_ms": round(load_duration_ns / 1_000_000, 2),
            "prompt_eval_time_ms": round(prompt_eval_duration_ns / 1_000_000, 2),
            "generation_time_ms": round(eval_duration_ns / 1_000_000, 2),
            "prompt_tokens": prompt_eval_count,
            "completion_tokens": eval_count,
            "response_length": len(response),
            "done_reason": ollama_response.get("done_reason"),
        }
 
 
chat_service = ChatService()
