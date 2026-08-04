from app.tools.registry import ToolRegistry


class ToolService:
    """
    Handles tool execution.
    """

    def __init__(self):
        self.registry = ToolRegistry()

    async def execute(self, tool_name: str, **kwargs):
        """
        Execute a tool by name.
        """

        tool = self.registry.get(tool_name)

        if tool is None:
            return {
                "success": False,
                "error": f"Tool '{tool_name}' not found."
            }

        return await tool.execute(**kwargs)