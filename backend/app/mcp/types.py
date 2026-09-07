"""
Model Context Protocol (MCP) Data Models and Protocol Types.
Based on the official MCP specification (JSON-RPC 2.0).
"""

from typing import Any, Literal
from pydantic import BaseModel, Field


class JsonRpcRequest(BaseModel):
    jsonrpc: Literal["2.0"] = "2.0"
    id: int | str
    method: str
    params: dict[str, Any] | None = None


class JsonRpcResponse(BaseModel):
    jsonrpc: Literal["2.0"] = "2.0"
    id: int | str
    result: Any | None = None
    error: dict[str, Any] | None = None


class McpToolParameter(BaseModel):
    type: str = "object"
    properties: dict[str, Any] = Field(default_factory=dict)
    required: list[str] = Field(default_factory=list)


class McpTool(BaseModel):
    name: str
    description: str = ""
    inputSchema: dict[str, Any] = Field(default_factory=dict)


class McpResource(BaseModel):
    uri: str
    name: str
    description: str | None = None
    mimeType: str | None = None


class McpServerConfig(BaseModel):
    id: str
    name: str
    transport: Literal["stdio", "sse"] = "stdio"
    command: str | None = None
    args: list[str] = Field(default_factory=list)
    env: dict[str, str] = Field(default_factory=dict)
    url: str | None = None
    enabled: bool = True
    created_at: str | None = None


class McpServerStatus(BaseModel):
    id: str
    name: str
    transport: str
    connected: bool
    tools_count: int
    tools: list[McpTool] = Field(default_factory=list)
    latency_ms: float | None = None
    error: str | None = None
