"""
API Router for Collaborative Multi-Tenant Workspaces, Members, and Audit Logs.
"""

import re
import uuid
from typing import Any, Literal
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import select, delete, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_optional_user
from app.database.session import get_db
from app.database.models import User, Workspace, WorkspaceMember, AuditLog

router = APIRouter(prefix="/workspaces", tags=["Multi-Tenant Workspaces"])


class CreateWorkspaceRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: str = ""
    settings: dict[str, Any] = Field(default_factory=dict)


class AddMemberRequest(BaseModel):
    email: str
    role: Literal["admin", "member", "viewer"] = "member"


class AuditLogEntryRequest(BaseModel):
    action: str
    resource_type: str | None = None
    resource_id: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)


def _slugify(text: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9\s-]", "", text).strip().lower()
    return re.sub(r"[\s-]+", "-", cleaned)


@router.get("")
async def list_workspaces(
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """List all workspaces the authenticated user belongs to."""
    if not current_user:
        return []

    query = (
        select(Workspace)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == current_user.id)
        .order_by(desc(Workspace.created_at))
    )
    result = await db.execute(query)
    workspaces = result.scalars().all()

    return [
        {
            "id": w.id,
            "name": w.name,
            "slug": w.slug,
            "description": w.description,
            "owner_id": w.owner_id,
            "created_at": w.created_at.isoformat() if w.created_at else None,
        }
        for w in workspaces
    ]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_workspace(
    body: CreateWorkspaceRequest,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new workspace and assign current user as owner."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required to create a workspace.")
    ws_id = str(uuid.uuid4())
    slug_base = _slugify(body.name)
    slug = f"{slug_base}-{uuid.uuid4().hex[:6]}"

    ws = Workspace(
        id=ws_id,
        name=body.name,
        slug=slug,
        description=body.description,
        owner_id=current_user.id,
        settings=body.settings,
    )
    db.add(ws)

    # Add owner as workspace member
    owner_member = WorkspaceMember(
        workspace_id=ws_id,
        user_id=current_user.id,
        role="owner",
    )
    db.add(owner_member)

    # Log action
    audit = AuditLog(
        workspace_id=ws_id,
        user_id=current_user.id,
        action="workspace.create",
        resource_type="workspace",
        resource_id=ws_id,
        details={"name": body.name, "slug": slug},
    )
    db.add(audit)

    await db.commit()
    await db.refresh(ws)

    return {
        "id": ws.id,
        "name": ws.name,
        "slug": ws.slug,
        "description": ws.description,
        "owner_id": ws.owner_id,
        "created_at": ws.created_at.isoformat() if ws.created_at else None,
    }


@router.get("/{workspace_id}")
async def get_workspace(
    workspace_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve workspace details and members."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required to view workspace.")

    # Check membership
    mem_res = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == current_user.id,
        )
    )
    if not mem_res.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this workspace")

    ws_res = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    ws = ws_res.scalar_one_or_none()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    members_res = await db.execute(
        select(WorkspaceMember, User)
        .join(User, User.id == WorkspaceMember.user_id)
        .where(WorkspaceMember.workspace_id == workspace_id)
    )
    members_data = []
    for mem, usr in members_res.all():
        members_data.append({
            "user_id": usr.id,
            "email": usr.email,
            "full_name": usr.full_name,
            "role": mem.role,
            "joined_at": mem.joined_at.isoformat() if mem.joined_at else None,
        })

    return {
        "id": ws.id,
        "name": ws.name,
        "slug": ws.slug,
        "description": ws.description,
        "owner_id": ws.owner_id,
        "settings": ws.settings,
        "members": members_data,
        "created_at": ws.created_at.isoformat() if ws.created_at else None,
    }


@router.post("/{workspace_id}/members")
async def add_workspace_member(
    workspace_id: str,
    body: AddMemberRequest,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Add or invite a member to the workspace."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required.")
    # Verify current user is owner or admin
    curr_mem = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == current_user.id,
            WorkspaceMember.role.in_(["owner", "admin"]),
        )
    )
    if not curr_mem.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Only workspace owners or admins can invite members")

    # Find target user by email
    target_user_res = await db.execute(select(User).where(User.email == body.email.strip().lower()))
    target_user = target_user_res.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail=f"No user found with email '{body.email}'")

    # Check if already member
    exist_res = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == target_user.id,
        )
    )
    if exist_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User is already a member of this workspace")

    new_member = WorkspaceMember(
        workspace_id=workspace_id,
        user_id=target_user.id,
        role=body.role,
    )
    db.add(new_member)

    # Log audit event
    audit = AuditLog(
        workspace_id=workspace_id,
        user_id=current_user.id,
        action="member.add",
        resource_type="user",
        resource_id=target_user.id,
        details={"email": target_user.email, "role": body.role},
    )
    db.add(audit)

    await db.commit()
    return {"status": "added", "user_id": target_user.id, "role": body.role}


@router.get("/{workspace_id}/audit-logs")
async def get_audit_logs(
    workspace_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve audit trail logs for the workspace."""
    if not current_user:
        return []

    logs_res = await db.execute(
        select(AuditLog)
        .where(AuditLog.workspace_id == workspace_id)
        .order_by(desc(AuditLog.created_at))
        .limit(limit)
    )
    logs = logs_res.scalars().all()

    return [
        {
            "id": l.id,
            "action": l.action,
            "user_id": l.user_id,
            "resource_type": l.resource_type,
            "resource_id": l.resource_id,
            "details": l.details,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]
