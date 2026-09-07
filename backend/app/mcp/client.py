"""
Model Context Protocol (MCP) Client Implementation.
Supports STDIO (process stdin/stdout) and HTTP/SSE JSON-RPC transports.
"""

import asyncio
import json
import logging
import time
from typing import Any

import httpx

from app.mcp.types import JsonRpcRequest, JsonRpcResponse, McpServerConfig, McpTool

logger = logging.getLogger(__name__)


class McpClient:
    """High-performance client for connecting to an external MCP server."""

    def __init__(self, config: McpServerConfig):
        self.config = config
        self.connected = False
        self.tools: list[McpTool] = []
        self._proc: asyncio.subprocess.Process | None = None
        self._request_counter = 0
        self._pending_requests: dict[int | str, asyncio.Future] = {}
        self._reader_task: asyncio.Task | None = None

    async def connect(self) -> bool:
        """Establish connection with the MCP server and initialize."""
        try:
            if self.config.transport == "stdio":
                return await self._connect_stdio()
            elif self.config.transport == "sse":
                return await self._connect_sse()
            else:
                raise ValueError(f"Unsupported transport: {self.config.transport}")
        except Exception as ex:
            logger.error(f"Failed connecting to MCP server '{self.config.name}': {ex}")
            self.connected = False
            return False

    async def _connect_stdio(self) -> bool:
        if not self.config.command:
            raise ValueError("Command is required for stdio transport.")

        cmd = [self.config.command] + self.config.args
        self._proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=self.config.env or None,
        )

        self.connected = True
        self._reader_task = asyncio.create_task(self._stdio_reader())

        # Perform MCP initialization handshake
        init_res = await self.request(
            "initialize",
            {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "clientInfo": {"name": "AI-Orchestrator", "version": "2.0.0"},
            },
        )

        if not init_res or "error" in init_res:
            logger.warning(f"MCP server {self.config.name} init response: {init_res}")

        # Fetch tools
        await self.refresh_tools()
        return True

    async def _connect_sse(self) -> bool:
        # Validate HTTP URL
        if not self.config.url:
            raise ValueError("URL is required for SSE/HTTP transport.")
        self.connected = True
        await self.refresh_tools()
        return True

    async def _stdio_reader(self) -> None:
        """Continuously read JSON-RPC messages from subprocess stdout."""
        if not self._proc or not self._proc.stdout:
            return

        while self.connected:
            try:
                line = await self._proc.stdout.readline()
                if not line:
                    break
                raw_str = line.decode("utf-8").strip()
                if not raw_str:
                    continue

                data = json.loads(raw_str)
                req_id = data.get("id")
                if req_id is not None and req_id in self._pending_requests:
                    fut = self._pending_requests.pop(req_id)
                    if not fut.done():
                        fut.set_result(data)
            except Exception as ex:
                logger.error(f"Error in stdio reader for {self.config.name}: {ex}")
                break

    async def request(self, method: str, params: dict[str, Any] | None = None, timeout: float = 15.0) -> dict[str, Any]:
        """Send a JSON-RPC 2.0 request and await response."""
        self._request_counter += 1
        req_id = self._request_counter

        req = JsonRpcRequest(id=req_id, method=method, params=params)

        if self.config.transport == "stdio":
            if not self._proc or not self._proc.stdin:
                raise RuntimeError("Process not running")

            fut = asyncio.get_running_loop().create_future()
            self._pending_requests[req_id] = fut

            msg = json.dumps(req.model_dump(exclude_none=True)) + "\n"
            self._proc.stdin.write(msg.encode("utf-8"))
            await self._proc.stdin.drain()

            try:
                res = await asyncio.wait_for(fut, timeout=timeout)
                return res.get("result", {})
            except asyncio.TimeoutError:
                self._pending_requests.pop(req_id, None)
                raise TimeoutError(f"MCP request '{method}' timed out after {timeout}s")

        elif self.config.transport == "sse":
            async with httpx.AsyncClient(timeout=timeout) as client:
                res = await client.post(
                    f"{self.config.url}/rpc",
                    json=req.model_dump(exclude_none=True),
                )
                data = res.json()
                return data.get("result", {})

        return {}

    async def refresh_tools(self) -> list[McpTool]:
        """Fetch list of tools exposed by the MCP server."""
        try:
            res = await self.request("tools/list")
            raw_tools = res.get("tools", [])
            self.tools = [
                McpTool(
                    name=t.get("name"),
                    description=t.get("description", ""),
                    inputSchema=t.get("inputSchema", {}),
                )
                for t in raw_tools
            ]
            return self.tools
        except Exception as ex:
            logger.warning(f"Could not fetch tools for MCP server {self.config.name}: {ex}")
            return []

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> Any:
        """Call an MCP tool on the external server."""
        res = await self.request("tools/call", {"name": name, "arguments": arguments})
        return res

    async def ping(self) -> float:
        """Ping the server and return round-trip latency in milliseconds."""
        t0 = time.perf_counter()
        await self.request("ping", timeout=5.0)
        return round((time.perf_counter() - t0) * 1000, 2)

    async def disconnect(self) -> None:
        """Gracefully terminate connection."""
        self.connected = False
        if self._reader_task:
            self._reader_task.cancel()
        if self._proc:
            try:
                self._proc.terminate()
                await asyncio.wait_for(self._proc.wait(), timeout=3.0)
            except Exception:
                self._proc.kill()
        self.tools = []
