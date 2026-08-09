import json

from app.ollama_client import ollama
from app.processor.system_prompt import PROCESSOR_SYSTEM_PROMPT
from app.processor.tool_detector import tool_detector


class RequestProcessor:

    MODEL = "qwen2.5:1.5b"

    # Allowed values, used to coerce whatever the classifier returns
    # into a known shape.
    VALID_INTENTS = {"coding", "reasoning", "study", "general"}

    VALID_TASK_TYPES = {
        "coding": {"code_generation", "debugging", "code_review", "code_explanation"},
        "study": {"study", "summarization", "translation", "comparison"},
        "reasoning": {"mathematics", "logical_reasoning", "architecture", "planning", "decision"},
        "general": {"conversation", "creative", "writing"},
    }

    async def process(self, message: str) -> dict:
        message = message.strip()

        # Deterministic detection first: clear calculator / datetime
        # requests are handled without calling the LLM, so the small
        # classifier model can never misroute them.
        detected = tool_detector.detect(message)

        if detected:
            return {
                "status": "ready",
                "intent": detected["intent"],
                "task_type": detected["task_type"],
                "confidence": 1.0,
                "optimized_prompt": message,
                "needs_clarification": False,
                "clarification_questions": [],
                "entities": [],
                "requires_web": False,
                "needs_tool": True,
                "tool_name": detected["tool_name"],
                "tool_args": detected["tool_args"],
                "reason": f"Deterministic tool detection matched {detected['tool_name']}.",
            }

        # Otherwise let the classifier LLM decide.
        response = await ollama.chat(
            model=self.MODEL,
            messages=[
                {"role": "system", "content": PROCESSOR_SYSTEM_PROMPT},
                {"role": "user", "content": message},
            ],
        )

        content = response.get("message", {}).get("content", "").strip()

        # Extract JSON if the model wrapped it in markdown.
        if "```" in content:
            for part in content.split("```"):
                part = part.strip()
                if part.startswith("json"):
                    part = part[4:].strip()
                if part.startswith("{") and part.endswith("}"):
                    content = part
                    break

        try:
            start = content.find("{")
            end = content.rfind("}")
            if start != -1 and end != -1:
                content = content[start : end + 1]
            result = json.loads(content)
        except Exception:
            return {
                "status": "ready",
                "intent": "general",
                "task_type": "conversation",
                "confidence": 0.0,
                "optimized_prompt": message,
                "needs_clarification": False,
                "clarification_questions": [],
                "entities": [],
                "requires_web": False,
                "needs_tool": False,
                "tool_name": "",
                "tool_args": {},
                "reason": "Invalid JSON returned by processor.",
            }

        # -------- Default Values -------- #
        result.setdefault("status", "ready")
        result.setdefault("intent", "general")
        result.setdefault("task_type", "conversation")
        result.setdefault("confidence", 0.5)
        result.setdefault("optimized_prompt", message)
        result.setdefault("needs_clarification", False)
        result.setdefault("clarification_questions", [])
        result.setdefault("entities", [])
        result.setdefault("requires_web", False)
        result.setdefault("needs_tool", False)
        result.setdefault("tool_name", "")
        result.setdefault("tool_args", {})
        result.setdefault("reason", "")

        # -------- Validation -------- #
        if result["intent"] not in self.VALID_INTENTS:
            result["intent"] = "general"

        if not isinstance(result["confidence"], (int, float)):
            result["confidence"] = 0.5

        if not isinstance(result["entities"], list):
            result["entities"] = []

        if not isinstance(result["clarification_questions"], list):
            result["clarification_questions"] = []

        if not isinstance(result["needs_clarification"], bool):
            result["needs_clarification"] = False

        if not isinstance(result["requires_web"], bool):
            result["requires_web"] = False

        if not isinstance(result["needs_tool"], bool):
            result["needs_tool"] = False

        if not isinstance(result["tool_name"], str):
            result["tool_name"] = ""

        if not isinstance(result["tool_args"], dict):
            result["tool_args"] = {}

        if not result["optimized_prompt"]:
            result["optimized_prompt"] = message

        if result["task_type"] not in self.VALID_TASK_TYPES[result["intent"]]:
            result["task_type"] = next(iter(self.VALID_TASK_TYPES[result["intent"]]))

        # -------- Safety net -------- #
        # The classifier is a small model (qwen2.5:1.5b) that sometimes
        # fails to flag a clear tool request (e.g. "What is the date
        # today?" -> needs_tool: false). Re-run the deterministic detector
        # on the LLM's normalized prompt; typos like "wat time is it" that
        # the raw detector missed may now match. Trust it over the LLM.
        detected = tool_detector.detect(result["optimized_prompt"])
        if detected:
            result["needs_tool"] = True
            result["tool_name"] = detected["tool_name"]
            result["tool_args"] = detected["tool_args"]
            result["intent"] = detected["intent"]
            result["task_type"] = detected["task_type"]

        return result


processor = RequestProcessor()
