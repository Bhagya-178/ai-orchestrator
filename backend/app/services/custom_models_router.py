"""
Router for managing custom external LLM providers and BYOK models.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.auth.dependencies import get_optional_user
from app.database.models import ExternalProviderModel, User
from app.database.session import get_db
from app.services.llm_provider import llm_provider

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/custom-models", tags=["custom-models"])


def _mask_api_key(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 8:
        return "********"
    return f"{key[:4]}****{key[-4:]}"


class CustomModelCreate(BaseModel):
    name: str = Field(..., min_length=1, description="Dynamic display name (e.g., 'Claude 3.5 Sonnet')")
    provider: str = Field(..., description="Provider: openai, anthropic, gemini, groq, openrouter, deepseek, custom")
    model_id: str = Field(..., min_length=1, description="Upstream model identifier")
    api_key: str = Field(..., min_length=1, description="Provider API Key")
    api_base: str | None = Field(None, description="Optional custom base URL")
    is_active: bool = True


class CustomModelUpdate(BaseModel):
    name: str | None = None
    provider: str | None = None
    model_id: str | None = None
    api_key: str | None = None
    api_base: str | None = None
    is_active: bool | None = None


class TestConnectionRequest(BaseModel):
    provider: str
    model_id: str
    api_key: str | None = None
    api_base: str | None = None
    saved_model_id: str | None = None


@router.get("")
async def list_custom_models(
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """List all configured external BYOK models with masked API keys."""
    stmt = select(ExternalProviderModel).order_by(ExternalProviderModel.created_at.desc())
    if current_user and current_user.id:
        stmt = stmt.where(
            (ExternalProviderModel.user_id == current_user.id)
            | (ExternalProviderModel.user_id.is_(None))
        )

    result = await db.execute(stmt)
    records = result.scalars().all()

    items = []
    for r in records:
        items.append({
            "id": r.id,
            "name": r.name,
            "provider": r.provider,
            "model_id": r.model_id,
            "api_base": r.api_base or "",
            "is_active": r.is_active,
            "masked_key": _mask_api_key(r.api_key),
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return {"models": items}


@router.post("")
async def create_custom_model(
    body: CustomModelCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """Register a new custom provider model."""
    new_model = ExternalProviderModel(
        id=str(uuid.uuid4()),
        user_id=current_user.id if current_user else None,
        name=body.name.strip(),
        provider=body.provider.strip().lower(),
        model_id=body.model_id.strip(),
        api_key=body.api_key.strip(),
        api_base=body.api_base.strip() if body.api_base else None,
        is_active=body.is_active,
    )
    db.add(new_model)
    await db.commit()
    await db.refresh(new_model)

    return {
        "id": new_model.id,
        "name": new_model.name,
        "provider": new_model.provider,
        "model_id": new_model.model_id,
        "api_base": new_model.api_base or "",
        "is_active": new_model.is_active,
        "masked_key": _mask_api_key(new_model.api_key),
        "created_at": new_model.created_at.isoformat() if new_model.created_at else None,
    }


@router.put("/{model_id}")
async def update_custom_model(
    model_id: str,
    body: CustomModelUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """Update custom model details or enable/disable it."""
    stmt = select(ExternalProviderModel).where(ExternalProviderModel.id == model_id)
    result = await db.execute(stmt)
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Custom model not found")

    if body.name is not None:
        model.name = body.name.strip()
    if body.provider is not None:
        model.provider = body.provider.strip().lower()
    if body.model_id is not None:
        model.model_id = body.model_id.strip()
    if body.api_key is not None and body.api_key.strip():
        model.api_key = body.api_key.strip()
    if body.api_base is not None:
        model.api_base = body.api_base.strip() if body.api_base else None
    if body.is_active is not None:
        model.is_active = body.is_active

    await db.commit()
    await db.refresh(model)

    return {
        "id": model.id,
        "name": model.name,
        "provider": model.provider,
        "model_id": model.model_id,
        "api_base": model.api_base or "",
        "is_active": model.is_active,
        "masked_key": _mask_api_key(model.api_key),
    }


@router.delete("/{model_id}")
async def delete_custom_model(
    model_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """Remove a custom model configuration."""
    stmt = select(ExternalProviderModel).where(ExternalProviderModel.id == model_id)
    result = await db.execute(stmt)
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Custom model not found")

    await db.delete(model)
    await db.commit()
    return {"status": "deleted", "id": model_id}


@router.post("/test")
async def test_custom_model(
    body: TestConnectionRequest,
    db: AsyncSession = Depends(get_db),
):
    """Test connectivity and validate the API key against the provider."""
    api_key = body.api_key
    api_base = body.api_base

    # If testing an already saved model and user didn't re-enter the raw key
    if (not api_key or not api_key.strip()) and body.saved_model_id:
        stmt = select(ExternalProviderModel).where(ExternalProviderModel.id == body.saved_model_id)
        result = await db.execute(stmt)
        saved = result.scalar_one_or_none()
        if saved:
            api_key = saved.api_key
            api_base = api_base or saved.api_base

    if not api_key or not api_key.strip():
        raise HTTPException(status_code=400, detail="API key is required to test connection")

    res = await llm_provider.test_connection(
        provider=body.provider,
        model_id=body.model_id,
        api_key=api_key.strip(),
        api_base=api_base.strip() if api_base else None,
    )
    return res
