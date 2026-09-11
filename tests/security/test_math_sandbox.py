"""Security tests for Mathematical AST evaluation and preventing remote code execution (Tests 061 - 070)."""
import ast
from typing import Any
from app.tools.math_tool import _safe_eval

def eval_math(expr: str) -> Any:
    try:
        node = ast.parse(expr, mode="eval").body
        return _safe_eval(node)
    except Exception as ex:
        return f"error: {ex}"

def test_061_math_ast_simple_addition():
    assert eval_math("2 + 2") == 4, "2 + 2 = 4"

def test_062_math_ast_operator_precedence():
    assert eval_math("3 + 4 * 2") == 11, "3 + 4 * 2 = 11"

def test_063_math_ast_builtins_import_blocked():
    res = eval_math("__import__('os').system('echo pwned')")
    assert "error" in str(res).lower(), "__import__ blocked"

def test_064_math_ast_eval_call_blocked():
    res = eval_math("eval('1 + 1')")
    assert "error" in str(res).lower(), "eval blocked"

def test_065_math_ast_dunder_globals_blocked():
    res = eval_math("().__class__.__base__.__subclasses__()")
    assert "error" in str(res).lower(), "Dunder attribute traversal blocked"

def test_066_math_ast_division_by_zero_safe():
    res = eval_math("10 / 0")
    assert "division by zero" in str(res).lower() or "error" in str(res).lower(), "Division by zero handled cleanly"

def test_067_math_ast_scientific_functions():
    assert eval_math("sqrt(16)") == 4.0, "sqrt(16) = 4.0"

def test_068_math_ast_negative_exponentiation():
    assert eval_math("2 ** 10") == 1024, "2 ** 10 = 1024"

def test_069_math_ast_unsupported_statement_blocked():
    res = eval_math("for i in range(10): print(i)")
    assert "error" in str(res).lower(), "Loop statements blocked"

def test_070_math_ast_constants_support():
    res = eval_math("pi")
    assert isinstance(res, float) and res > 3.14, "pi constant evaluated"
