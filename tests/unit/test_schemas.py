"""Unit tests for Pydantic schemas, validation constraints, and config (Tests 191 - 195, 199 - 200)."""
from pydantic import ValidationError
from app.schemas import ChatRequest, ConversationResponse
from app.services.arena_router import DualStreamRequest, VoteRequest
from app.config import settings, _parse_cors_origins

def test_191_schema_chat_request_validation():
    cr = ChatRequest(message="Hello AI", use_rag=True, effort_level="high")
    assert cr.message == "Hello AI" and cr.effort_level == "high"

def test_192_schema_chat_request_empty_message_error():
    try:
        ChatRequest(message="")
        invalid = False
    except ValidationError:
        invalid = True
    assert invalid is True

def test_193_schema_dual_stream_request_validation():
    dsr = DualStreamRequest(prompt="Compare", model_a="m1", model_b="m2")
    assert dsr.model_a == "m1" and dsr.sequential is True

def test_194_schema_vote_request_winner_literal():
    vr = VoteRequest(prompt="p", model_a="a", model_b="b", winner="tie")
    try:
        VoteRequest(prompt="p", model_a="a", model_b="b", winner="invalid_choice")
        vr_invalid = False
    except ValidationError:
        vr_invalid = True
    assert vr.winner == "tie" and vr_invalid is True

def test_195_schema_conversation_response_defaults():
    conv = ConversationResponse(id="c1", title="Title", updatedAt="2026-09-08", createdAt="2026-09-08")
    assert conv.intent_override == "auto" and conv.effort_level == "medium" and conv.is_pinned is False

def test_199_config_cors_origins_parsing():
    origins = _parse_cors_origins("http://localhost:3000, http://127.0.0.1:3000, https://cloud.ai")
    assert len(origins) == 3 and "https://cloud.ai" in origins

def test_200_config_ollama_keep_alive_setting():
    assert hasattr(settings, "OLLAMA_KEEP_ALIVE")
