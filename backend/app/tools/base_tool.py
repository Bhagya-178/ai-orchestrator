from abc import ABC, abstractmethod
from typing import Any


class BaseTool(ABC):
    """
    Base class for all tools.

    Every tool must implement execute().
    """

    name: str = ""
    description: str = ""

    @abstractmethod
    async def execute(self, **kwargs) -> Any:
        """
        Execute the tool.

        Returns:
            Any: Tool result
        """
