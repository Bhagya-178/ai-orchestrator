import ast
import operator

from app.tools.base_tool import BaseTool


class CalculatorTool(BaseTool):
    """
    Tool for evaluating basic mathematical expressions.
    """

    name = "calculator"
    description = "Performs basic mathematical calculations."

    # Supported operators
    OPERATORS = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.Mod: operator.mod,
        ast.Pow: operator.pow,
        ast.USub: operator.neg,
    }

    async def execute(self, **kwargs) -> dict:
        """
        Evaluate a mathematical expression.

        Example:
            await tool.execute(expression="25 * (10 + 5)")
        """

        expression = kwargs.get("expression")

        if not expression:
            return {
                "success": False,
                "tool": self.name,
                "error": "Expression is required."
            }

        try:
            result = self._evaluate(
                ast.parse(expression, mode="eval").body
            )

            return {
                "success": True,
                "tool": self.name,
                "expression": expression,
                "result": result,
            }

        except Exception as e:
            return {
                "success": False,
                "tool": self.name,
                "error": str(e),
            }

    def _evaluate(self, node):
        """
        Recursively evaluate an AST node.
        """

        if isinstance(node, ast.Constant):
            return node.value

        elif isinstance(node, ast.BinOp):
            left = self._evaluate(node.left)
            right = self._evaluate(node.right)

            operator_func = self.OPERATORS.get(type(node.op))

            if operator_func is None:
                raise ValueError("Unsupported operator")

            return operator_func(left, right)

        elif isinstance(node, ast.UnaryOp):
            operand = self._evaluate(node.operand)

            operator_func = self.OPERATORS.get(type(node.op))

            if operator_func is None:
                raise ValueError("Unsupported operator")

            return operator_func(operand)

        raise ValueError("Unsupported expression")