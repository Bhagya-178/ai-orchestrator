"""
Service for executing external tools.
"""
import logging
from typing import Any

from app.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


class ToolService:
    """
    Handles tool execution. Tools are loaded from the registry.
    """

    def __init__(self) -> None:
        self.registry = ToolRegistry()
        # Ensure tools are initialized/registered at init time
        self._available_tools = self.registry._tools
        logger.info("Initialized ToolService with %d tools", len(self._available_tools))

    async def execute(self, tool_name: str, **kwargs: Any) -> Any | None:
        """
        Execute a tool by name, validating it against the registered set.
        """
        if tool_name not in self._available_tools:
            logger.warning("Attempted to execute unknown tool: %s", tool_name)
            # Unknown tool (e.g. the classifier hallucinated a name): not
            # a real execution, so signal "no tool" so the pipeline falls
            # back to the LLM instead of answering with this error.
            return None

        tool = self._available_tools[tool_name]
        logger.info("Executing tool: %s with arguments: %s", tool_name, kwargs)
        
        try:
            result = await tool.execute(**kwargs)
            return result
        except Exception as e:
            logger.exception("Tool execution failed for %s: %s", tool_name, e)
            raise


# Module-level singleton
tool_service = ToolService()