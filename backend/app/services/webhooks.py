"""
Enterprise Webhook Dispatcher and HMAC Signature Security Engine.

Features:
- Cryptographic HMAC-SHA256 signature generation (X-Orchestrator-Signature)
- Constant-time signature verification for anti-tamper and replay resistance
- Asynchronous non-blocking dispatch with timeout
- Delivery logging and audit tracking in PostgreSQL
"""

import hashlib
import hmac
import json
import logging
import time
from typing import Any, Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.database import get_session_factory
from app.database.models import WebhookDelivery, WebhookEndpoint

logger = logging.getLogger(__name__)

SUPPORTED_EVENTS = [
    "chat.completed",
    "workflow.started",
    "workflow.step",
    "workflow.completed",
    "workflow.failed",
    "document.indexed",
    "document.failed",
    "eval.completed",
    "alert.anomaly",
]


def generate_webhook_secret() -> str:
    """Generate a random 32-byte hexadecimal secret key for HMAC signatures."""
    import secrets
    return f"whsec_{secrets.token_hex(24)}"


def compute_signature(secret: str, payload_bytes: bytes, timestamp: int) -> str:
    """
    Compute HMAC-SHA256 signature for webhook payload:
    Header format: t={timestamp},v1={hex_digest}
    """
    to_sign = f"t={timestamp}.".encode("utf-8") + payload_bytes
    signature = hmac.new(
        secret.encode("utf-8"),
        to_sign,
        hashlib.sha256,
    ).hexdigest()
    return f"t={timestamp},v1={signature}"


def verify_signature(secret: str, payload_bytes: bytes, signature_header: str, max_age_seconds: int = 300) -> bool:
    """
    Verify webhook signature against payload and check for replay tolerance (timestamp check).
    """
    import secrets
    try:
        parts = signature_header.split(",")
        timestamp = None
        v1_sig = None
        for part in parts:
            k, v = part.split("=", 1)
            if k.strip() == "t":
                timestamp = int(v.strip())
            elif k.strip() == "v1":
                v1_sig = v.strip()

        if not timestamp or not v1_sig:
            return False

        # Prevent replay attacks
        now = int(time.time())
        if abs(now - timestamp) > max_age_seconds:
            return False

        to_sign = f"t={timestamp}.".encode("utf-8") + payload_bytes
        expected = hmac.new(
            secret.encode("utf-8"),
            to_sign,
            hashlib.sha256,
        ).hexdigest()

        return secrets.compare_digest(v1_sig, expected)
    except Exception as e:
        logger.warning(f"Webhook signature verification failed: {e}")
        return False


class WebhookDispatcher:
    """Dispatches webhook notifications asynchronously to registered endpoints."""

    def __init__(self, timeout_seconds: float = 8.0):
        self.timeout_seconds = timeout_seconds

    async def dispatch(
        self,
        event_type: str,
        payload: dict[str, Any],
        user_id: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """
        Dispatch an event to all active endpoints subscribed to it.
        Runs delivery and persists logs in webhook_deliveries.
        """
        results = []
        session_factory = get_session_factory()
        async with session_factory() as db:
            query = select(WebhookEndpoint).where(WebhookEndpoint.is_active == True)  # noqa: E712
            if user_id:
                query = query.where(WebhookEndpoint.user_id == user_id)

            res = await db.execute(query)
            endpoints = res.scalars().all()

            for ep in endpoints:
                subscribed = ep.events or []
                if "*" not in subscribed and event_type not in subscribed:
                    continue

                delivery_res = await self._send_to_endpoint(ep, event_type, payload, db)
                results.append(delivery_res)

        return results

    async def _send_to_endpoint(
        self,
        endpoint: WebhookEndpoint,
        event_type: str,
        payload: dict[str, Any],
        db: AsyncSession,
    ) -> dict[str, Any]:
        """Send HTTP POST request to a single endpoint with signature headers."""
        timestamp = int(time.time())
        event_body = {
            "id": f"evt_{timestamp}_{secrets_id()}",
            "event": event_type,
            "timestamp": timestamp,
            "data": payload,
        }
        body_bytes = json.dumps(event_body, separators=(",", ":")).encode("utf-8")
        sig_header = compute_signature(endpoint.secret, body_bytes, timestamp)

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "AI-Orchestrator-Webhooks/1.0",
            "X-Orchestrator-Signature": sig_header,
            "X-Orchestrator-Event": event_type,
        }

        start_time = time.perf_counter()
        status_code = None
        response_body = ""
        success = False
        error_msg = None

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                resp = await client.post(endpoint.url, content=body_bytes, headers=headers)
                status_code = resp.status_code
                response_body = resp.text[:1000]
                success = 200 <= status_code < 300
        except Exception as ex:
            error_msg = str(ex)
            success = False

        duration_ms = (time.perf_counter() - start_time) * 1000.0

        # Persist delivery attempt
        delivery = WebhookDelivery(
            webhook_id=endpoint.id,
            event_type=event_type,
            payload=event_body,
            response_status=status_code,
            response_body=response_body,
            duration_ms=round(duration_ms, 2),
            success=success,
            error_message=error_msg,
        )
        db.add(delivery)
        await db.commit()

        return {
            "webhook_id": endpoint.id,
            "url": endpoint.url,
            "success": success,
            "status_code": status_code,
            "duration_ms": duration_ms,
            "error": error_msg,
        }


def secrets_id() -> str:
    import secrets
    return secrets.token_hex(6)


webhook_dispatcher = WebhookDispatcher()
