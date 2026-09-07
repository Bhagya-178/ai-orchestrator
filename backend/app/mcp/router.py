"""
API Router for Model Context Protocol (MCP) server hubs and tools.
"""

from typing import Any
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth.dependencies import get_optional_user
from app.database.models import User
from app.mcp.manager import mcp_manager
from app.mcp.types import McpServerConfig, McpServerStatus

router = APIRouter(prefix="/mcp", tags=["Model Context Protocol (MCP)"])


class AddServerRequest(BaseModel):
    name: str = Field(..., min_length=1)
    transport: str = Field(default="stdio")
    command: str | None = None
    args: list[str] = Field(default_factory=list)
    env: dict[str, str] = Field(default_factory=dict)
    url: str | None = None


class CallMcpToolRequest(BaseModel):
    server_id: str
    tool_name: str
    arguments: dict[str, Any] = Field(default_factory=dict)


@router.get("/servers", response_model=list[McpServerStatus])
async def list_mcp_servers(
    current_user: User | None = Depends(get_optional_user),
):
    """List all configured MCP servers with real-time connectivity status."""
    return await mcp_manager.get_statuses()


@router.post("/servers", response_model=McpServerStatus)
async def add_mcp_server(
    body: AddServerRequest,
    current_user: User | None = Depends(get_optional_user),
):
    """Add and connect a new MCP server (STDIO or SSE)."""
    server_id = str(uuid.uuid4())
    config = McpServerConfig(
        id=server_id,
        name=body.name,
        transport=body.transport,  # type: ignore
        command=body.command,
        args=body.args,
        env=body.env,
        url=body.url,
        enabled=True,
    )

    mcp_manager.add_config(config)
    connected = await mcp_manager.connect_server(server_id)

    statuses = await mcp_manager.get_statuses()
    for s in statuses:
        if s.id == server_id:
            return s

    raise HTTPException(status_code=500, detail="Failed to retrieve server status after addition.")


@router.delete("/servers/{server_id}")
async def remove_mcp_server(
    server_id: str,
    current_user: User | None = Depends(get_optional_user),
):
    """Disconnect and remove an MCP server."""
    await mcp_manager.disconnect_server(server_id)
    mcp_manager.remove_config(server_id)
    return {"status": "removed", "server_id": server_id}


@router.post("/servers/{server_id}/reconnect")
async def reconnect_mcp_server(
    server_id: str,
    current_user: User | None = Depends(get_optional_user),
):
    """Attempt reconnecting an existing MCP server."""
    connected = await mcp_manager.connect_server(server_id)
    return {"server_id": server_id, "connected": connected}


@router.post("/tools/call")
async def call_mcp_tool(
    body: CallMcpToolRequest,
    current_user: User | None = Depends(get_optional_user),
):
    """Invoke an external tool provided by a connected MCP server."""
    client = mcp_manager._clients.get(body.server_id)
    if not client or not client.connected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"MCP server '{body.server_id}' is not connected.",
        )

    try:
        result = await client.call_tool(body.tool_name, body.arguments)
        return {"status": "success", "result": result}
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"MCP tool call failed: {str(ex)}",
        )
