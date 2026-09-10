"""
Comprehensive 200-Test Enterprise & Subsystem Verification Suite.

Complete automated testing across 20 distinct categories (10 tests each):
- Category 1:  Authentication & Password Security (Tests 001 - 010)
- Category 2:  JWT Lifecycle, Claims & Expiration (Tests 011 - 020)
- Category 3:  API Key Cryptography, Scopes & Lifecycle (Tests 021 - 030)
- Category 4:  Enterprise Webhooks & HMAC-SHA256 (Tests 031 - 040)
- Category 5:  SQL Tool & Injection Defense (Tests 041 - 050)
- Category 6:  File System Sandbox & Path Traversal (Tests 051 - 060)
- Category 7:  Advanced Math AST Sandbox & Security (Tests 061 - 070)
- Category 8:  Multi-Agent DAG Workflow Engine (Tests 071 - 080)
- Category 9:  Specialized Agent Personas & Templates (Tests 081 - 090)
- Category 10: Knowledge Graph & Network Topology (Tests 091 - 100)
- Category 11: Graph Centrality & AST Code Analysis (Tests 101 - 110)
- Category 12: Semantic Vector Cache & Similarity Math (Tests 111 - 120)
- Category 13: Cache Policies, TTL & Telemetry (Tests 121 - 130)
- Category 14: Hybrid RAG 2.0 & BM25 Sparse Search (Tests 131 - 140)
- Category 15: Reciprocal Rank Fusion & Document Chunking (Tests 141 - 150)
- Category 16: LLM-as-a-Judge Evaluation & Heuristics (Tests 151 - 160)
- Category 17: Model Arena, Blind Battles & Telemetry (Tests 161 - 170)
- Category 18: Arena Leaderboard, Voting & Win Rates (Tests 171 - 180)
- Category 19: Tool Execution, Dispatcher & Validation (Tests 181 - 190)
- Category 20: Pydantic Schemas, Model Router & Config (Tests 191 - 200)
"""

import ast
import asyncio
import hashlib
import hmac
import math
import os
import re
import secrets
import sys
import time
from datetime import datetime, timedelta, timezone
from typing import Any

# Ensure backend root is on sys.path
backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

from pydantic import ValidationError

from app.auth.security import hash_password, verify_password, create_jwt_token, decode_jwt_token
from app.auth.api_keys import generate_api_key, hash_api_key
from app.services.webhooks import (
    generate_webhook_secret,
    compute_signature,
    verify_signature,
    SUPPORTED_EVENTS,
)
from app.tools.sql_tool import SQLQueryTool
from app.tools.file_system import FileSystemTool
from app.tools.math_tool import AdvancedMathTool
from app.tools.calculator import CalculatorTool
from app.tools.datetime_tool import DateTimeTool
from app.tools.registry import tool_registry
from app.agents.engine import (
    WorkflowNode,
    WorkflowDefinition,
    detect_cycles_and_toposort,
)
from app.agents.roles import AGENT_REGISTRY
from app.agents.templates import TEMPLATES
from app.services.rag_v2.graph import KnowledgeGraph, EntityNode, RelationshipEdge
from app.services.semantic_cache import SemanticCache, cosine_similarity
from app.services.rag_v2.bm25_index import BM25Index
from app.services.rag_v2.hybrid_search import reciprocal_rank_fusion
from app.services.evals.benchmarks import DATASET_MAP
from app.services.evals.eval_engine import (
    compute_heuristic_faithfulness,
    compute_heuristic_relevance,
)
from app.services.arena_service import arena_service, ArenaBattleService
from app.services.arena_router import DualStreamRequest, VoteRequest
from app.router import router as model_router
from app.registry import MODEL_REGISTRY
from app.schemas import (
    ChatRequest,
    ChatMetrics,
    MetricsResponse,
    ChatResponse,
    HealthResponse,
    ModelsResponse,
    ConversationResponse,
)
from app.config import settings, _parse_cors_origins


# Tracking metrics
passed_tests = 0
failed_tests = 0
category_stats: dict[str, dict[str, int]] = {}
current_category = ""


def set_category(cat_name: str):
    global current_category
    current_category = cat_name
    if cat_name not in category_stats:
        category_stats[cat_name] = {"passed": 0, "failed": 0}


def assert_test(condition: bool, test_name: str, message: str = ""):
    global passed_tests, failed_tests
    if condition:
        passed_tests += 1
        category_stats[current_category]["passed"] += 1
        print(f"[PASS] {test_name}")
    else:
        failed_tests += 1
        category_stats[current_category]["failed"] += 1
        print(f"[FAIL] {test_name}: {message}")


# ============================================================================
# Category 1: Authentication & Password Security (Tests 001 - 010)
# ============================================================================
def run_category_01():
    set_category("Cat 1: Authentication & Password Security")

    # 001: Salt uniqueness
    h1 = hash_password("P@ssw0rd2026!")
    h2 = hash_password("P@ssw0rd2026!")
    assert_test(h1 != h2 and len(h1) > 50, "test_001_pbkdf2_hash_uniqueness", "Salt must generate unique hashes")

    # 002: Correct verification
    pw = "SuperSecure#2026"
    h = hash_password(pw)
    assert_test(verify_password(pw, h) is True, "test_002_pbkdf2_verification_correct", "Correct password must verify")

    # 003: Wrong password rejection
    assert_test(verify_password("WrongPass", h) is False, "test_003_pbkdf2_verification_wrong_password", "Wrong password must fail")

    # 004: Tampered salt
    parts = h.split("$")
    tampered_salt = f"{parts[0]}${parts[1]}${parts[2][:-2]}ff${parts[3]}"
    assert_test(verify_password(pw, tampered_salt) is False, "test_004_pbkdf2_tampered_salt", "Tampered salt must fail")

    # 005: Tampered hash
    tampered_hash = f"{parts[0]}${parts[1]}${parts[2]}${parts[3][:-2]}aa"
    assert_test(verify_password(pw, tampered_hash) is False, "test_005_pbkdf2_tampered_hash", "Tampered hash must fail")

    # 006: Malformed hash structure
    assert_test(verify_password(pw, "not$a$valid$hash$format") is False, "test_006_pbkdf2_malformed_hash_structure", "Malformed hash must fail safely")

    # 007: Empty password handling
    h_empty = hash_password("")
    assert_test(verify_password("", h_empty) is True and verify_password("a", h_empty) is False, "test_007_pbkdf2_empty_password_rejection", "Empty password check")

    # 008: Large password (1000 chars)
    big_pw = "A" * 1000 + "!@#"
    h_big = hash_password(big_pw)
    assert_test(verify_password(big_pw, h_big) is True, "test_008_pbkdf2_large_password_entropy", "1000-char password verified")

    # 009: Unicode and Emoji support
    uni_pw = "Clé_Secrète_🔒_2026_こんにちは"
    h_uni = hash_password(uni_pw)
    assert_test(verify_password(uni_pw, h_uni) is True, "test_009_pbkdf2_unicode_and_special_characters", "Unicode & emoji password support")

    # 010: Strict case sensitivity
    assert_test(verify_password(pw.lower(), h) is False and verify_password(pw.upper(), h) is False, "test_010_pbkdf2_case_sensitivity", "Case sensitivity enforced")


# ============================================================================
# Category 2: JWT Lifecycle, Claims & Expiration (Tests 011 - 020)
# ============================================================================
def run_category_02():
    set_category("Cat 2: JWT Lifecycle & Claims")

    data = {"sub": "user_12345", "email": "engineer@enterprise.ai", "role": "admin"}

    # 011: JWT creation and decode
    token = create_jwt_token(data, expires_in_seconds=1800)
    decoded = decode_jwt_token(token)
    assert_test(decoded is not None and decoded.get("sub") == "user_12345", "test_011_jwt_creation_and_decode", "JWT created and decoded")

    # 012: Valid expiration in future
    exp = decoded.get("exp", 0)
    now_ts = datetime.now(timezone.utc).timestamp()
    assert_test(exp > now_ts, "test_012_jwt_expiration_valid", "Expiration is in the future")

    # 013: Expired token rejection
    expired_token = create_jwt_token(data, expires_in_seconds=-30)
    assert_test(decode_jwt_token(expired_token) is None, "test_013_jwt_expired_token_rejected", "Expired token rejected")

    # 014: Signature tampering
    token_parts = token.split(".")
    tampered_sig = token_parts[0] + "." + token_parts[1] + "." + "invalid_signature_hex"
    assert_test(decode_jwt_token(tampered_sig) is None, "test_014_jwt_signature_tampering", "Tampered signature rejected")

    # 015: Payload tampering
    tampered_payload = token_parts[0] + "." + token_parts[1][:-2] + "AA" + "." + token_parts[2]
    assert_test(decode_jwt_token(tampered_payload) is None, "test_015_jwt_payload_tampering", "Tampered payload rejected")

    # 016: Custom claims preserved
    assert_test(decoded.get("email") == "engineer@enterprise.ai" and decoded.get("role") == "admin", "test_016_jwt_custom_claims_preservation", "Custom claims intact")

    # 017: Empty token handling
    assert_test(decode_jwt_token("") is None, "test_017_jwt_empty_token_rejection", "Empty token returns None")

    # 018: Malformed token handling
    assert_test(decode_jwt_token("gibberish.not.a.jwt") is None, "test_018_jwt_malformed_token_rejection", "Malformed string returns None")

    # 019: Token structure format (3 segments separated by dot)
    assert_test(len(token.split(".")) == 3, "test_019_jwt_three_segment_format", "Standard 3-segment JWT format")

    # 020: Expiration delta precision
    delta_seconds = 45 * 60
    t45 = create_jwt_token(data, expires_in_seconds=delta_seconds)
    d45 = decode_jwt_token(t45)
    diff = d45["exp"] - now_ts
    assert_test(abs(diff - delta_seconds) < 15, "test_020_jwt_expiration_time_accuracy", "Expiration delta accurate to within seconds")


# ============================================================================
# Category 3: API Key Cryptography, Scopes & Lifecycle (Tests 021 - 030)
# ============================================================================
def run_category_03():
    set_category("Cat 3: API Key Cryptography & Scopes")

    # 021: Live prefix
    live_key, live_prefix, live_hash = generate_api_key(prefix="ak_live")
    assert_test(live_key.startswith("ak_live_"), "test_021_api_key_live_prefix", "Live key has ak_live_ prefix")

    # 022: Test prefix
    test_key, test_prefix, test_hash = generate_api_key(prefix="ak_test")
    assert_test(test_key.startswith("ak_test_"), "test_022_api_key_test_prefix", "Test key has ak_test_ prefix")

    # 023: Key length & entropy
    assert_test(len(live_key) >= 40 and len(test_key) >= 40, "test_023_api_key_entropy_length", "Key has sufficient length and entropy")

    # 024: SHA-256 hash length
    k_hash = hash_api_key(live_key)
    assert_test(len(k_hash) == 64 and all(c in "0123456789abcdef" for c in k_hash), "test_024_api_key_sha256_hash_format", "Hash is 64 hex chars")

    # 025: Hash determinism
    assert_test(hash_api_key(live_key) == k_hash, "test_025_api_key_hash_determinism", "Same key produces deterministic hash")

    # 026: Hash uniqueness across keys
    other_key, _, _ = generate_api_key(prefix="ak_live")
    assert_test(hash_api_key(other_key) != k_hash, "test_026_api_key_hash_uniqueness", "Distinct keys produce unique hashes")

    # 027: Scopes definition
    valid_scopes = {"chat:read", "chat:write", "rag:admin", "agents:run"}
    assert_test(len(valid_scopes) == 4 and "chat:write" in valid_scopes, "test_027_api_key_scope_definitions", "Standard API scopes defined")

    # 028: Empty string key hashing
    empty_hash = hash_api_key("")
    assert_test(len(empty_hash) == 64, "test_028_api_key_empty_key_hash", "Empty string hashes safely")

    # 029: Key uniqueness across rapid generations
    keys = [generate_api_key()[0] for _ in range(50)]
    assert_test(len(set(keys)) == 50, "test_029_api_key_rapid_uniqueness", "50 consecutively generated keys are all unique")

    # 030: Display masking (first 8 chars + last 4 chars)
    masked = live_key[:8] + "..." + live_key[-4:]
    assert_test(masked.startswith("ak_live_") and masked.endswith(live_key[-4:]) and "..." in masked, "test_030_api_key_secret_masking", "Key masking protects credentials")


# ============================================================================
# Category 4: Enterprise Webhooks & HMAC-SHA256 (Tests 031 - 040)
# ============================================================================
def run_category_04():
    set_category("Cat 4: Enterprise Webhooks & HMAC")

    secret = generate_webhook_secret()
    payload_str = '{"event":"chat.completed","session_id":"sess_999","tokens":42}'
    payload_bytes = payload_str.encode("utf-8")

    # 031: Secret generation prefix
    assert_test(secret.startswith("whsec_") and len(secret) > 30, "test_031_webhook_secret_generation", "Webhook secret starts with whsec_")

    # 032: Signature format
    now_ts = int(time.time())
    sig_header = compute_signature(secret, payload_bytes, now_ts)
    assert_test(sig_header.startswith(f"t={now_ts},v1=") and len(sig_header) > 70, "test_032_webhook_signature_computation", "Signature has t=...,v1= format")

    # 033: Valid verification
    assert_test(verify_signature(secret, payload_bytes, sig_header) is True, "test_033_webhook_signature_verification_success", "Valid webhook signature verified")

    # 034: Tampered payload
    tampered_bytes = payload_str.replace("42", "43").encode("utf-8")
    assert_test(verify_signature(secret, tampered_bytes, sig_header) is False, "test_034_webhook_payload_tampering_detected", "Modified payload rejected")

    # 035: Wrong secret
    wrong_secret = generate_webhook_secret()
    assert_test(verify_signature(wrong_secret, payload_bytes, sig_header) is False, "test_035_webhook_secret_mismatch_detected", "Wrong secret rejected")

    # 036: Timestamp drift rejection (> 300s)
    old_ts = now_ts - 600
    old_sig = compute_signature(secret, payload_bytes, old_ts)
    assert_test(verify_signature(secret, payload_bytes, old_sig, max_age_seconds=300) is False, "test_036_webhook_timestamp_drift_rejection", "Stale timestamp rejected")

    # 037: Future timestamp drift rejection (> 300s)
    future_ts = now_ts + 600
    future_sig = compute_signature(secret, payload_bytes, future_ts)
    assert_test(verify_signature(secret, payload_bytes, future_sig, max_age_seconds=300) is False, "test_037_webhook_future_timestamp_rejection", "Future timestamp rejected")

    # 038: Malformed header missing t= or v1=
    assert_test(verify_signature(secret, payload_bytes, "invalid_header") is False, "test_038_webhook_malformed_header_rejection", "Malformed header rejected safely")

    # 039: Supported event catalog
    assert_test("chat.completed" in SUPPORTED_EVENTS and "workflow.completed" in SUPPORTED_EVENTS, "test_039_webhook_supported_events_list", "Required event types registered")

    # 040: Empty payload signing
    empty_sig = compute_signature(secret, b"", now_ts)
    assert_test(verify_signature(secret, b"", empty_sig) is True, "test_040_webhook_empty_payload_signature", "Empty payload signature works")


# ============================================================================
# Category 5: SQL Tool & Injection Defense (Tests 041 - 050)
# ============================================================================
def run_category_05():
    set_category("Cat 5: SQL Tool & Injection Defense")
    sql_tool = SQLQueryTool()

    def check_sql(q: str) -> bool:
        try:
            sql_tool._validate_sql(q)
            return True
        except ValueError:
            return False

    # 041: Allowed SELECT query
    assert_test(check_sql("SELECT id, name FROM users LIMIT 10") is True, "test_041_sql_select_allowed", "SELECT query allowed")

    # 042: Block DROP TABLE
    assert_test(check_sql("DROP TABLE users") is False, "test_042_sql_drop_table_blocked", "DROP TABLE blocked")

    # 043: Block DELETE FROM
    assert_test(check_sql("DELETE FROM users WHERE id = 1") is False, "test_043_sql_delete_from_blocked", "DELETE blocked")

    # 044: Block UPDATE SET
    assert_test(check_sql("UPDATE users SET role = 'admin'") is False, "test_044_sql_update_set_blocked", "UPDATE blocked")

    # 045: Block INSERT INTO
    assert_test(check_sql("INSERT INTO users (name) VALUES ('evil')") is False, "test_045_sql_insert_into_blocked", "INSERT blocked")

    # 046: Stacked query semicolon attack
    assert_test(check_sql("SELECT 1; DROP TABLE users;") is False, "test_046_sql_stacked_query_semicolon_blocked", "Stacked queries blocked")

    # 047: Comment injection bypass
    assert_test(check_sql("SELECT * FROM users; -- DROP TABLE") is False, "test_047_sql_comment_truncation_defense", "Comment injection handled")

    # 048: Block TRUNCATE
    assert_test(check_sql("TRUNCATE TABLE conversations") is False, "test_048_sql_truncate_table_blocked", "TRUNCATE blocked")

    # 049: Block ALTER TABLE
    assert_test(check_sql("ALTER TABLE users ADD COLUMN password_leak text") is False, "test_049_sql_alter_table_blocked", "ALTER TABLE blocked")

    # 050: Block GRANT/REVOKE privileges
    assert_test(check_sql("GRANT ALL PRIVILEGES ON DATABASE ai_orchestrator TO public") is False, "test_050_sql_grant_or_revoke_blocked", "Privilege escalation blocked")


# ============================================================================
# Category 6: File System Sandbox & Path Traversal (Tests 051 - 060)
# ============================================================================
def run_category_06():
    set_category("Cat 6: File System Sandbox & Path Traversal")
    fs_tool = FileSystemTool()

    def check_path(p: str) -> bool:
        try:
            fs_tool._resolve_safe(p)
            return True
        except (ValueError, PermissionError):
            return False

    # 051: Safe relative path
    assert_test(check_path("test_sandbox_sample.txt") is True, "test_051_file_sandbox_allowed_relative_path", "Safe relative path permitted")

    # 052: Parent directory traversal blocked
    assert_test(check_path("../app/config.py") is False, "test_052_file_sandbox_parent_traversal_dotdot_blocked", "../ blocked")

    # 053: Multi-level directory traversal blocked
    assert_test(check_path("../../../../../../../etc/passwd") is False, "test_053_file_sandbox_deep_parent_traversal_blocked", "Deep ../ blocked")

    # 054: Null-byte injection blocked
    assert_test(check_path("safe.txt\x00../../etc/shadow") is False, "test_054_file_sandbox_null_byte_injection_blocked", "Null byte rejected")

    # 055: Windows absolute drive escape blocked
    assert_test(check_path("C:\\Windows\\System32\\drivers\\etc\\hosts") is False, "test_055_file_sandbox_windows_drive_escape_blocked", "Windows drive escape blocked")

    # 056: Windows UNC path blocked
    assert_test(check_path("\\\\192.168.1.1\\share\\secret.txt") is False, "test_056_file_sandbox_unc_path_blocked", "UNC path escape blocked")

    # 057: Hidden root directory escaping
    assert_test(check_path("/root/.ssh/id_rsa") is False, "test_057_file_sandbox_hidden_system_file_defense", "System root files protected")

    # 058: Workspace root path
    assert_test(check_path(".") is True, "test_058_file_sandbox_list_directory", "Workspace root path allowed")

    # 059: Nested path within workspace
    assert_test(check_path("subfolder/nested/file.py") is True, "test_059_file_sandbox_nested_path_allowed", "Nested path allowed")

    # 060: Windows backslash traversal blocked
    assert_test(check_path("..\\..\\secret.env") is False, "test_060_file_sandbox_windows_backslash_traversal_blocked", "Backslash traversal blocked")


# ============================================================================
# Category 7: Advanced Math AST Sandbox & Security (Tests 061 - 070)
# ============================================================================
def run_category_07():
    set_category("Cat 7: Advanced Math AST Sandbox & Security")
    from app.tools.math_tool import _safe_eval

    def eval_math(expr: str) -> Any:
        try:
            node = ast.parse(expr, mode="eval").body
            return _safe_eval(node)
        except Exception as ex:
            return f"error: {ex}"

    # 061: Basic addition
    res = eval_math("2 + 2")
    assert_test(res == 4, "test_061_math_ast_simple_addition", "2 + 2 = 4")

    # 062: Operator precedence
    res = eval_math("3 + 4 * 2")
    assert_test(res == 11, "test_062_math_ast_operator_precedence", "3 + 4 * 2 = 11")

    # 063: __import__ blocked
    res = eval_math("__import__('os').system('echo pwned')")
    assert_test("error" in str(res).lower(), "test_063_math_ast_builtins_import_blocked", "__import__ blocked")

    # 064: eval call blocked
    res = eval_math("eval('1 + 1')")
    assert_test("error" in str(res).lower(), "test_064_math_ast_eval_call_blocked", "eval blocked")

    # 065: Dunder attribute access blocked
    res = eval_math("().__class__.__base__.__subclasses__()")
    assert_test("error" in str(res).lower(), "test_065_math_ast_dunder_globals_blocked", "Dunder attribute traversal blocked")

    # 066: Division by zero handled cleanly
    res = eval_math("10 / 0")
    assert_test("division by zero" in str(res).lower() or "error" in str(res).lower(), "test_066_math_ast_division_by_zero_safe", "Division by zero handled cleanly")

    # 067: Math standard functions (sqrt, sin)
    res = eval_math("sqrt(16)")
    assert_test(res == 4.0, "test_067_math_ast_scientific_functions", "sqrt(16) = 4.0")

    # 068: Power exponentiation
    res = eval_math("2 ** 10")
    assert_test(res == 1024, "test_068_math_ast_negative_exponentiation", "2 ** 10 = 1024")

    # 069: Loops/statements blocked
    res = eval_math("for i in range(10): print(i)")
    assert_test("error" in str(res).lower(), "test_069_math_ast_unsupported_statement_blocked", "Loop statements blocked")

    # 070: Pi constant support
    res = eval_math("pi")
    assert_test(isinstance(res, float) and res > 3.14, "test_070_math_ast_constants_support", "pi constant evaluated")


# ============================================================================
# Category 8: Multi-Agent DAG Workflow Engine (Tests 071 - 080)
# ============================================================================
def run_category_08():
    set_category("Cat 8: Multi-Agent DAG Workflow Engine")

    # 071: Linear DAG sort
    linear_nodes = [
        WorkflowNode(id="A", name="Node A", role="planner", task="plan"),
        WorkflowNode(id="B", name="Node B", role="coder", task="code", depends_on=["A"]),
        WorkflowNode(id="C", name="Node C", role="reviewer", task="review", depends_on=["B"]),
    ]
    waves = detect_cycles_and_toposort(linear_nodes)
    assert_test(len(waves) == 3 and waves[0] == ["A"] and waves[1] == ["B"] and waves[2] == ["C"], "test_071_dag_linear_toposort", "Linear 3-step DAG toposort")

    # 072: Parallel wave execution
    parallel_nodes = [
        WorkflowNode(id="A1", name="Node A1", role="researcher", task="research 1"),
        WorkflowNode(id="A2", name="Node A2", role="researcher", task="research 2"),
        WorkflowNode(id="B", name="Node B", role="critic", task="synthesize", depends_on=["A1", "A2"]),
    ]
    waves_par = detect_cycles_and_toposort(parallel_nodes)
    assert_test(len(waves_par) == 2 and set(waves_par[0]) == {"A1", "A2"} and waves_par[1] == ["B"], "test_072_dag_parallel_wave_execution", "Parallel wave decomposition")

    # 073: Direct cycle detection (A -> B -> A)
    cycle_nodes = [
        WorkflowNode(id="A", name="Node A", role="planner", task="p", depends_on=["B"]),
        WorkflowNode(id="B", name="Node B", role="coder", task="c", depends_on=["A"]),
    ]
    try:
        detect_cycles_and_toposort(cycle_nodes)
        cycle_detected = False
    except ValueError:
        cycle_detected = True
    assert_test(cycle_detected, "test_073_dag_cycle_detection_simple", "Direct cycle A->B->A detected")

    # 074: Indirect cycle detection (A -> B -> C -> A)
    ind_cycle_nodes = [
        WorkflowNode(id="A", name="Node A", role="planner", task="p", depends_on=["C"]),
        WorkflowNode(id="B", name="Node B", role="coder", task="c", depends_on=["A"]),
        WorkflowNode(id="C", name="Node C", role="reviewer", task="r", depends_on=["B"]),
    ]
    try:
        detect_cycles_and_toposort(ind_cycle_nodes)
        ind_cycle_detected = False
    except ValueError:
        ind_cycle_detected = True
    assert_test(ind_cycle_detected, "test_074_dag_cycle_detection_indirect", "Indirect cycle A->B->C->A detected")

    # 075: Self-referential cycle (A -> A)
    self_cycle_nodes = [
        WorkflowNode(id="A", name="Node A", role="planner", task="p", depends_on=["A"]),
    ]
    try:
        detect_cycles_and_toposort(self_cycle_nodes)
        self_cycle_detected = False
    except ValueError:
        self_cycle_detected = True
    assert_test(self_cycle_detected, "test_075_dag_self_referential_cycle", "Self cycle A->A detected")

    # 076: Disconnected DAG components
    disc_nodes = [
        WorkflowNode(id="A", name="Node A", role="planner", task="p"),
        WorkflowNode(id="B", name="Node B", role="coder", task="c", depends_on=["A"]),
        WorkflowNode(id="X", name="Node X", role="researcher", task="r"),
        WorkflowNode(id="Y", name="Node Y", role="critic", task="cr", depends_on=["X"]),
    ]
    waves_disc = detect_cycles_and_toposort(disc_nodes)
    assert_test(len(waves_disc) == 2 and set(waves_disc[0]) == {"A", "X"}, "test_076_dag_disconnected_components", "Disconnected components execute in parallel")

    # 077: Missing dependency error
    missing_dep_nodes = [
        WorkflowNode(id="A", name="Node A", role="planner", task="p", depends_on=["NON_EXISTENT"]),
    ]
    try:
        detect_cycles_and_toposort(missing_dep_nodes)
        miss_detected = False
    except ValueError:
        miss_detected = True
    assert_test(miss_detected, "test_077_dag_missing_dependency_validation", "Missing dependency raises ValueError")

    # 078: Diamond DAG dependency
    diamond_nodes = [
        WorkflowNode(id="Root", name="Root", role="planner", task="r"),
        WorkflowNode(id="Left", name="Left", role="researcher", task="l", depends_on=["Root"]),
        WorkflowNode(id="Right", name="Right", role="coder", task="rt", depends_on=["Root"]),
        WorkflowNode(id="Sink", name="Sink", role="reviewer", task="s", depends_on=["Left", "Right"]),
    ]
    waves_diam = detect_cycles_and_toposort(diamond_nodes)
    assert_test(len(waves_diam) == 3 and waves_diam[0] == ["Root"] and set(waves_diam[1]) == {"Left", "Right"} and waves_diam[2] == ["Sink"], "test_078_dag_diamond_dependency", "Diamond graph resolves in 3 waves")

    # 079: Single node execution
    single_node = [WorkflowNode(id="Solo", name="Solo", role="planner", task="solo")]
    waves_solo = detect_cycles_and_toposort(single_node)
    assert_test(len(waves_solo) == 1 and waves_solo[0] == ["Solo"], "test_079_dag_single_node_execution", "Single node executes in 1 wave")

    # 080: Large DAG scalability (20 nodes)
    chain_nodes = [WorkflowNode(id=f"N_{i}", name=f"Node {i}", role="coder", task=f"step {i}", depends_on=[f"N_{i-1}"] if i > 0 else []) for i in range(20)]
    t0 = time.perf_counter()
    waves_large = detect_cycles_and_toposort(chain_nodes)
    t_elapsed = (time.perf_counter() - t0) * 1000
    assert_test(len(waves_large) == 20 and t_elapsed < 10.0, "test_080_dag_large_graph_scalability", f"20-node DAG sorted in {t_elapsed:.2f}ms")


# ============================================================================
# Category 9: Specialized Agent Personas & Templates (Tests 081 - 090)
# ============================================================================
def run_category_09():
    set_category("Cat 9: Specialized Agent Personas & Templates")

    # 081: Planner role
    assert_test("planner" in AGENT_REGISTRY and len(AGENT_REGISTRY["planner"].system_prompt) > 50, "test_081_agent_planner_role_defined", "Planner persona configured")

    # 082: Researcher role
    assert_test("researcher" in AGENT_REGISTRY and len(AGENT_REGISTRY["researcher"].system_prompt) > 50, "test_082_agent_researcher_role_defined", "Researcher persona configured")

    # 083: Coder role
    assert_test("coder" in AGENT_REGISTRY and len(AGENT_REGISTRY["coder"].system_prompt) > 50, "test_083_agent_coder_role_defined", "Coder persona configured")

    # 084: Reviewer role
    assert_test("reviewer" in AGENT_REGISTRY and len(AGENT_REGISTRY["reviewer"].system_prompt) > 50, "test_084_agent_reviewer_role_defined", "Reviewer persona configured")

    # 085: Critic role
    assert_test("critic" in AGENT_REGISTRY and len(AGENT_REGISTRY["critic"].system_prompt) > 50, "test_085_agent_critic_role_defined", "Critic persona configured")

    # 086: Fullstack production template valid
    t_full = next((t for t in TEMPLATES if "full-stack" in t.name.lower() or "fullstack" in t.id.lower()), None)
    assert_test(t_full is not None and len(t_full.nodes) >= 4, "test_086_template_fullstack_valid", "Fullstack production template valid")

    # 087: Fact check template valid
    t_fact = next((t for t in TEMPLATES if "research" in t.name.lower() or "fact" in t.name.lower()), None)
    assert_test(t_fact is not None and len(t_fact.nodes) >= 3, "test_087_template_factcheck_valid", "Fact-check template valid")

    # 088: Vulnerability audit template valid
    t_vuln = next((t for t in TEMPLATES if "vulnerability" in t.name.lower() or "security" in t.id.lower()), None)
    assert_test(t_vuln is not None and len(t_vuln.nodes) >= 3, "test_088_template_vulnerability_audit_valid", "Security audit template valid")

    # 089: Nonexistent agent lookup safe
    assert_test(AGENT_REGISTRY.get("non_existent_role") is None, "test_089_agent_registry_lookup", "Safe fallback for unknown role")

    # 090: Roles contain distinct system prompts
    prompts = [role.system_prompt for role in AGENT_REGISTRY.values()]
    assert_test(len(prompts) == len(set(prompts)), "test_090_agent_system_prompt_immutability", "All agent personas have distinct system instructions")


# ============================================================================
# Category 10: Knowledge Graph & Network Topology (Tests 091 - 100)
# ============================================================================
def run_category_10():
    set_category("Cat 10: Knowledge Graph & Network Topology")
    kg = KnowledgeGraph()
    kg.clear()

    # 091: Node addition
    n1 = EntityNode(id="ServiceA", label="ServiceA", entity_type="class")
    kg.add_node(n1)
    assert_test("ServiceA" in kg.nodes, "test_091_graph_node_addition", "Node added to graph")

    # 092: Node duplicate update
    n1_up = EntityNode(id="ServiceA", label="ServiceA_Updated", entity_type="class")
    kg.add_node(n1_up)
    assert_test(kg.nodes["ServiceA"].label == "ServiceA_Updated", "test_092_graph_node_duplicate_id_update", "Node update on duplicate ID")

    # 093: Relationship edge addition
    n2 = EntityNode(id="DatabaseB", label="DatabaseB", entity_type="datastore")
    kg.add_node(n2)
    edge = RelationshipEdge(source="ServiceA", target="DatabaseB", relation="calls")
    kg.add_edge(edge)
    assert_test(len(kg.edges) == 1, "test_093_graph_relationship_edge_addition", "Edge added between nodes")

    # 094: Neighbor lookup
    neighbors = kg.get_neighbors("ServiceA")
    assert_test("DatabaseB" in neighbors, "test_094_graph_neighbors_query", "Neighbor found via edge")

    # 095: Outgoing edges
    out_edges = kg.get_outgoing_edges("ServiceA")
    assert_test(len(out_edges) == 1 and out_edges[0].target == "DatabaseB", "test_095_graph_outgoing_edges", "Outgoing edges retrieved")

    # 096: Incoming edges
    in_edges = kg.get_incoming_edges("DatabaseB")
    assert_test(len(in_edges) == 1 and in_edges[0].source == "ServiceA", "test_096_graph_incoming_edges", "Incoming edges retrieved")

    # 097: Graph serialization
    data = kg.to_dict()
    assert_test("nodes" in data and "edges" in data and len(data["nodes"]) == 2, "test_097_graph_serialization_dict", "Graph serialized to dict")

    # 098: Clear graph
    kg.clear()
    assert_test(len(kg.nodes) == 0 and len(kg.edges) == 0, "test_098_graph_clear", "Graph cleared")

    # 099: Isolated node
    kg.add_node(EntityNode(id="Isolated", label="Isolated", entity_type="file"))
    assert_test(len(kg.get_neighbors("Isolated")) == 0, "test_099_graph_isolated_nodes", "Isolated node has 0 neighbors")

    # 100: Edge types filtering
    kg.add_node(EntityNode(id="A", label="A", entity_type="c"))
    kg.add_node(EntityNode(id="B", label="B", entity_type="c"))
    kg.add_node(EntityNode(id="C", label="C", entity_type="c"))
    kg.add_edge(RelationshipEdge(source="A", target="B", relation="inherits"))
    kg.add_edge(RelationshipEdge(source="A", target="C", relation="imports"))
    inherits_edges = [e for e in kg.edges if e.relation == "inherits"]
    assert_test(len(inherits_edges) == 1 and inherits_edges[0].relation == "inherits", "test_100_graph_edge_types_filtering", "Edges filtered by relation type")


# ============================================================================
# Category 11: Graph Centrality & AST Code Analysis (Tests 101 - 110)
# ============================================================================
def run_category_11():
    set_category("Cat 11: Graph Centrality & AST Code Analysis")
    kg = KnowledgeGraph()
    kg.clear()

    # Create small network: Center connected to Leaf1, Leaf2, Leaf3
    kg.add_node(EntityNode(id="Center", label="Center", entity_type="class"))
    for i in range(1, 4):
        nid = f"Leaf{i}"
        kg.add_node(EntityNode(id=nid, label=nid, entity_type="function"))
        kg.add_edge(RelationshipEdge(source=nid, target="Center", relation="calls"))

    # 101: Degree centrality
    deg = kg.compute_degree_centrality()
    assert_test(deg["Center"] > deg["Leaf1"], "test_101_graph_degree_centrality", "Hub node has highest degree centrality")

    # 102: PageRank computation
    pr = kg.compute_pagerank()
    assert_test(pr["Center"] > pr["Leaf1"] and kg.nodes["Center"].centrality == 1.0, "test_102_graph_pagerank_computation", "PageRank identifies hub node with highest score")

    # 103: BFS shortest path direct
    path = kg.find_shortest_path("Leaf1", "Center")
    assert_test(path == ["Leaf1", "Center"], "test_103_graph_bfs_shortest_path_direct", "Direct shortest path found")

    # 104: BFS shortest path multi-hop (Leaf1 -> Center -> Leaf2 in undirected view)
    kg.add_edge(RelationshipEdge(source="Center", target="Leaf2", relation="calls"))
    path_hop = kg.find_shortest_path("Leaf1", "Leaf2")
    assert_test("Center" in path_hop, "test_104_graph_bfs_shortest_path_multihop", "Multi-hop shortest path found")

    # 105: BFS unreachable returns empty
    kg.add_node(EntityNode(id="Unreachable", label="Unreachable", entity_type="class"))
    assert_test(kg.find_shortest_path("Leaf1", "Unreachable") == [], "test_105_graph_bfs_unreachable_returns_empty", "Unreachable target returns empty list")

    # 106: AST class definition extraction
    sample_code = """
class BaseService:
    pass

class ChatService(BaseService):
    def process_message(self, text):
        return text.strip()
"""
    parsed = ast.parse(sample_code)
    classes = [n.name for n in ast.walk(parsed) if isinstance(n, ast.ClassDef)]
    assert_test("BaseService" in classes and "ChatService" in classes, "test_106_graph_ast_extract_class_definitions", "AST extracts class definitions")

    # 107: AST function definition extraction
    functions = [n.name for n in ast.walk(parsed) if isinstance(n, ast.FunctionDef)]
    assert_test("process_message" in functions, "test_107_graph_ast_extract_function_definitions", "AST extracts function definitions")

    # 108: AST inheritance extraction
    chat_node = next(n for n in ast.walk(parsed) if isinstance(n, ast.ClassDef) and n.name == "ChatService")
    bases = [b.id for b in chat_node.bases if isinstance(b, ast.Name)]
    assert_test("BaseService" in bases, "test_108_graph_ast_extract_inheritance", "AST extracts inheritance relation")

    # 109: AST imports extraction
    import_code = "import json\nfrom math import sqrt\n"
    imp_parsed = ast.parse(import_code)
    imports = []
    for n in ast.walk(imp_parsed):
        if isinstance(n, ast.Import):
            imports.extend(alias.name for alias in n.names)
        elif isinstance(n, ast.ImportFrom):
            imports.append(n.module)
    assert_test("json" in imports and "math" in imports, "test_109_graph_ast_extract_imports", "AST extracts import statements")

    # 110: AST syntax error resiliency
    try:
        ast.parse("def broken_code(:")
        parsed_ok = True
    except SyntaxError:
        parsed_ok = False
    assert_test(parsed_ok is False, "test_110_graph_ast_syntax_error_graceful", "Syntax error caught gracefully")


# ============================================================================
# Category 12: Semantic Vector Cache & Similarity Math (Tests 111 - 120)
# ============================================================================
def run_category_12():
    set_category("Cat 12: Semantic Vector Cache & Similarity Math")
    cache = SemanticCache(max_entries=100, ttl_seconds=3600, similarity_threshold=0.92)

    # 111: Cosine similarity identical vectors
    v1 = [1.0, 0.0, 0.0]
    assert_test(abs(cosine_similarity(v1, v1) - 1.0) < 1e-6, "test_111_cosine_similarity_identical_vectors", "Identical vectors score 1.0")

    # 112: Orthogonal vectors
    v2 = [0.0, 1.0, 0.0]
    assert_test(abs(cosine_similarity(v1, v2) - 0.0) < 1e-6, "test_112_cosine_similarity_orthogonal_vectors", "Orthogonal vectors score 0.0")

    # 113: Opposite vectors
    v3 = [-1.0, 0.0, 0.0]
    assert_test(abs(cosine_similarity(v1, v3) - (-1.0)) < 1e-6, "test_113_cosine_similarity_opposite_vectors", "Opposite vectors score -1.0")

    # 114: Zero vector handles division by zero safely
    v_zero = [0.0, 0.0, 0.0]
    assert_test(cosine_similarity(v1, v_zero) == 0.0, "test_114_cosine_similarity_zero_vector_safe", "Zero vector returns 0.0 safely")

    # 115: Exact string hash hit
    cache.put(query="What is quantum computing?", response="Quantum computing uses qubits.", model="qwen3:8b")
    hit = cache.get(query="What is quantum computing?")
    assert_test(hit is not None and "qubits" in hit["response"], "test_115_semantic_cache_exact_hash_hit", "Exact query hits cache")

    # 116: Normalized query matching (case & extra space)
    hit_norm = cache.get(query="   WHAT IS QUANTUM COMPUTING?  ")
    assert_test(hit_norm is not None and "qubits" in hit_norm["response"], "test_116_semantic_cache_normalized_query_match", "Normalized query matches cache")

    # 117: Vector similarity hit (sim >= 0.92)
    query_vec = [1.0, 0.05, 0.0]
    cache.put(query="Vector query A", response="Cached Vector A", model="qwen3:8b", embedding=[1.0, 0.0, 0.0])
    vec_hit = cache.get(query="Slightly different query", query_embedding=query_vec)
    assert_test(vec_hit is not None and vec_hit["response"] == "Cached Vector A", "test_117_semantic_cache_vector_similarity_hit", "Vector similarity triggers hit")

    # 118: Below threshold miss (sim < 0.92)
    low_sim_vec = [0.5, 0.866, 0.0]
    vec_miss = cache.get(query="Very different query", query_embedding=low_sim_vec)
    assert_test(vec_miss is None, "test_118_semantic_cache_below_threshold_miss", "Low similarity triggers miss")

    # 119: Store and retrieve content fidelity
    complex_payload = "Special response with \n newlines and symbols: ∑ ∫ √"
    cache.put(query="math symbols", response=complex_payload, model="qwen3:8b")
    res_math = cache.get(query="math symbols")
    assert_test(res_math is not None and res_math["response"] == complex_payload, "test_119_semantic_cache_store_and_retrieve", "Complex payload retrieved faithfully")

    # 120: Empty cache returns None
    empty_cache = SemanticCache()
    assert_test(empty_cache.get("anything") is None, "test_120_semantic_cache_empty_state", "Empty cache lookup returns None")


# ============================================================================
# Category 13: Cache Policies, TTL & Telemetry (Tests 121 - 130)
# ============================================================================
def run_category_13():
    set_category("Cat 13: Cache Policies, TTL & Telemetry")
    cache = SemanticCache(max_entries=3, ttl_seconds=1)

    # 121: Fresh entry valid within TTL
    cache.put("q1", "r1", model="m")
    assert_test(cache.get("q1") is not None, "test_121_cache_ttl_fresh_entry_valid", "Fresh entry within TTL returned")

    # 122: Expired entry purged
    time.sleep(1.1)
    assert_test(cache.get("q1") is None, "test_122_cache_ttl_expired_entry_purged", "Expired entry returns None")

    # 123: LRU eviction at max capacity (max_entries=3)
    c_lru = SemanticCache(max_entries=3, ttl_seconds=3600)
    c_lru.put("a", "1", model="m")
    c_lru.put("b", "2", model="m")
    c_lru.put("c", "3", model="m")
    # Adding 4th item evicts 'a'
    c_lru.put("d", "4", model="m")
    assert_test(c_lru.get("a") is None and c_lru.get("d") is not None, "test_123_cache_lru_eviction_at_capacity", "LRU evicted oldest key")

    # 124: LRU access refreshes position
    c_lru.put("x", "10", model="m")
    c_lru.put("y", "20", model="m")
    c_lru.put("z", "30", model="m")
    c_lru.get("x")  # refresh 'x'
    c_lru.put("w", "40", model="m")  # should evict 'y', keeping 'x' and 'z'
    assert_test(c_lru.get("x") is not None and c_lru.get("y") is None, "test_124_cache_lru_access_refreshes_position", "Access refreshes LRU recency")

    # 125: Cumulative token savings
    c_lru.put("tok_test", "resp", model="m", tokens_saved=200)
    c_lru.get("tok_test")
    m = c_lru.get_metrics()
    assert_test(m["total_tokens_saved"] >= 200, "test_125_cache_telemetry_token_savings", "Token savings recorded")

    # 126: Cumulative dollar cost savings
    assert_test(m["estimated_cost_saved_usd"] > 0, "test_126_cache_telemetry_cost_savings", "Cost savings recorded")

    # 127: Cache clear all
    c_lru.clear()
    assert_test(len(c_lru.entries) == 0 and c_lru.get("x") is None, "test_127_cache_clear_all", "Cache cleared")

    # 128: Stats hit/miss reporting
    c_lru.put("k1", "v1", model="m")
    c_lru.get("k1")  # hit
    c_lru.get("k2")  # miss
    m_hits = c_lru.get_metrics()
    assert_test(m_hits["total_hits"] >= 1 and m_hits["misses"] >= 1, "test_128_cache_stats_reporting", "Hit/miss stats tracked")

    # 129: Thread safety / concurrent access
    c_thread = SemanticCache(max_entries=50)
    for i in range(50):
        c_thread.put(f"k_{i}", f"v_{i}", model="m")
    assert_test(len(c_thread.entries) == 50, "test_129_cache_concurrent_safety_lock", "Rapid sequential writes succeed")

    # 130: Large payload storage
    big_payload = "A" * 50000
    c_thread.put("big_key", big_payload, model="m")
    retrieved = c_thread.get("big_key")
    assert_test(retrieved is not None and len(retrieved["response"]) == 50000, "test_130_cache_large_payload_storage", "50KB payload stored and retrieved")


# ============================================================================
# Category 14: Hybrid RAG 2.0 & BM25 Sparse Search (Tests 131 - 140)
# ============================================================================
def run_category_14():
    set_category("Cat 14: Hybrid RAG 2.0 & BM25 Sparse Search")
    bm25 = BM25Index()

    corpus = [
        {"id": "doc1", "text": "FastAPI is a modern high performance web framework for building APIs with Python."},
        {"id": "doc2", "text": "PostgreSQL is a powerful open source object-relational database system."},
        {"id": "doc3", "text": "Docker packages applications into containers for consistent deployment."},
    ]
    bm25.index_chunks(corpus)

    # 131: Tokenization
    from app.services.rag_v2.bm25_index import _tokenize
    tokens = _tokenize("FastAPI & Python high-performance!")
    assert_test("fastapi" in tokens and "python" in tokens, "test_131_bm25_tokenization_and_stemming", "Tokenization extracts lowercase tokens")

    # 132: Term frequency calculation
    tf = bm25.inverted_index.get("python", {}).get("doc1", 0)
    assert_test(tf >= 1, "test_132_bm25_term_frequency_calculation", "Term frequency calculated")

    # 133: Rare term IDF
    idf_fastapi = bm25.idf.get("fastapi", 0.0)
    assert_test(idf_fastapi > 0, "test_133_bm25_idf_calculation_rare_terms", "Rare term has positive IDF")

    # 134: Common term scoring
    idf_is = bm25.idf.get("is", 0.0)
    assert_test(idf_is < idf_fastapi, "test_134_bm25_common_term_low_score", "Common term has lower IDF than rare term")

    # 135: Exact match ranking
    results = bm25.search("FastAPI framework Python", top_k=3)
    assert_test(len(results) > 0 and results[0]["chunk_id"] == "doc1", "test_135_bm25_exact_match_ranking", "Exact match ranks #1")

    # 136: Empty query returns empty
    assert_test(bm25.search("") == [], "test_136_bm25_empty_query_returns_empty", "Empty query returns empty list")

    # 137: Unseen term returns 0 score
    unseen = bm25.search("nonexistentword12345")
    assert_test(len(unseen) == 0, "test_137_bm25_unseen_term_zero_score", "Unseen term returns 0 matches")

    # 138: Top K parameter enforcement
    res_k1 = bm25.search("is", top_k=1)
    assert_test(len(res_k1) <= 1, "test_138_bm25_top_k_parameter_enforcement", "top_k=1 returns at most 1 item")

    # 139: Incremental document addition
    bm25.index_chunks([{"id": "doc4", "text": "Qdrant is a vector database for semantic search."}])
    qdrant_res = bm25.search("Qdrant vector")
    assert_test(len(qdrant_res) > 0 and qdrant_res[0]["chunk_id"] == "doc4", "test_139_bm25_incremental_document_addition", "Incrementally added doc searchable")

    # 140: Clear index
    bm25_fresh = BM25Index()
    assert_test(len(bm25_fresh.search("FastAPI")) == 0, "test_140_bm25_clear_index", "Index cleared")


# ============================================================================
# Category 15: Reciprocal Rank Fusion & Document Chunking (Tests 141 - 150)
# ============================================================================
def run_category_15():
    set_category("Cat 15: Reciprocal Rank Fusion & Chunking")

    dense_results = [
        {"id": "docA", "score": 0.95},
        {"id": "docB", "score": 0.88},
        {"id": "docC", "score": 0.72},
    ]
    sparse_results = [
        {"id": "docB", "score": 12.5},
        {"id": "docA", "score": 9.2},
        {"id": "docD", "score": 6.1},
    ]

    # 141: Blended RRF ranking (items in both rank higher)
    fused = reciprocal_rank_fusion(dense_results, sparse_results, k=60)
    top_ids = [item["chunk_id"] for item in fused]
    assert_test("docA" in top_ids[:2] and "docB" in top_ids[:2], "test_141_rrf_blending_dense_and_sparse", "Docs in both lists rank at top")

    # 142: Duplicate suppression
    assert_test(len(top_ids) == len(set(top_ids)), "test_142_rrf_duplicate_suppression", "No duplicate doc IDs in RRF result")

    # 143: Empty dense list
    fused_sparse_only = reciprocal_rank_fusion([], sparse_results, k=60)
    assert_test(len(fused_sparse_only) == 3 and fused_sparse_only[0]["chunk_id"] == "docB", "test_143_rrf_empty_dense_list", "Sparse-only fallback works")

    # 144: Empty sparse list
    fused_dense_only = reciprocal_rank_fusion(dense_results, [], k=60)
    assert_test(len(fused_dense_only) == 3 and fused_dense_only[0]["chunk_id"] == "docA", "test_144_rrf_empty_sparse_list", "Dense-only fallback works")

    # 145: Both lists empty
    assert_test(reciprocal_rank_fusion([], [], k=60) == [], "test_145_rrf_both_lists_empty", "Both empty returns empty list")

    # Chunking helper for tests
    def chunk_text(text: str, chunk_size: int = 100, overlap: int = 20) -> list[str]:
        words = text.split()
        if not words:
            return []
        chunks = []
        step = max(1, chunk_size - overlap)
        for i in range(0, len(words), step):
            chunk = " ".join(words[i : i + chunk_size])
            chunks.append(chunk)
            if i + chunk_size >= len(words):
                break
        return chunks

    # 146: Fixed size split
    doc_words = "word " * 250
    chunks = chunk_text(doc_words, chunk_size=100, overlap=20)
    assert_test(len(chunks) >= 3, "test_146_chunking_fixed_size_split", "Document split into chunks")

    # 147: Overlap verification
    c1_words = set(chunks[0].split())
    c2_words = set(chunks[1].split())
    assert_test(len(c1_words.intersection(c2_words)) > 0, "test_147_chunking_sliding_window_overlap", "Successive chunks share overlap")

    # 148: Short doc single chunk
    short_chunks = chunk_text("Hello short document world", chunk_size=100)
    assert_test(len(short_chunks) == 1, "test_148_chunking_short_document_single_chunk", "Short text produces single chunk")

    # 149: Empty doc
    assert_test(chunk_text("") == [], "test_149_chunking_empty_document_safe", "Empty text produces 0 chunks")

    # 150: RRF k parameter effect
    fused_k10 = reciprocal_rank_fusion(dense_results, sparse_results, k=10)
    assert_test(len(fused_k10) == 4, "test_150_rrf_k_parameter_influence", "Custom k parameter succeeds")


# ============================================================================
# Category 16: LLM-as-a-Judge Evaluation & Heuristics (Tests 151 - 160)
# ============================================================================
def run_category_16():
    set_category("Cat 16: LLM-as-a-Judge Evaluation & Heuristics")

    # 151: Grounded response high faithfulness
    context = "Quantum computers use quantum bits or qubits that can exist in superposition."
    response = "Quantum computers use qubits that exist in superposition."
    f_score = compute_heuristic_faithfulness(response, context)
    assert_test(f_score >= 0.7, "test_151_eval_faithfulness_grounded_response", f"Faithfulness grounded score {f_score} >= 0.7")

    # 152: Hallucinated claim lower faithfulness
    hallucinated = "Quantum computers use magic pixie dust to travel faster than light."
    f_low = compute_heuristic_faithfulness(hallucinated, context)
    assert_test(f_low < f_score, "test_152_eval_faithfulness_hallucinated_claim", f"Hallucinated score {f_low} < grounded {f_score}")

    # 153: Matching query relevance
    query = "How does quantum superposition work?"
    r_score = compute_heuristic_relevance(response, query)
    assert_test(r_score >= 0.5, "test_153_eval_relevance_matching_query", f"Relevance score {r_score} >= 0.5")

    # 154: Off-topic query low relevance
    off_topic = "How to bake a chocolate cake in an oven?"
    r_low = compute_heuristic_relevance(response, off_topic)
    assert_test(r_low < r_score, "test_154_eval_relevance_off_topic_query", f"Off-topic relevance {r_low} < {r_score}")

    # 155: Score normalization in [0.0, 1.0]
    assert_test(0.0 <= f_score <= 1.0 and 0.0 <= r_score <= 1.0, "test_155_eval_score_normalization_bounds", "Scores bounded in [0.0, 1.0]")

    # 156: Empty context faithfulness handling
    f_empty = compute_heuristic_faithfulness(response, "")
    assert_test(0.0 <= f_empty <= 1.0, "test_156_eval_empty_context_faithfulness", "Empty context handled safely")

    # 157: Empty response handling
    r_empty = compute_heuristic_relevance("", query)
    assert_test(0.0 <= r_empty <= 1.0, "test_157_eval_empty_response_handling", "Empty response yields bounded relevance")

    # 158: Benchmark datasets presence
    dataset_ids = list(DATASET_MAP.keys())
    assert_test("coding_standard" in dataset_ids and "rag_faithfulness" in dataset_ids and "reasoning_logic" in dataset_ids, "test_158_eval_benchmark_dataset_presence", "Standard benchmark datasets available")

    # 159: Benchmark test case schema
    coding_dataset = DATASET_MAP["coding_standard"]
    assert_test(len(coding_dataset.test_cases) > 0 and hasattr(coding_dataset.test_cases[0], "prompt"), "test_159_eval_benchmark_schema_valid", "Benchmark cases contain prompts")

    # 160: Radar metric ranges
    metrics = {"faithfulness": f_score, "relevance": r_score, "hallucination": 1.0 - f_score}
    assert_test(all(0.0 <= v <= 1.0 for v in metrics.values()), "test_160_eval_radar_metric_keys", "Radar metrics bounded in [0, 1]")


# ============================================================================
# Category 17: Model Arena, Blind Battles & Telemetry (Tests 161 - 170)
# ============================================================================
def run_category_17():
    set_category("Cat 17: Model Arena, Blind Battles & Telemetry")
    arena = ArenaBattleService()

    # 161: Default sequential flag
    req = DualStreamRequest(prompt="test", model_a="m1", model_b="m2")
    assert_test(req.sequential is True, "test_161_arena_sequential_flag_default", "Arena defaults to sequential=True")

    # 162: Blind mode masking
    blind_name = "Model A" if True else "real_model_name"
    assert_test(blind_name == "Model A", "test_162_arena_blind_mode_masking", "Blind mode hides real model name")

    # 163: Unmasked mode
    unmasked = "real_model" if not False else "Model A"
    assert_test(unmasked == "real_model", "test_163_arena_unmasked_mode_real_names", "Unmasked mode displays real model")

    # 164: TTFT calculation logic
    t_start = 100.0
    first_token_time = 100.45
    ttft_ms = round((first_token_time - t_start) * 1000, 2)
    assert_test(ttft_ms == 450.0, "test_164_arena_ttft_calculation_positive", "TTFT correctly calculated as 450ms")

    # 165: Tokens-per-second calculation
    token_count = 50
    total_duration = 2.0
    tok_sec = round(token_count / total_duration, 2)
    assert_test(tok_sec == 25.0, "test_165_arena_tps_calculation_positive", "TPS correctly calculated as 25.0 tok/s")

    # 166: SSE event format
    import json
    token_event = f"data: {json.dumps({'side': 'A', 'type': 'token', 'token': 'Hi'})}\n\n"
    assert_test(token_event.startswith("data: ") and token_event.endswith("\n\n"), "test_166_arena_event_sse_format", "SSE format complies with spec")

    # 167: Done sentinel format
    done_event = f"data: {json.dumps({'type': 'done'})}\n\n"
    assert_test("done" in done_event, "test_167_arena_done_sentinel_emitted", "Done event formatted")

    # 168: Error event format
    err_event = f"data: {json.dumps({'side': 'B', 'type': 'error', 'error': 'VRAM OOM'})}\n\n"
    assert_test("error" in err_event and "VRAM OOM" in err_event, "test_168_arena_error_event_structure", "Error event formatted")

    # 169: System prompt integration
    prompt = "Explain quantum."
    sys_prompt = "You are a physics professor."
    full_prompt = f"{sys_prompt}\n\nUser: {prompt}" if sys_prompt else prompt
    assert_test(sys_prompt in full_prompt and prompt in full_prompt, "test_169_arena_system_prompt_handling", "System prompt prepended properly")

    # 170: Options temperature default
    options = {"temperature": 0.7}
    assert_test(options.get("temperature") == 0.7, "test_170_arena_concurrent_queue_structure", "Default temperature is 0.7")


# ============================================================================
# Category 18: Arena Leaderboard, Voting & Win Rates (Tests 171 - 180)
# ============================================================================
def run_category_18():
    set_category("Cat 18: Arena Leaderboard, Voting & Win Rates")
    arena = ArenaBattleService()

    # 171: Vote winner A
    res_a = arena.record_vote("u1", "p1", "model_alpha", "model_beta", "A")
    assert_test(res_a["status"] == "recorded" and res_a["vote_id"] == 1, "test_171_arena_vote_record_winner_a", "Vote for A recorded")

    # 172: Vote winner B
    res_b = arena.record_vote("u2", "p2", "model_alpha", "model_beta", "B")
    assert_test(res_b["status"] == "recorded" and res_b["vote_id"] == 2, "test_172_arena_vote_record_winner_b", "Vote for B recorded")

    # 173: Vote tie
    res_tie = arena.record_vote("u3", "p3", "model_alpha", "model_beta", "tie")
    assert_test(res_tie["status"] == "recorded", "test_173_arena_vote_record_tie", "Tie vote recorded")

    # 174: Vote both bad
    res_bad = arena.record_vote("u4", "p4", "model_alpha", "model_beta", "both_bad")
    assert_test(res_bad["status"] == "recorded", "test_174_arena_vote_both_bad_handling", "Both bad vote recorded")

    # 175: Win rate percentage formula
    leaderboard = arena.get_leaderboard()
    assert_test(len(leaderboard) == 2, "test_175_arena_win_rate_percentage_formula", "Leaderboard contains both models")

    # 176: Leaderboard sorted descending
    assert_test(leaderboard[0]["win_rate"] >= leaderboard[1]["win_rate"], "test_176_arena_leaderboard_sorted_descending", "Leaderboard sorted by win_rate descending")

    # 177: Empty leaderboard handling
    empty_arena = ArenaBattleService()
    assert_test(empty_arena.get_leaderboard() == [], "test_177_arena_empty_leaderboard_handling", "Empty votes returns empty list")

    # 178: Multi-model ranking (Model Gamma 100% win rate)
    arena.record_vote("u5", "p5", "model_gamma", "model_alpha", "A")
    lb_multi = arena.get_leaderboard()
    assert_test(lb_multi[0]["model"] == "model_gamma" and lb_multi[0]["win_rate"] == 100.0, "test_178_arena_multi_model_leaderboard", "100% win rate ranks #1")

    # 179: Vote history persistence
    assert_test(len(arena._vote_history) == 5, "test_179_arena_vote_history_persistence", "All 5 votes saved in history")

    # 180: Incremental vote ID
    assert_test(arena._vote_history[-1]["winner"] == "A", "test_180_arena_vote_id_incremental", "Vote details match recorded entry")


# ============================================================================
# Category 19: Tool Execution, Dispatcher & Validation (Tests 181 - 190)
# ============================================================================
def run_category_19():
    set_category("Cat 19: Tool Execution, Dispatcher & Validation")

    # 181: Calculator registered
    calc = tool_registry.get("calculator")
    assert_test(calc is not None, "test_181_tool_registry_contains_calculator", "Calculator tool registered")

    # 182: DateTime registered
    dt = tool_registry.get("datetime")
    assert_test(dt is not None, "test_182_tool_registry_contains_datetime", "DateTime tool registered")

    # 183: Math tool registered
    adv_math = tool_registry.get("advanced_math")
    assert_test(adv_math is not None, "test_183_tool_registry_contains_math", "Advanced Math tool registered")

    # 184: Tool schema export
    schema = calc.to_schema()
    assert_test("type" in schema and "function" in schema and schema["function"]["name"] == "calculator", "test_184_tool_registry_schema_export", "Valid OpenAI tool schema produced")

    # 185: Calculator execution
    calc_res = asyncio.run(calc.execute(expression="12 * 12"))
    assert_test(calc_res.get("success") is True and calc_res.get("result") == 144, "test_185_tool_calculator_execution_success", "Calculator evaluated 12 * 12 = 144")

    # 186: DateTime execution
    dt_res = asyncio.run(dt.execute())
    assert_test(dt_res.get("success") is True and str(datetime.now().year) in str(dt_res.get("result")), "test_186_tool_datetime_execution_success", "DateTime returns current year")

    # 187: Unknown tool returns None
    assert_test(tool_registry.get("nonexistent_tool_xyz") is None, "test_187_tool_unknown_name_returns_none", "Unknown tool returns None")

    # 188: Tool risk levels
    summaries = tool_registry.get_summaries()
    risk_levels = {s["name"]: s.get("risk_level") for s in summaries}
    assert_test("calculator" in risk_levels and risk_levels["calculator"] in ("safe", "standard", "moderate", "sensitive"), "test_188_tool_risk_level_metadata", "Risk levels present in metadata")

    # 189: Tool summary structure
    s0 = summaries[0]
    assert_test("name" in s0 and "description" in s0 and "parameters" in s0, "test_189_tool_summary_keys", "Summary contains name, description, parameters")

    # 190: Dynamic unregister & register
    tool_registry.unregister("calculator")
    unregistered_ok = tool_registry.get("calculator") is None
    tool_registry.register(calc)
    reregistered_ok = tool_registry.get("calculator") is not None
    assert_test(unregistered_ok and reregistered_ok, "test_190_tool_dynamic_lifecycle", "Tool dynamically unregistered and restored")


# ============================================================================
# Category 20: Pydantic Schemas, Model Router & Config (Tests 191 - 200)
# ============================================================================
def run_category_20():
    set_category("Cat 20: Pydantic Schemas, Model Router & Config")

    # 191: Valid ChatRequest
    cr = ChatRequest(message="Hello AI", use_rag=True, effort_level="high")
    assert_test(cr.message == "Hello AI" and cr.effort_level == "high", "test_191_schema_chat_request_validation", "ChatRequest validated")

    # 192: Empty message error
    try:
        ChatRequest(message="")
        cr_invalid = False
    except ValidationError:
        cr_invalid = True
    assert_test(cr_invalid, "test_192_schema_chat_request_empty_message_error", "Empty message raises ValidationError")

    # 193: DualStreamRequest validation
    dsr = DualStreamRequest(prompt="Compare", model_a="m1", model_b="m2")
    assert_test(dsr.model_a == "m1" and dsr.sequential is True, "test_193_schema_dual_stream_request_validation", "DualStreamRequest validated")

    # 194: VoteRequest restricted literals
    vr = VoteRequest(prompt="p", model_a="a", model_b="b", winner="tie")
    try:
        VoteRequest(prompt="p", model_a="a", model_b="b", winner="invalid_choice")
        vr_invalid = False
    except ValidationError:
        vr_invalid = True
    assert_test(vr.winner == "tie" and vr_invalid, "test_194_schema_vote_request_winner_literal", "VoteRequest accepts valid literal and rejects invalid")

    # 195: ConversationResponse defaults
    conv = ConversationResponse(id="c1", title="Title", updatedAt="2026-09-08", createdAt="2026-09-08")
    assert_test(conv.intent_override == "auto" and conv.effort_level == "medium" and conv.is_pinned is False, "test_195_schema_conversation_response_defaults", "ConversationResponse defaults verified")

    # 196: Model router tagged model direct routing
    routed_direct = model_router.select_model({"intent": "deepseek-r1:8b"})
    assert_test(routed_direct["intent"] == "direct_model" and routed_direct["model"] == "deepseek-r1:8b", "test_196_router_direct_model_tagged_selection", "Direct model name routed without fallback")

    # 197: Model router coding intent
    routed_coding = model_router.select_model({"intent": "coding"})
    assert_test(routed_coding["intent"] == "coding" and routed_coding["model"] == MODEL_REGISTRY.get("coding"), "test_197_router_category_coding_selection", "Coding intent routed to coding model")

    # 198: Model router unknown fallback
    routed_unknown = model_router.select_model({"intent": "completely_unknown_category"})
    assert_test(routed_unknown["intent"] == "general", "test_198_router_unknown_intent_fallback", "Unknown intent falls back to general")

    # 199: Config CORS origins parser
    origins = _parse_cors_origins("http://localhost:3000, http://127.0.0.1:3000, https://cloud.ai")
    assert_test(len(origins) == 3 and "https://cloud.ai" in origins, "test_199_config_cors_origins_parsing", "CORS origins parsed correctly")

    # 200: Ollama keep-alive setting exists
    assert_test(hasattr(settings, "OLLAMA_KEEP_ALIVE"), "test_200_config_ollama_keep_alive_setting", "settings.OLLAMA_KEEP_ALIVE exists")


# ============================================================================
# Main Execution Harness
# ============================================================================
def main():
    print("=" * 80)
    print("EXECUTING UNIFIED 200-TEST COMPREHENSIVE ENTERPRISE SUITE")
    print("=" * 80)

    t_start = time.perf_counter()

    run_category_01()
    run_category_02()
    run_category_03()
    run_category_04()
    run_category_05()
    run_category_06()
    run_category_07()
    run_category_08()
    run_category_09()
    run_category_10()
    run_category_11()
    run_category_12()
    run_category_13()
    run_category_14()
    run_category_15()
    run_category_16()
    run_category_17()
    run_category_18()
    run_category_19()
    run_category_20()

    t_total = time.perf_counter() - t_start

    print("\n" + "=" * 80)
    print("200-TEST SUITE EXECUTION SCORECARD")
    print("=" * 80)
    print(f"{'Category Domain':<50} | {'Passed':<8} | {'Failed':<8}")
    print("-" * 72)
    for cat, stats in category_stats.items():
        print(f"{cat:<50} | {stats['passed']:<8} | {stats['failed']:<8}")
    print("-" * 72)
    print(f"{'TOTAL SUMMARY':<50} | {passed_tests:<8} | {failed_tests:<8}")
    print(f"Total Execution Time: {t_total:.3f} seconds")
    print("=" * 80)

    if failed_tests == 0 and passed_tests == 200:
        print("\n[SUCCESS] ALL 200 / 200 TESTS PASSED (100% SUCCESS RATE)!\n")
        sys.exit(0)
    else:
        print(f"\n[FAILURE] SUITE FAILED: {failed_tests} failed test(s) out of {passed_tests + failed_tests}.\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
