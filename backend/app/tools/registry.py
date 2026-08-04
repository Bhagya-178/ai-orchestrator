from app.tools.base_tool import BaseTool
from app.tools.calculator import CalculatorTool
from app.tools.datetime_tool import DateTimeTool


class ToolRegistry:
    """
    Registry for all available tools.
    """

    def __init__(self):
        self._tools: dict[str, BaseTool] = {}

        # Register built-in tools
        self.register(CalculatorTool())
        self.register(DateTimeTool())

    def register(self, tool: BaseTool) -> None:
        """
        Register a tool.
        """
        self._tools[tool.name] = tool

    def get(self, tool_name: str) -> BaseTool | None:
        """
        Get a tool by name.
        """
        return self._tools.get(tool_name)

    def list_tools(self) -> list[str]:
        """
        Return all registered tool names.
        """
        return list(self._tools.keys())