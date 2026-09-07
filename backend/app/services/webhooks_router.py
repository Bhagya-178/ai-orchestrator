"""
Webhook management and event delivery router.

Endpoints:
- GET /webhooks: List user's registered webhook endpoints.
- POST /webhooks: Register a new webhook endpoint.
- DELETE /webhooks/{id}: Delete a webhook endpoint.
- POST /webhooks/{id}/test: Send a test ping event.
- GET /webhooks/{id}/deliveries: View delivery attempt logs.
- GET /webhooks/events: List all valid subscribe-able events.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_optional_user
from app.database.models import User, WebhookDelivery, WebhookEndpoint
from app.database.session import get_db
from app.services.webhooks import (
    SUPPORTED_EVENTS,
    generate_webhook_secret,
    webhook_dispatcher,
)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


class CreateWebhookRequest(BaseModel):
    url: str = Field(..., description="Target HTTP/HTTPS callback URL")
    events: list[str] = Field(default_factory=lambda: ["workflow.completed"], description="Events to subscribe to")
    description: str = Field(default="", max_length=200, description="Optional description")


class WebhookResponse(BaseModel):
    id: str
    url: str
    secret: str
    events: list[str]
    description: str
    is_active: bool
    created_at: str


class WebhookDeliveryResponse(BaseModel):
    id: int
    event_type: str
    response_status: Optional[int]
    response_body: Optional[str]
    duration_ms: float
    success: bool
    error_message: Optional[str]
    created_at: str


@router.get("/events")
async def list_events():
    """List all available event types that webhooks can subscribe to."""
    return {"events": SUPPORTED_EVENTS}


@router.get("", response_model=list[WebhookResponse])
async def list_webhooks(
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """List all registered webhook endpoints for current user."""
    if not current_user:
        return []

    stmt = (
        select(WebhookEndpoint)
        .where(WebhookEndpoint.user_id == current_user.id)
        .order_by(WebhookEndpoint.created_at.desc())
    )
    result = await db.execute(stmt)
    endpoints = result.scalars().all()

    return [
        WebhookResponse(
            id=ep.id,
            url=ep.url,
            secret=ep.secret,
            events=ep.events or [],
            description=ep.description,
            is_active=ep.is_active,
            created_at=ep.created_at.isoformat() if ep.created_at else "",
        )
        for ep in endpoints
    ]


@router.post("", response_model=WebhookResponse, status_code=status.HTTP_201_CREATED)
async def create_webhook(
    req: CreateWebhookRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register a new webhook endpoint and generate an HMAC-SHA256 secret."""
    if not req.url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")

    for ev in req.events:
        if ev not in SUPPORTED_EVENTS and ev != "*":
            raise HTTPException(status_code=400, detail=f"Unsupported event: '{ev}'. Allowed: {SUPPORTED_EVENTS}")

    endpoint = WebhookEndpoint(
        user_id=current_user.id,
        url=req.url.strip(),
        secret=generate_webhook_secret(),
        events=req.events,
        description=req.description.strip(),
        is_active=True,
    )
    db.add(endpoint)
    await db.commit()
    await db.refresh(endpoint)

    return WebhookResponse(
        id=endpoint.id,
        url=endpoint.url,
        secret=endpoint.secret,
        events=endpoint.events or [],
        description=endpoint.description,
        is_active=endpoint.is_active,
        created_at=endpoint.created_at.isoformat() if endpoint.created_at else "",
    )


@router.delete("/{webhook_id}")
async def delete_webhook(
    webhook_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a webhook endpoint."""
    ep = await db.get(WebhookEndpoint, webhook_id)
    if not ep or (ep.user_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(status_code=404, detail="Webhook endpoint not found")

    await db.delete(ep)
    await db.commit()
    return {"message": "Webhook endpoint deleted", "id": webhook_id}


@router.post("/{webhook_id}/test")
async def test_webhook(
    webhook_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dispatch a mock test event to verify connectivity and HMAC signature."""
    ep = await db.get(WebhookEndpoint, webhook_id)
    if not ep or (ep.user_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(status_code=404, detail="Webhook endpoint not found")

    test_payload = {
        "message": "AI Orchestrator Webhook Connectivity Verification",
        "user_email": current_user.email,
        "endpoint_id": ep.id,
    }

    delivery_res = await webhook_dispatcher._send_to_endpoint(
        ep,
        event_type="test.ping",
        payload=test_payload,
        db=db,
    )
    return delivery_res


@router.get("/{webhook_id}/deliveries", response_model=list[WebhookDeliveryResponse])
async def get_webhook_deliveries(
    webhook_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get recent delivery attempts for a given webhook endpoint."""
    ep = await db.get(WebhookEndpoint, webhook_id)
    if not ep or (ep.user_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(status_code=404, detail="Webhook endpoint not found")

    stmt = (
        select(WebhookDelivery)
        .where(WebhookDelivery.webhook_id == webhook_id)
        .order_by(WebhookDelivery.created_at.desc())
        .limit(50)
    )
    res = await db.execute(stmt)
    deliveries = res.scalars().all()

    return [
        WebhookDeliveryResponse(
            id=d.id,
            event_type=d.event_type,
            response_status=d.response_status,
            response_body=d.response_body,
            duration_ms=d.duration_ms,
            success=d.success,
            error_message=d.error_message,
            created_at=d.created_at.isoformat() if d.created_at else "",
        )
        for d in deliveries
    ]
