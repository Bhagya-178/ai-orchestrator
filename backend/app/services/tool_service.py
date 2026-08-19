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
            # Unknown tool (e.g. the classifier hallucinated a name): not
            # a real execution, so signal "no tool" so the pipeline falls
            # back to the LLM instead of answering with this error.
            return None

        return await tool.execute(**kwargs)