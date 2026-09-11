"""Model routing and intent classification tests (Tests 196 - 198)."""
from app.router import router as model_router
from app.registry import MODEL_REGISTRY

def test_196_router_direct_model_tagged_selection():
    routed = model_router.select_model({"intent": "deepseek-r1:8b"})
    assert routed["intent"] == "direct_model" and routed["model"] == "deepseek-r1:8b"

def test_197_router_category_coding_selection():
    routed = model_router.select_model({"intent": "coding"})
    assert routed["intent"] == "coding" and routed["model"] == MODEL_REGISTRY.get("coding")

def test_198_router_unknown_intent_fallback():
    routed = model_router.select_model({"intent": "completely_unknown_category"})
    assert routed["intent"] == "general"
