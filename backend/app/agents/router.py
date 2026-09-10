"""
Multi-Agent Orchestration Router.

Endpoints:
- GET /agents/roles: List specialized agent personas and capabilities.
- GET /agents/templates: List ready-to-run DAG workflow templates.
- POST /agents/workflows/run: Execute a workflow with real-time SSE streaming.
- POST /agents/roles/chat: Direct interaction with a single agent role.
"""

import json
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.engine import WorkflowDefinition, workflow_engine
from app.agents.roles import AGENT_REGISTRY
from app.agents.templates import TEMPLATES, TEMPLATE_MAP
from app.auth.dependencies import get_optional_user
from app.database.models import User, WorkflowRun
from app.database.session import get_db

router = APIRouter(prefix="/agents", tags=["Agents"])



class ExecuteWorkflowRequest(BaseModel):
    template_id: Optional[str] = None
    custom_workflow: Optional[WorkflowDefinition] = None
    input: str = Field(..., min_length=1, description="Initial prompt / requirement for the workflow")
    model_override: Optional[str] = None
    effort_level: Optional[str] = "medium"


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
                effort_level=req.effort_level or "medium",
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


class SaveWorkflowRunRequest(BaseModel):
    id: Optional[str] = None
    template_id: str
    template_name: str
    objective: str
    status: str = "completed"
    node_outputs: dict[str, Any] = Field(default_factory=dict)
    node_timings: dict[str, float] = Field(default_factory=dict)
    final_output: str = ""
    total_duration_ms: float = 0.0


@router.get("/runs")
async def list_workflow_runs(
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """List previous workflow runs for the current user or guest session."""
    query = select(WorkflowRun)
    if current_user:
        query = query.where(WorkflowRun.user_id == current_user.id)
    else:
        query = query.where(WorkflowRun.user_id.is_(None))
    query = query.order_by(desc(WorkflowRun.created_at)).limit(50)
    res = await db.execute(query)
    runs = res.scalars().all()
    return [
        {
            "id": r.id,
            "template_id": r.template_id,
            "template_name": r.template_name,
            "objective": r.objective,
            "status": r.status,
            "node_outputs": r.node_outputs or {},
            "node_timings": r.node_timings or {},
            "final_output": r.final_output,
            "total_duration_ms": r.total_duration_ms,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        }
        for r in runs
    ]


@router.get("/runs/{run_id}")
async def get_workflow_run(
    run_id: str,
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve full details of a specific workflow run."""
    run = await db.get(WorkflowRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Workflow run not found")
    if run.user_id and current_user and run.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    return {
        "id": run.id,
        "template_id": run.template_id,
        "template_name": run.template_name,
        "objective": run.objective,
        "status": run.status,
        "node_outputs": run.node_outputs or {},
        "node_timings": run.node_timings or {},
        "final_output": run.final_output,
        "total_duration_ms": run.total_duration_ms,
        "created_at": run.created_at.isoformat() if run.created_at else "",
    }


@router.post("/runs")
async def save_workflow_run(
    req: SaveWorkflowRunRequest,
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Persist a completed workflow run."""
    run_id = req.id or str(uuid.uuid4())
    existing = await db.get(WorkflowRun, run_id)
    if existing:
        existing.status = req.status
        existing.node_outputs = req.node_outputs
        existing.node_timings = req.node_timings
        existing.final_output = req.final_output
        existing.total_duration_ms = req.total_duration_ms
        await db.commit()
        await db.refresh(existing)
        target = existing
    else:
        target = WorkflowRun(
            id=run_id,
            user_id=current_user.id if current_user else None,
            template_id=req.template_id,
            template_name=req.template_name,
            objective=req.objective,
            status=req.status,
            node_outputs=req.node_outputs,
            node_timings=req.node_timings,
            final_output=req.final_output,
            total_duration_ms=req.total_duration_ms,
        )
        db.add(target)
        await db.commit()
        await db.refresh(target)

    return {
        "id": target.id,
        "status": target.status,
        "message": "Workflow run saved successfully",
    }


@router.delete("/runs/{run_id}")
async def delete_workflow_run(
    run_id: str,
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a saved workflow run."""
    run = await db.get(WorkflowRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Workflow run not found")
    if run.user_id and current_user and run.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    await db.delete(run)
    await db.commit()
    return {"success": True}

