"""
API Router for Tool Discovery, Execution, and ReAct Agent Streams.
"""

import json
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.auth.dependencies import get_optional_user
from app.database.models import User
from app.tools.registry import tool_registry
from app.tools.agent_loop import react_agent
from app.config import settings

router = APIRouter(prefix="/tools", tags=["Agentic Tools"])


class ToolExecuteRequest(BaseModel):
    tool_name: str = Field(..., description="Name of registered tool to execute")
    arguments: dict[str, Any] = Field(default_factory=dict, description="Input parameters")


class AgentStreamRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="Agent task or question")
    model: str | None = None
    enabled_tools: list[str] | None = None
    max_iterations: int = Field(default=5, ge=1, le=10)


@router.get("", response_model=list[dict[str, Any]])
async def list_available_tools(
    current_user: User | None = Depends(get_optional_user),
):
    """List all registered tools with their schema, risk level, and metadata."""
    return tool_registry.get_summaries()


@router.post("/execute")
async def execute_tool(
    body: ToolExecuteRequest,
    current_user: User | None = Depends(get_optional_user),
):
    """Directly execute a registered tool (subject to authentication)."""
    tool = tool_registry.get(body.tool_name)
    if not tool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tool '{body.tool_name}' not found. Available: {tool_registry.list_tools()}",
        )

    # Moderate/sensitive tools require active user check
    if tool.risk_level == "sensitive" and (not current_user or current_user.role != "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Tool '{body.tool_name}' has sensitive risk level and requires admin permissions.",
        )

    try:
        result = await tool.execute(**body.arguments)
        return {
            "tool": body.tool_name,
            "status": "success",
            "result": result,
        }
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Tool execution failed: {str(ex)}",
        )


@router.post("/agent/stream")
async def stream_react_agent(
    body: AgentStreamRequest,
    current_user: User | None = Depends(get_optional_user),
):
    """
    Stream a multi-step ReAct agent execution session with real-time thought/tool steps.
    """
    model = body.model or settings.RAG_MODEL

    async def event_generator():
        try:
            async for step in react_agent.run_stream(
                question=body.prompt,
                model=model,
                active_tools=body.enabled_tools,
            ):
                payload = json.dumps(step)
                yield f"data: {payload}\n\n"
        except Exception as ex:
            err_payload = json.dumps({"type": "error", "message": str(ex)})
            yield f"data: {err_payload}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
