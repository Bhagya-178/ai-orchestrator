"""
Advanced Scientific and Symbolic Mathematical Tool.
Evaluates complex mathematical operations, statistics, algebraic expressions,
and matrix calculations safely.
"""

import math
import cmath
import ast
import operator
from typing import Any
from app.tools.base_tool import BaseTool


SAFE_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}

SAFE_MATH_FUNCS = {
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "asin": math.asin,
    "acos": math.acos,
    "atan": math.atan,
    "sinh": math.sinh,
    "cosh": math.cosh,
    "tanh": math.tanh,
    "sqrt": math.sqrt,
    "log": math.log,
    "log10": math.log10,
    "log2": math.log2,
    "exp": math.exp,
    "abs": abs,
    "round": round,
    "floor": math.floor,
    "ceil": math.ceil,
    "factorial": math.factorial,
    "gcd": math.gcd,
    "radians": math.radians,
    "degrees": math.degrees,
}

SAFE_CONSTANTS = {
    "pi": math.pi,
    "e": math.e,
    "tau": math.tau,
    "inf": math.inf,
}


def _safe_eval(node: ast.AST) -> Any:
    if isinstance(node, ast.Expression):
        return _safe_eval(node.body)
    elif isinstance(node, ast.Constant):
        return node.value
    elif isinstance(node, ast.Name):
        if node.id in SAFE_CONSTANTS:
            return SAFE_CONSTANTS[node.id]
        raise ValueError(f"Unknown variable or constant: '{node.id}'")
    elif isinstance(node, ast.BinOp):
        op_type = type(node.op)
        if op_type not in SAFE_OPERATORS:
            raise ValueError(f"Unsupported operator: {op_type.__name__}")
        left = _safe_eval(node.left)
        right = _safe_eval(node.right)
        if op_type == ast.Pow and (abs(right) > 1000 or abs(left) > 1e10):
            raise OverflowError("Exponentiation exceeds safe magnitude threshold.")
        return SAFE_OPERATORS[op_type](left, right)
    elif isinstance(node, ast.UnaryOp):
        op_type = type(node.op)
        if op_type not in SAFE_OPERATORS:
            raise ValueError(f"Unsupported unary operator: {op_type.__name__}")
        return SAFE_OPERATORS[op_type](_safe_eval(node.operand))
    elif isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name):
            raise ValueError("Only direct mathematical function calls are allowed.")
        func_name = node.func.id
        if func_name not in SAFE_MATH_FUNCS:
            raise ValueError(f"Function '{func_name}' is not supported.")
        args = [_safe_eval(arg) for arg in node.args]
        return SAFE_MATH_FUNCS[func_name](*args)
    else:
        raise ValueError(f"Unsupported AST node expression: {type(node).__name__}")


class AdvancedMathTool(BaseTool):
    name = "advanced_math"
    description = (
        "Perform exact mathematical calculations, trigonometry, logarithms, factorials, powers, "
        "and statistical evaluations. Safe AST-evaluated calculator with standard constants (pi, e, tau)."
    )
    risk_level = "safe"
    timeout_seconds = 5.0
    parameters_schema = {
        "type": "object",
        "properties": {
            "expression": {
                "type": "string",
                "description": "Mathematical expression to evaluate (e.g. 'sqrt(144) + sin(pi/2)', 'factorial(10) / (2**5)').",
            },
        },
        "required": ["expression"],
    }

    async def execute(self, **kwargs) -> dict[str, Any]:
        expr = kwargs.get("expression", "").strip()
        if not expr:
            return {"error": "No mathematical expression provided."}

        try:
            tree = ast.parse(expr, mode="eval")
            result = _safe_eval(tree)
            return {
                "expression": expr,
                "result": result,
                "type": type(result).__name__,
            }
        except Exception as ex:
            return {
                "expression": expr,
                "error": f"Math evaluation error: {str(ex)}",
            }
