"""
Single orchestration core shared by /chat and /chat/stream.

Both endpoints consume the SAME _turn() event stream, so every pipeline
stage — processor, clarification, tool execution, router, memory,
generation, metrics — is implemented here ONCE and used by both.

Extension points (add each feature in exactly one place):
  Phase 2 memory summarization/retrieval  -> stage 5 (Memory)
  Phase 3 RAG / vector retrieval          -> new stage between 3 and 4
  Phase 4 multi-tool planning             -> stage 3 (Tools)
  Phase 5 response caching                -> stage 6 (Generation)
"""

import json
import time
import uuid
from typing import Any, AsyncGenerator

from app.config import PROCESSOR_MODEL
from app.ollama_client import ollama
from app.processor.processor import processor
from app.router import router
from app.services.database_service import database_service
from app.services.memory_service import memory_service
from app.services.metrics import build_request_data
from app.services.rag_service import rag_service
from app.services.tool_service import ToolService
from app.utils.logger import log_request

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

tool_service = ToolService()


class ChatPipeline:
    """Coordinate Processor -> Tool/Router -> Memory -> Generation for chat."""

    async def chat(self, session_id: str, message: str, db) -> dict[str, Any]:
        """Run a full non-streaming turn and return the result dict."""

        async for event in self._turn(session_id, message.strip(), db):
            if event["type"] == "clarification":
                return {"type": "clarification", "questions": event["questions"]}

            if event["type"] in ("tool", "done"):
                return {
                    "session_id": session_id,
                    "intent": event["intent"],
                    "model": event["model"],
                    "latency_ms": event["latency_ms"],
                    "response": event["response"],
                }

        # _turn always ends in a final event, so this is unreachable.
        return {}

    async def stream_chat(self, session_id: str, message: str, db) -> AsyncGenerator[str, None]:
        """Run a streaming turn, yielding response tokens as they arrive."""

        async for event in self._turn(session_id, message.strip(), db):
            if event["type"] == "clarification":
                yield json.dumps(
                    {"type": "clarification", "questions": event["questions"]}
                )
            elif event["type"] == "tool":
                yield event["response"]
            elif event["type"] == "token":
                yield event["token"]

    # ------------------------------------------------------------------
    # Single source of truth: one pipeline, consumed by both endpoints.
    # ------------------------------------------------------------------
    async def _turn(
        self,
        session_id: str,
        message: str,
        db,
    ) -> AsyncGenerator[dict, None]:
        start_total = time.perf_counter()

        # 1. Processor: intent detection + prompt optimization.
        processed, processor_latency_ms = await self._run_processor(message)

        # Unload the classifier so the target model doesn't wait on it.
        try:
            await ollama.unload_model(PROCESSOR_MODEL)
        except Exception:
            pass

        # 2. Clarification needs no tool / router / generation.
        if processed["needs_clarification"]:
            yield {
                "type": "clarification",
                "questions": processed["clarification_questions"],
            }
            return

        # 3. Tools execute directly and bypass the LLM entirely.
        # NOTE: Skip tool execution if needs_rag is true, because tools like
        # "calculator" might be falsely detected; RAG queries should go through
        # the full pipeline so the LLM can use the retrieved context.
        tool_result = None
        if not processed.get("needs_rag", False):
            tool_result = await self._execute_tool(processed)

        if tool_result is not None:
            # Persist the tool exchange too, so "what did I just ask?" style
            # follow-ups have full context.
            response = str(tool_result.get("result", tool_result.get("error", "")))
            await memory_service.add_message(db, session_id, "user", message)
            await memory_service.add_message(db, session_id, "assistant", response)

            yield {
                "type": "tool",
                "intent": processed["intent"],
                "model": tool_result.get("tool", ""),
                "latency_ms": round((time.perf_counter() - start_total) * 1000, 2),
                "response": response,
            }
            return

        # 4. Router: pick the target model based on processor output.
        routing, routing_latency_ms = await self._run_router(processed)
        model = routing["model"]

        # Phase 3: RAG retrieval (between router and memory)
        rag_context = ""
        
        # 1. Check if processor detected that user wants to search documents
        needs_rag = processed.get("needs_rag", False)
        
        # 2. Get the documents for the current session.
        # This ensures we only search this user's files and don't leak other users' files.
        session_docs = await rag_service.list_documents(db, session_id)
        
        # 3. Decide if we should run a vector search
        should_search_rag = False
        if needs_rag and session_docs:
            # User explicitly asked to search documents AND they have documents
            should_search_rag = True
        elif session_docs and processed.get("intent") in ("study", "reasoning"):
            # They have documents and the intent suggests they might benefit from context
            should_search_rag = True

        if should_search_rag and session_docs:
            doc_ids = [str(d.id) for d in session_docs]
            rag_results = await rag_service.search(
                query=processed["optimized_prompt"],
                limit=5,
                score_threshold=0.3,
                document_ids=doc_ids,
            )
            
            # Fallback for queries which don't semantically match document contents
            if not rag_results:
                print(f"[RAG DEBUG] No chunks met semantic threshold. Fetching raw chunks directly from Postgres.")
                rag_results = await rag_service.get_raw_chunks(db, doc_ids, limit=5)
                
            print(f"[RAG DEBUG] needs_rag={needs_rag}, query={processed['optimized_prompt']}, results={len(rag_results)}")
            for r in rag_results:
                print(f"[RAG DEBUG] hit: doc={r['document_id'][:8]}, chunk={r['chunk_index']}, score={r['score']:.3f}, content={r['content'][:80]}")
            if rag_results:
                rag_context = "\n\n".join(
                    f"[Document {r['document_id'][:8]}, Page {r['page_num']}]\n{r['content']}"
                    for r in rag_results
                )

        # 5. Memory: build the message list sent to the model.
        #    Phase 2: summarization / retrieval land here, once.
        optimized_message = processed["optimized_prompt"]
        if rag_context:
            optimized_message = (
                "You have been provided with the following context from the user's documents. "
                "Please use this context to answer the question. If the answer is not contained "
                "in the context, say so.\n\n"
                "--- START OF CONTEXT ---\n"
                f"{rag_context}\n"
                "--- END OF CONTEXT ---\n\n"
                f"Question:\n{optimized_message}"
            )
            
        await memory_service.maybe_summarize(db, session_id)
        history = await memory_service.get_history(db, session_id)
        messages = history + [{"role": "user", "content": optimized_message}]

        # 6. Generation (streamed internally so /chat and /chat/stream share
        #    one code path; the final chunk carries the Ollama metrics).
        full_response = ""
        done_chunk: dict[str, Any] = {}
        gen_start = time.perf_counter()

        async for chunk in ollama.stream_chat(model=model, messages=messages):
            data = json.loads(chunk)

            if "message" in data:
                token = data["message"]["content"]
                full_response += token
                yield {"type": "token", "token": token}

            if data.get("done"):
                done_chunk = data
                break

        generation_latency_ms = round((time.perf_counter() - gen_start) * 1000, 2)

        # Unload the main model to free VRAM/RAM on RTX 4050
        try:
            await ollama.unload_model(model)
        except Exception:
            pass

        # 7. Persist the conversation turn.
        await memory_service.add_message(db, session_id, "user", message)
        await memory_service.add_message(db, session_id, "assistant", full_response)

        total_latency_ms = round((time.perf_counter() - start_total) * 1000, 2)

        # 8. Metrics + logging (non-streaming only; streaming has no DB session).
        if db is not None:
            request_data = build_request_data(
                message=message,
                processed=processed,
                model=model,
                processor_latency_ms=processor_latency_ms,
                routing_latency_ms=routing_latency_ms,
                generation_latency_ms=generation_latency_ms,
                total_latency_ms=total_latency_ms,
                response=full_response,
                ollama_response=done_chunk,
            )
            log_request(request_data)
            await database_service.save_request_log(db=db, data=request_data)

        yield {
            "type": "done",
            "intent": processed["intent"],
            "model": model,
            "latency_ms": total_latency_ms,
            "response": full_response,
        }

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
        except Exception:
            processed = {**FALLBACK_PROCESSED, "optimized_prompt": message}
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        return processed, latency_ms

    async def _run_router(self, processed: dict[str, Any]) -> tuple[dict[str, Any], float]:
        """Call the Router with the processor's output and time the call."""

        start = time.perf_counter()
        routing = await router.select_model(processed)
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        return routing, latency_ms

    async def _execute_tool(self, processed: dict[str, Any]) -> dict[str, Any] | None:
        """Execute a tool if requested by the processor. None when not required."""

        if not processed.get("needs_tool"):
            return None

        return await tool_service.execute(
            processed["tool_name"],
            **processed.get("tool_args", {})
        )


chat_pipeline = ChatPipeline()
