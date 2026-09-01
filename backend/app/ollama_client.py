"""
Async HTTP client for the Ollama API.

Uses a single persistent httpx.AsyncClient with connection pooling.
The client must be started/stopped via startup() and shutdown() which
are called from the FastAPI lifespan handler.
"""

import logging
from collections.abc import AsyncGenerator
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class OllamaClient:
    """Async Ollama API client with connection pooling."""

    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None
        self._timeout = httpx.Timeout(
            connect=10.0,
            read=300.0,
            write=30.0,
            pool=30.0,
        )
        # Generous but finite timeout for streaming responses.
        self._stream_timeout = httpx.Timeout(
            connect=10.0,
            read=600.0,
            write=30.0,
            pool=30.0,
        )

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def startup(self) -> None:
        """Create the persistent HTTP client. Call once at app startup."""
        if self._client is not None:
            return
        self._client = httpx.AsyncClient(
            base_url=settings.OLLAMA_URL,
            timeout=self._timeout,
        )
        logger.info("Ollama HTTP client created (base_url=%s)", settings.OLLAMA_URL)

    async def shutdown(self) -> None:
        """Close the persistent HTTP client. Call once at app shutdown."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None
            logger.info("Ollama HTTP client closed")

    @property
    def client(self) -> httpx.AsyncClient:
        """Return the active client, raising if not started."""
        if self._client is None:
            raise RuntimeError(
                "OllamaClient not started. Call startup() in the app lifespan."
            )
        return self._client

    # ------------------------------------------------------------------
    # API methods
    # ------------------------------------------------------------------

    async def generate(
        self,
        model: str,
        prompt: str,
        options: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Non-streaming text generation."""
        payload: dict[str, Any] = {
            "model": model,
            "prompt": prompt.strip(),
            "stream": False,
            "keep_alive": settings.OLLAMA_KEEP_ALIVE,
        }
        if options:
            payload["options"] = options

        response = await self.client.post("/api/generate", json=payload)
        response.raise_for_status()
        return response.json()

    async def chat(
        self,
        model: str,
        messages: list[dict[str, str]],
        options: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Non-streaming chat completion."""
        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "stream": False,
            "keep_alive": settings.OLLAMA_KEEP_ALIVE,
        }
        if options:
            payload["options"] = options

        response = await self.client.post("/api/chat", json=payload)
        response.raise_for_status()
        return response.json()

    async def stream_chat(
        self,
        model: str,
        messages: list[dict[str, str]],
        options: dict[str, Any] | None = None,
    ) -> AsyncGenerator[str, None]:
        """Streaming chat completion — yields raw JSON lines."""
        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "stream": True,
            "keep_alive": settings.OLLAMA_KEEP_ALIVE,
        }
        if options:
            payload["options"] = options

        # Use a dedicated client for streaming with a longer read timeout,
        # but still finite so we don't hang indefinitely.
        async with httpx.AsyncClient(
            base_url=settings.OLLAMA_URL,
            timeout=self._stream_timeout,
        ) as stream_client, stream_client.stream(
            "POST", "/api/chat", json=payload
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line:
                    yield line

    async def health(self) -> bool:
        """Check if Ollama is reachable."""
        try:
            response = await self.client.get("/api/tags")
            return response.status_code == 200
        except httpx.HTTPError:
            return False

    async def list_models(self) -> list[str]:
        """List available model names."""
        response = await self.client.get("/api/tags")
        response.raise_for_status()
        data = response.json()
        return [model["name"] for model in data.get("models", [])]

    async def unload_model(self, model: str) -> None:
        """Unload a model from memory by sending a zero keep_alive request."""
        payload: dict[str, Any] = {
            "model": model,
            "prompt": "",
            "keep_alive": 0,
        }
        response = await self.client.post("/api/generate", json=payload)
        response.raise_for_status()

    async def embeddings(self, model: str, prompt: str) -> dict[str, Any]:
        """Generate embeddings for a single text."""
        payload: dict[str, str] = {
            "model": model,
            "prompt": prompt,
        }
        response = await self.client.post("/api/embeddings", json=payload)
        response.raise_for_status()
        return response.json()


# Module-level singleton — lifecycle managed by FastAPI lifespan.
ollama = OllamaClient()