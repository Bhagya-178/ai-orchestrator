"""
Single orchestration core shared by /chat and /chat/stream.
"""

import json
import logging
import time
from collections.abc import AsyncGenerator
from typing import Any

from app.config import settings
from app.ollama_client import ollama
from app.processor.processor import processor
from app.router import router
from app.services.database_service import database_service
from app.services.memory_service import memory_service
from app.services.metrics import build_request_data
from app.services.rag_service import rag_service
from app.services.tool_service import ToolService
from app.utils.logger import log_request

logger = logging.getLogger(__name__)

FALLBACK_PROCESSED: dict[str, Any] = {
    "status": "ready",
    "intent": "general",
    "task_type": "unknown",
    "confidence": 0.0,
    "optimized_prompt": "",
    "needs_clarification": False,
    "clarification_questions": [],
    "entities": [],
    "reason": "processor_failed",
}

tool_service = ToolService()

class ChatPipeline:
    """Coordinate Processor -> Tool/Router -> Memory -> Generation for chat."""

    async def chat(
        self, session_id: str, message: str, db: Any, use_rag: bool = True, intent_override: str | None = None, effort_level: str | None = "medium"
    ) -> dict[str, Any]:
        """Run a full non-streaming turn and return the result dict."""
        async for event in self._turn(session_id, message.strip(), db, use_rag, intent_override, effort_level):
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

        return {}

    async def stream_chat(
        self, session_id: str, message: str, db: Any, use_rag: bool = True, intent_override: str | None = None, effort_level: str | None = "medium"
    ) -> AsyncGenerator[str, None]:
        """Run a streaming turn, yielding response tokens as they arrive."""
        async for event in self._turn(session_id, message.strip(), db, use_rag, intent_override, effort_level):
            if event["type"] == "clarification":
                yield f"data: {json.dumps({'type': 'clarification', 'questions': event['questions']})}\n\n"
            elif event["type"] == "tool":
                yield f"data: {json.dumps({'type': 'token', 'token': event['response']})}\n\n"
            elif event["type"] == "token":
                yield f"data: {json.dumps({'type': 'token', 'token': event['token']})}\n\n"
            elif event["type"] == "done":
                yield f"data: {json.dumps(event)}\n\n"
        
        yield "data: [DONE]\n\n"

    async def _turn(
        self,
        session_id: str,
        message: str,
        db: Any,
        use_rag: bool = True,
        intent_override: str | None = None,
        effort_level: str | None = "medium"
    ) -> AsyncGenerator[dict[str, Any], None]:
        start_total = time.perf_counter()

        session_docs = []
        try:
            session_docs = await rag_service.list_documents(db, session_id)
        except Exception as e:
            logger.error(f"Failed to list documents for RAG: {e}")
        
        has_manual_intent = bool(intent_override and intent_override.lower() != "auto")

        from app.processor.tool_detector import tool_detector
        detected = tool_detector.detect(message)
        needs_rag_det = tool_detector.detect_rag(message)

        if detected:
            processed = {
                **FALLBACK_PROCESSED,
                "optimized_prompt": message,
                "intent": detected["intent"],
                "needs_tool": True,
                "tool_name": detected["tool_name"],
                "tool_args": detected["tool_args"],
            }
            processor_latency_ms = 0.0
        elif session_docs and use_rag:
            intent = intent_override.lower() if has_manual_intent else "general"
            processed = {
                **FALLBACK_PROCESSED,
                "optimized_prompt": message,
                "intent": intent,
                "needs_rag": True,
            }
            processor_latency_ms = 0.0
        elif has_manual_intent:
            processed = {
                **FALLBACK_PROCESSED,
                "optimized_prompt": message,
                "intent": intent_override.lower(),
                "needs_rag": needs_rag_det,
            }
            processor_latency_ms = 0.0
        else:
            processed, processor_latency_ms = await self._run_processor(message)
            try:
                await ollama.unload_model(settings.PROCESSOR_MODEL)
            except Exception as e:
                logger.debug(f"Failed to unload processor model: {e}")

        if processed["needs_clarification"]:
            yield {
                "type": "clarification",
                "questions": processed["clarification_questions"],
            }
            return

        tool_result = None
        if not processed.get("needs_rag", False):
            tool_result = await self._execute_tool(processed)

        if tool_result is not None:
            response = str(tool_result.get("result", tool_result.get("error", "")))
            try:
                await memory_service.add_message(db, session_id, "user", message)
                await memory_service.add_message(db, session_id, "assistant", response)
            except Exception as e:
                logger.error(f"Failed to add tool messages to memory: {e}")

            yield {
                "type": "tool",
                "intent": processed["intent"],
                "model": tool_result.get("tool", ""),
                "latency_ms": round((time.perf_counter() - start_total) * 1000, 2),
                "response": response,
            }
            return

        needs_rag = processed.get("needs_rag", False)
        should_search_rag = bool(session_docs) and use_rag

        if has_manual_intent:
            routing, routing_latency_ms = await self._run_router(processed)
            model = routing["model"]
        elif should_search_rag:
            model = settings.RAG_MODEL
            routing_latency_ms = 0.0
        else:
            routing, routing_latency_ms = await self._run_router(processed)
            model = routing["model"]

        rag_context = ""
        if should_search_rag and session_docs:
            doc_ids = [str(d.id) for d in session_docs]
            try:
                rag_results = await rag_service.search(
                    query=message,
                    limit=5,
                    score_threshold=0.3,
                    document_ids=doc_ids,
                )
                
                if not rag_results:
                    logger.debug("No chunks met semantic threshold. Fetching raw chunks directly from Postgres.")
                    rag_results = await rag_service.get_raw_chunks(db, doc_ids, limit=5)
                    
                logger.debug(f"needs_rag={needs_rag}, query={processed['optimized_prompt']}, results={len(rag_results)}")
                for r in rag_results:
                    logger.debug(f"hit: doc={r['document_id'][:8]}, chunk={r['chunk_index']}, score={r.get('score', 0):.3f}")
                if rag_results:
                    rag_context = "\n\n".join(
                        f"[Document {r['document_id'][:8]}, Page {r.get('page_num', 'unknown')}]\n{r['content']}"
                        for r in rag_results
                    )
            except Exception as e:
                logger.error(f"RAG search failed: {e}")

        optimized_message = message
        if rag_context:
            optimized_message = (
                "You have access to the following documents uploaded by the user. "
                "If the user's question relates to them, use them to provide a highly accurate answer. "
                "If the question is unrelated to the documents, just answer the question normally without mentioning the documents.\n\n"
                "--- DOCUMENTS ---\n"
                f"{rag_context}\n"
                "-----------------\n\n"
                f"{optimized_message}"
            )
            
        history = []
        try:
            await memory_service.maybe_summarize(db, session_id)
            history = await memory_service.get_history(db, session_id)
        except Exception as e:
            logger.error(f"Memory service failed to get history: {e}")
            
        messages = history + [{"role": "user", "content": optimized_message}]

        system_content = "You are a highly capable AI assistant. Answer directly, clearly, and concisely. Do not hallucinate or invent fictional plots, facts, or characters. If you are unsure, admit it."
        generation_options: dict[str, Any] = {}

        if should_search_rag:
            # Document RAG queries require full explanations without artificial truncation
            system_content += " Answer thoroughly, accurately, and completely based on the provided document context."
            generation_options["num_predict"] = 2048
        elif effort_level == "low":
            system_content += " KEEP YOUR RESPONSE EXTREMELY CONCISE AND BRIEF. ONE OR TWO SENTENCES MAXIMUM. DO NOT ELABORATE."
            generation_options["num_predict"] = 250
        elif effort_level == "high":
            system_content += " PROVIDE A VERY DETAILED, STEP-BY-STEP, COMPREHENSIVE ANSWER. SHOW ALL YOUR REASONING AND EXPLAIN THOROUGHLY."
            generation_options["num_predict"] = 2048
        else:  # medium or default
            system_content += " PROVIDE A BALANCED, MODERATE-LENGTH ANSWER. EXPLAIN THE KEY POINTS CLEARLY AND SUCCINCTLY WITHOUT BEING OVERLY BRIEF OR UNNECESSARILY VERBOSE."
            generation_options["num_predict"] = 1024

        messages.insert(0, {
            "role": "system",
            "content": system_content
        })

        full_response = ""
        done_chunk: dict[str, Any] = {}
        gen_start = time.perf_counter()

        try:
            async for chunk in ollama.stream_chat(model=model, messages=messages, options=generation_options):
                data = json.loads(chunk)

                if "message" in data:
                    token = data["message"]["content"]
                    full_response += token
                    yield {"type": "token", "token": token}

                if data.get("done"):
                    done_chunk = data
                    break
        except Exception as e:
            logger.error(f"Ollama streaming chat failed: {e}")
            full_response += "\n[Error generating response]"
            yield {"type": "token", "token": "\n[Error generating response]"}

        generation_latency_ms = round((time.perf_counter() - gen_start) * 1000, 2)

        try:
            await ollama.unload_model(model)
        except Exception as e:
            logger.debug(f"Failed to unload model {model}: {e}")

        try:
            await memory_service.add_message(db, session_id, "user", message)
            await memory_service.add_message(db, session_id, "assistant", full_response)
        except Exception as e:
            logger.error(f"Memory service failed to add messages: {e}")

        total_latency_ms = round((time.perf_counter() - start_total) * 1000, 2)

        if db is not None:
            try:
                request_data = await build_request_data(
                    message=message,
                    processed=processed,
                    model=model,
                    processor_latency_ms=processor_latency_ms,
                    routing_latency_ms=routing_latency_ms,
                    generation_latency_ms=generation_latency_ms,
                    total_latency_ms=total_latency_ms,
                    response=full_response,
                    ollama_response=done_chunk,
                    session_id=session_id
                )
                log_request(request_data)
                await database_service.save_request_log(db=db, data=request_data)
            except Exception as e:
                logger.error(f"Failed to log request: {e}")

        yield {
            "type": "done",
            "intent": processed["intent"],
            "model": model,
            "latency_ms": total_latency_ms,
            "response": full_response,
        }

    async def _run_processor(self, message: str) -> tuple[dict[str, Any], float]:
        start = time.perf_counter()
        try:
            processed = await processor.process(message)
        except Exception as e:
            logger.error(f"Processor failed: {e}")
            processed = {**FALLBACK_PROCESSED, "optimized_prompt": message}
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        return processed, latency_ms

    async def _run_router(self, processed: dict[str, Any]) -> tuple[dict[str, Any], float]:
        start = time.perf_counter()
        try:
            routing = router.select_model(processed)
        except Exception as e:
            logger.error(f"Router failed: {e}")
            routing = {"model": settings.RAG_MODEL, "intent": "general"}
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        return routing, latency_ms

    async def _execute_tool(self, processed: dict[str, Any]) -> dict[str, Any] | None:
        if not processed.get("needs_tool"):
            return None

        try:
            return await tool_service.execute(
                processed["tool_name"],
                **processed.get("tool_args", {})
            )
        except Exception as e:
            logger.error(f"Tool execution failed: {e}")
            return {"error": str(e)}

chat_pipeline = ChatPipeline()
