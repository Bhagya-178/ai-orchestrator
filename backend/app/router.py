from app.registry import MODEL_REGISTRY


class ModelRouter:

    async def select_model(self, processed: dict) -> dict:

        intent = processed.get("intent", "general")

        model = MODEL_REGISTRY.get(
            intent,
            MODEL_REGISTRY["general"]
        )

        return {
            "intent": intent,
            "model": model
        }


router = ModelRouter()