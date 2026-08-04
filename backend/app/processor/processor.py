import json

from app.ollama_client import ollama
from app.processor.system_prompt import PROCESSOR_SYSTEM_PROMPT


class RequestProcessor:

    MODEL = "qwen2.5:1.5b"

    async def process(self, message: str) -> dict:

        message = message.strip()

        response = await ollama.chat(
            model=self.MODEL,
            messages=[
                {
                    "role": "system",
                    "content": PROCESSOR_SYSTEM_PROMPT
                },
                {
                    "role": "user",
                    "content": message
                }
            ]
        )

        content = (
            response.get("message", {})
           .get("content", "")
           .strip()
         )
        
      
        # Extract JSON if the model wrapped it in markdown
        if "```" in content:
          parts = content.split("```")

          for part in parts:
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
                 content = content[start:end + 1]
              print("=" * 50)
              print(content)
              print("=" * 50)
              result = json.loads(content)

        except Exception :
                  
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
    "reason": "Invalid JSON returned by processor."
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

        valid_intents = {
            "coding",
            "reasoning",
            "study",
            "general"
        }

        if result["intent"] not in valid_intents:
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
        
        VALID_TASK_TYPES = {
    "coding": {
        "code_generation",
        "debugging",
        "code_review",
        "code_explanation",
    },
    "study": {
        "study",
        "summarization",
        "translation",
        "comparison",
    },
    "reasoning": {
        "mathematics",
        "logical_reasoning",
        "architecture",
        "planning",
        "decision",
    },
    "general": {
        "conversation",
        "creative",
        "writing",
    },
}

        if result["task_type"] not in VALID_TASK_TYPES[result["intent"]]:
         result["task_type"] = next(iter(VALID_TASK_TYPES[result["intent"]]))
        
        return result


processor = RequestProcessor()