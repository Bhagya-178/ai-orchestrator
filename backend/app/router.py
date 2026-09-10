from typing import Any

from app.registry import MODEL_REGISTRY


class ModelRouter:
    def select_model(self, processed: dict[str, Any]) -> dict[str, Any]:
        """
        Selects the appropriate model based on the processed intent.
        
        Args:
            processed (dict): The processed request information containing 'intent'.
            
        Returns:
            dict: A dictionary containing the selected 'intent' and 'model'.
        """
        intent = processed.get("intent", "general")

        # Never treat multi-agent workflow pseudo-intents as direct model names
        if intent.startswith("workflow:"):
            return {
                "intent": intent,
                "model": MODEL_REGISTRY.get("coding", "qwen2.5-coder:7b")
            }

        # If direct model name is selected (e.g. 'deepseek-r1:8b', 'qwen2.5-coder:7b', or contains ':')
        if ":" in intent or intent in ("qwen3:8b", "deepseek-r1:8b", "qwen2.5-coder:7b", "gemma4:e4b", "qwen2.5:1.5b"):
            return {
                "intent": "direct_model",
                "model": intent
            }

        if intent not in MODEL_REGISTRY:
            intent = "general"

        model = MODEL_REGISTRY.get(
            intent,
            MODEL_REGISTRY.get("general", "qwen3:8b")  # safe fallback
        )

        return {
            "intent": intent,
            "model": model
        }

router = ModelRouter()