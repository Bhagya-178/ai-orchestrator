"""
Multi-Agent Orchestration Router.

Endpoints:
- GET /agents/roles: List specialized agent personas and capabilities.
- GET /agents/templates: List ready-to-run DAG workflow templates.
- POST /agents/workflows/run: Execute a workflow with real-time SSE streaming.
- POST /agents/roles/chat: Direct interaction with a single agent role.
"""

import json
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.agents.engine import WorkflowDefinition, workflow_engine
from app.agents.roles import AGENT_REGISTRY
from app.agents.templates import TEMPLATES, TEMPLATE_MAP
from app.auth.dependencies import get_optional_user
from app.database.models import User

router = APIRouter(prefix="/agents", tags=["Agents"])


class ExecuteWorkflowRequest(BaseModel):
    template_id: Optional[str] = None
    custom_workflow: Optional[WorkflowDefinition] = None
    input: str = Field(..., min_length=1, description="Initial prompt / requirement for the workflow")
    model_override: Optional[str] = None


class RoleChatRequest(BaseModel):
    role: str = Field(..., description="Role ID: planner, researcher, coder, reviewer, critic")
    prompt: str = Field(..., min_length=1)
    context: Optional[dict[str, Any]] = None
    model: Optional[str] = None


@router.get("/roles")
async def list_roles():
    """List available autonomous agent roles with descriptions and tool allowances."""
    return [
        {
            "id": r.id,
            "title": r.title,
            "description": r.description,
            "allowed_tools": r.allowed_tools,
            "default_model": r.default_model,
        }
        for r in AGENT_REGISTRY.values()
    ]


@router.get("/templates")
async def list_templates():
    """List built-in multi-agent workflow DAG templates."""
    return [
        {
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "nodes_count": len(t.nodes),
            "nodes": [
                {
                    "id": n.id,
                    "name": n.name,
                    "role": n.role,
                    "depends_on": n.depends_on,
                }
                for n in t.nodes
            ],
        }
        for t in TEMPLATES
    ]


@router.post("/workflows/run")
async def run_workflow_stream(
    req: ExecuteWorkflowRequest,
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Execute a multi-agent DAG workflow, streaming progress events via Server-Sent Events."""
    workflow: Optional[WorkflowDefinition] = None

    if req.template_id:
        workflow = TEMPLATE_MAP.get(req.template_id)
        if not workflow:
            raise HTTPException(status_code=404, detail=f"Workflow template '{req.template_id}' not found")
    elif req.custom_workflow:
        workflow = req.custom_workflow
    else:
        raise HTTPException(status_code=400, detail="Must provide either 'template_id' or 'custom_workflow'")

    async def event_generator():
        try:
            async for event in workflow_engine.execute_workflow(
                workflow=workflow,
                initial_input=req.input,
                model_override=req.model_override,
            ):
                payload = json.dumps(event)
                yield f"data: {payload}\n\n"
        except Exception as ex:
            err = json.dumps({"type": "workflow_error", "error": str(ex)})
            yield f"data: {err}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/roles/chat")
async def chat_with_role(
    req: RoleChatRequest,
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Single-turn interaction with an individual agent role."""
    role = AGENT_REGISTRY.get(req.role)
    if not role:
        raise HTTPException(status_code=404, detail=f"Role '{req.role}' not found. Available: {list(AGENT_REGISTRY.keys())}")

    output = await role.execute(
        task=req.prompt,
        context=req.context,
        model_override=req.model,
    )

    return {
        "role": role.id,
        "title": role.title,
        "response": output,
    }
