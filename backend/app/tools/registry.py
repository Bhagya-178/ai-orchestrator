from typing import Any
from app.tools.base_tool import BaseTool
from app.tools.calculator import CalculatorTool
from app.tools.datetime_tool import DateTimeTool
from app.tools.web_search import WebSearchTool
from app.tools.code_runner import PythonRunnerTool
from app.tools.file_system import FileSystemTool
from app.tools.sql_tool import SQLQueryTool
from app.tools.math_tool import AdvancedMathTool
from app.tools.chart_tool import ChartGeneratorTool
from app.tools.web_scraper import WebScraperTool


class ToolRegistry:
    """
    Centralized registry for all built-in and dynamically loaded agentic tools.
    """

    def __init__(self):
        self._tools: dict[str, BaseTool] = {}

        # Register standard built-in tools
        self.register(CalculatorTool())
        self.register(DateTimeTool())
        self.register(WebSearchTool())
        self.register(PythonRunnerTool())
        self.register(FileSystemTool())
        self.register(SQLQueryTool())
        self.register(AdvancedMathTool())
        self.register(ChartGeneratorTool())
        self.register(WebScraperTool())

    def register(self, tool: BaseTool) -> None:
        """Register a tool instance."""
        self._tools[tool.name] = tool

    def unregister(self, tool_name: str) -> None:
        """Remove a tool from registry."""
        self._tools.pop(tool_name, None)

    def get(self, tool_name: str) -> BaseTool | None:
        """Get a tool by name."""
        return self._tools.get(tool_name)

    def list_tools(self) -> list[str]:
        """Return all registered tool names."""
        return list(self._tools.keys())

    def get_all_schemas(self) -> list[dict[str, Any]]:
        """Return OpenAI/Ollama compatible tool definitions for all registered tools."""
        return [tool.to_schema() for tool in self._tools.values()]

    def get_summaries(self) -> list[dict[str, Any]]:
        """Return metadata summaries for all tools."""
        return [tool.get_summary() for tool in self._tools.values()]


tool_registry = ToolRegistry()