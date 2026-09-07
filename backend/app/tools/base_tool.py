from abc import ABC, abstractmethod
from typing import Any, Literal


RiskLevel = Literal["safe", "moderate", "sensitive"]


class BaseTool(ABC):
    """
    Production-grade base class for all agentic tools.

    Provides parameter validation, schema extraction, execution timeouts,
    and automatic OpenAI/Ollama tool specification formatting.
    """

    name: str = ""
    description: str = ""
    risk_level: RiskLevel = "safe"
    timeout_seconds: float = 30.0
    parameters_schema: dict[str, Any] = {
        "type": "object",
        "properties": {},
        "required": [],
    }

    @abstractmethod
    async def execute(self, **kwargs) -> Any:
        """
        Execute the tool action with validated parameters.

        Returns:
            Any: Serializable tool execution result.
        """
        raise NotImplementedError

    def to_schema(self) -> dict[str, Any]:
        """Convert tool definition to standard OpenAI/Ollama tool format."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters_schema,
            },
        }

    def get_summary(self) -> dict[str, Any]:
        """Return high-level metadata about the tool."""
        return {
            "name": self.name,
            "description": self.description,
            "risk_level": self.risk_level,
            "timeout_seconds": self.timeout_seconds,
            "parameters": self.parameters_schema,
        }
