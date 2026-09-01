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