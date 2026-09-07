"""
API Router for Prompt Engineering Studio and Templates.
"""

from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field

from app.auth.dependencies import get_optional_user
from app.database.models import User
from app.prompts.library import prompt_library
from app.prompts.parser import render_template

router = APIRouter(prefix="/prompts", tags=["Prompt Engineering Studio"])


class CreateTemplateRequest(BaseModel):
    title: str = Field(..., min_length=1)
    category: str = Field(default="General")
    description: str = ""
    system_prompt: str = ""
    user_template: str = Field(..., min_length=1)
    tags: list[str] = Field(default_factory=list)
    is_public: bool = False


class RenderTemplateRequest(BaseModel):
    variables: dict[str, Any] = Field(default_factory=dict)


@router.get("")
async def list_prompt_templates(
    category: str | None = Query(default=None),
    search: str | None = Query(default=None),
    current_user: User | None = Depends(get_optional_user),
):
    """Browse categorized prompt templates with keyword search."""
    return prompt_library.list_templates(category=category, search=search)


@router.get("/{template_id}")
async def get_prompt_template(
    template_id: str,
    current_user: User | None = Depends(get_optional_user),
):
    """Retrieve template details, system prompt, and variable declarations."""
    tpl = prompt_library.get_template(template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Prompt template not found")
    return tpl


@router.post("")
async def create_prompt_template(
    body: CreateTemplateRequest,
    current_user: User | None = Depends(get_optional_user),
):
    """Create a new custom prompt template."""
    author_id = current_user.id if current_user else "anonymous"
    return prompt_library.create_template(body.model_dump(), author_id=author_id)


@router.post("/{template_id}/render")
async def render_prompt_template(
    template_id: str,
    body: RenderTemplateRequest,
    current_user: User | None = Depends(get_optional_user),
):
    """
    Substitute parameters into the template and return the fully resolved prompt.
    """
    tpl = prompt_library.get_template(template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Prompt template not found")

    try:
        rendered_user = render_template(tpl["user_template"], body.variables)
        return {
            "template_id": template_id,
            "system_prompt": tpl.get("system_prompt", ""),
            "rendered_prompt": rendered_user,
        }
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))


@router.delete("/{template_id}")
async def delete_prompt_template(
    template_id: str,
    current_user: User | None = Depends(get_optional_user),
):
    """Delete a custom prompt template owned by the current user."""
    author_id = current_user.id if current_user else "anonymous"
    ok = prompt_library.delete_template(template_id, author_id=author_id)
    if not ok:
        raise HTTPException(status_code=403, detail="Cannot delete built-in or unowned template")
    return {"status": "deleted", "template_id": template_id}
