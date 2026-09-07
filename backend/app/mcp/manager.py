"""
MCP Server Lifecycle and Dynamic Tool Adapter Manager.
Bridges external MCP server tools into the centralized ToolRegistry.
"""

import logging
from typing import Any

from app.mcp.client import McpClient
from app.mcp.types import McpServerConfig, McpServerStatus
from app.tools.base_tool import BaseTool
from app.tools.registry import tool_registry

logger = logging.getLogger(__name__)


class McpToolAdapter(BaseTool):
    """Wraps an external MCP tool to conform to the BaseTool interface."""

    def __init__(self, client: McpClient, tool_name: str, description: str, input_schema: dict[str, Any]):
        self.client = client
        self.original_name = tool_name
        self.name = f"mcp__{client.config.name}__{tool_name}"
        self.description = f"[MCP: {client.config.name}] {description}"
        self.risk_level = "moderate"
        self.parameters_schema = input_schema or {"type": "object", "properties": {}}

    async def execute(self, **kwargs) -> Any:
        return await self.client.call_tool(self.original_name, kwargs)


class McpManager:
    """Manages all registered MCP servers, health pings, and tool exposure."""

    def __init__(self):
        self._clients: dict[str, McpClient] = {}
        self._configs: dict[str, McpServerConfig] = {}

    def add_config(self, config: McpServerConfig) -> None:
        self._configs[config.id] = config

    def remove_config(self, server_id: str) -> None:
        self._configs.pop(server_id, None)

    async def connect_server(self, server_id: str) -> bool:
        config = self._configs.get(server_id)
        if not config:
            raise ValueError(f"Server config '{server_id}' not found.")

        # Disconnect existing if any
        if server_id in self._clients:
            await self.disconnect_server(server_id)

        client = McpClient(config)
        ok = await client.connect()
        if ok:
            self._clients[server_id] = client
            # Register tools into central registry
            for mcp_tool in client.tools:
                adapter = McpToolAdapter(
                    client=client,
                    tool_name=mcp_tool.name,
                    description=mcp_tool.description,
                    input_schema=mcp_tool.inputSchema,
                )
                tool_registry.register(adapter)
                logger.info(f"Registered MCP tool '{adapter.name}' from server '{config.name}'")
        return ok

    async def disconnect_server(self, server_id: str) -> None:
        client = self._clients.pop(server_id, None)
        if client:
            # Unregister its tools from central tool registry
            for mcp_tool in client.tools:
                tool_name = f"mcp__{client.config.name}__{mcp_tool.name}"
                tool_registry.unregister(tool_name)
            await client.disconnect()

    async def get_statuses(self) -> list[McpServerStatus]:
        statuses = []
        for server_id, config in self._configs.items():
            client = self._clients.get(server_id)
            if client and client.connected:
                try:
                    latency = await client.ping()
                except Exception:
                    latency = None

                statuses.append(
                    McpServerStatus(
                        id=config.id,
                        name=config.name,
                        transport=config.transport,
                        connected=True,
                        tools_count=len(client.tools),
                        tools=client.tools,
                        latency_ms=latency,
                    )
                )
            else:
                statuses.append(
                    McpServerStatus(
                        id=config.id,
                        name=config.name,
                        transport=config.transport,
                        connected=False,
                        tools_count=0,
                        tools=[],
                    )
                )
        return statuses

    async def shutdown(self) -> None:
        for sid in list(self._clients.keys()):
            await self.disconnect_server(sid)


mcp_manager = McpManager()
