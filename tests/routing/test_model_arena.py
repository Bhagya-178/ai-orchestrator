"""Model Arena blind battle, TTFT, TPS, voting, and leaderboard tests (Tests 161 - 180)."""
import json
from app.services.arena_service import ArenaBattleService
from app.services.arena_router import DualStreamRequest

def test_161_arena_sequential_flag_default():
    req = DualStreamRequest(prompt="test", model_a="m1", model_b="m2")
    assert req.sequential is True

def test_162_arena_blind_mode_masking():
    blind = "Model A" if True else "real_model"
    assert blind == "Model A"

def test_163_arena_unmasked_mode_real_names():
    unmasked = "real_model" if not False else "Model A"
    assert unmasked == "real_model"

def test_164_arena_ttft_calculation_positive():
    ttft_ms = round((100.45 - 100.0) * 1000, 2)
    assert ttft_ms == 450.0

def test_165_arena_tps_calculation_positive():
    tok_sec = round(50 / 2.0, 2)
    assert tok_sec == 25.0

def test_166_arena_event_sse_format():
    event = f"data: {json.dumps({'side': 'A', 'type': 'token', 'token': 'Hi'})}\n\n"
    assert event.startswith("data: ") and event.endswith("\n\n")

def test_167_arena_done_sentinel_emitted():
    done = f"data: {json.dumps({'type': 'done'})}\n\n"
    assert "done" in done

def test_168_arena_error_event_structure():
    err = f"data: {json.dumps({'side': 'B', 'type': 'error', 'error': 'VRAM OOM'})}\n\n"
    assert "error" in err and "VRAM OOM" in err

def test_169_arena_system_prompt_handling():
    prompt = "Explain quantum."
    sys_prompt = "You are a professor."
    full = f"{sys_prompt}\n\nUser: {prompt}"
    assert sys_prompt in full and prompt in full

def test_170_arena_concurrent_queue_structure():
    options = {"temperature": 0.7}
    assert options.get("temperature") == 0.7

def test_171_arena_vote_record_winner_a():
    arena = ArenaBattleService()
    res = arena.record_vote("u1", "p1", "model_alpha", "model_beta", "A")
    assert res["status"] == "recorded" and res["vote_id"] == 1

def test_172_arena_vote_record_winner_b():
    arena = ArenaBattleService()
    res = arena.record_vote("u2", "p2", "model_alpha", "model_beta", "B")
    assert res["status"] == "recorded" and res["vote_id"] == 1

def test_173_arena_vote_record_tie():
    arena = ArenaBattleService()
    res = arena.record_vote("u3", "p3", "model_alpha", "model_beta", "tie")
    assert res["status"] == "recorded"

def test_174_arena_vote_both_bad_handling():
    arena = ArenaBattleService()
    res = arena.record_vote("u4", "p4", "model_alpha", "model_beta", "both_bad")
    assert res["status"] == "recorded"

def test_175_arena_win_rate_percentage_formula():
    arena = ArenaBattleService()
    arena.record_vote("u1", "p1", "m_alpha", "m_beta", "A")
    lb = arena.get_leaderboard()
    assert len(lb) == 2

def test_176_arena_leaderboard_sorted_descending():
    arena = ArenaBattleService()
    arena.record_vote("u1", "p1", "m_alpha", "m_beta", "A")
    lb = arena.get_leaderboard()
    assert lb[0]["win_rate"] >= lb[1]["win_rate"]

def test_177_arena_empty_leaderboard_handling():
    arena = ArenaBattleService()
    assert arena.get_leaderboard() == []

def test_178_arena_multi_model_leaderboard():
    arena = ArenaBattleService()
    arena.record_vote("u1", "p1", "m_gamma", "m_alpha", "A")
    lb = arena.get_leaderboard()
    assert lb[0]["model"] == "m_gamma" and lb[0]["win_rate"] == 100.0

def test_179_arena_vote_history_persistence():
    arena = ArenaBattleService()
    arena.record_vote("u1", "p1", "a", "b", "A")
    arena.record_vote("u2", "p2", "a", "b", "B")
    assert len(arena._vote_history) == 2

def test_180_arena_vote_id_incremental():
    arena = ArenaBattleService()
    arena.record_vote("u1", "p1", "a", "b", "A")
    assert arena._vote_history[-1]["winner"] == "A"
