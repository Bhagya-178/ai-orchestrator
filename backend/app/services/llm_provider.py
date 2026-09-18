"""
Universal Async LLM Provider Dispatcher.

Connects to external AI model providers (OpenAI, Anthropic, Gemini, Groq,
OpenRouter, DeepSeek, Together AI, or any custom OpenAI-compatible endpoint)
via raw HTTP/SSE streaming using httpx, eliminating heavy vendor SDKs.
"""

from __future__ import annotations

import json
import logging
import re
import time
from collections.abc import AsyncGenerator
from typing import Any

import httpx

logger = logging.getLogger(__name__)


def _scrub_secrets(text: str, api_key: str | None = None) -> str:
    """Scrub sensitive API keys, tokens, and credentials from error messages and logs."""
    if not text:
        return ""
    if api_key and len(api_key) > 6 and api_key in text:
        text = text.replace(api_key, "[REDACTED_API_KEY]")
    # Redact standard key formats: sk-..., gsk_..., AIzaSy..., Bearer tokens
    text = re.sub(r"sk-[a-zA-Z0-9_\-]{8,}", "[REDACTED_KEY]", text)
    text = re.sub(r"gsk_[a-zA-Z0-9_\-]{8,}", "[REDACTED_KEY]", text)
    text = re.sub(r"AIzaSy[a-zA-Z0-9_\-]{8,}", "[REDACTED_KEY]", text)
    text = re.sub(r"Bearer\s+[a-zA-Z0-9_\.\-]{10,}", "Bearer [REDACTED_TOKEN]", text)
    return text


DEFAULT_BASE_URLS: dict[str, str] = {
    "openai": "https://api.openai.com/v1",
    "anthropic": "https://api.anthropic.com",
    "gemini": "https://generativelanguage.googleapis.com",
    "groq": "https://api.groq.com/openai/v1",
    "openrouter": "https://openrouter.ai/api/v1",
    "deepseek": "https://api.deepseek.com",
    "together": "https://api.together.xyz/v1",
    "custom": "",
}


class LLMProviderDispatcher:
    """Unified dispatcher for streaming external LLM providers."""

    def __init__(self, timeout: float = 60.0):
        self.timeout = timeout

    def _resolve_base_url(self, provider: str, api_base: str | None) -> str:
        if api_base and api_base.strip():
            return api_base.strip().rstrip("/")
        return DEFAULT_BASE_URLS.get(provider.lower(), "").rstrip("/")

    async def stream_chat(
        self,
        provider: str,
        model_id: str,
        api_key: str,
        messages: list[dict[str, Any]],
        api_base: str | None = None,
        temperature: float = 0.2,
        max_tokens: int = 4096,
    ) -> AsyncGenerator[str, None]:
        """Stream token chunks from the target external provider via SSE."""
        prov = provider.lower().strip()
        base_url = self._resolve_base_url(prov, api_base)

        if prov == "anthropic":
            async for token in self._stream_anthropic(base_url, model_id, api_key, messages, temperature, max_tokens):
                yield token
        elif prov == "gemini":
            async for token in self._stream_gemini(base_url, model_id, api_key, messages, temperature, max_tokens):
                yield token
        else:
            # OpenAI-compatible protocol (OpenAI, Groq, OpenRouter, DeepSeek, Together, Custom)
            async for token in self._stream_openai_compatible(prov, base_url, model_id, api_key, messages, temperature, max_tokens):
                yield token

    async def _stream_openai_compatible(
        self,
        provider: str,
        base_url: str,
        model_id: str,
        api_key: str,
        messages: list[dict[str, Any]],
        temperature: float,
        max_tokens: int,
    ) -> AsyncGenerator[str, None]:
        url = f"{base_url}/chat/completions" if base_url else "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        if provider == "openrouter":
            headers["HTTP-Referer"] = "https://ai-orchestrator.local"
            headers["X-Title"] = "AI Orchestrator"

        payload = {
            "model": model_id,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as response:
                if response.status_code != 200:
                    error_bytes = await response.aread()
                    error_text = error_bytes.decode("utf-8", errors="replace")
                    scrubbed = _scrub_secrets(error_text, api_key)
                    logger.error(f"External provider ({provider}) returned HTTP {response.status_code}: {scrubbed}")
                    yield f"\n[Provider Error {response.status_code}: {scrubbed[:200]}]"
                    return

                buffer = ""
                async for chunk in response.aiter_text():
                    buffer += chunk
                    while "\n" in buffer:
                        line, buffer = buffer.split("\n", 1)
                        line = line.strip()
                        if not line or line.startswith(":"):
                            continue
                        if line == "data: [DONE]":
                            return
                        if line.startswith("data: "):
                            data_str = line[6:].strip()
                            try:
                                data = json.loads(data_str)
                                choices = data.get("choices", [])
                                if choices:
                                    delta = choices[0].get("delta", {})
                                    content = delta.get("content")
                                    if content:
                                        yield content
                            except json.JSONDecodeError:
                                continue

    async def _stream_anthropic(
        self,
        base_url: str,
        model_id: str,
        api_key: str,
        messages: list[dict[str, Any]],
        temperature: float,
        max_tokens: int,
    ) -> AsyncGenerator[str, None]:
        url = f"{base_url or 'https://api.anthropic.com'}/v1/messages"
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

        system_parts = []
        user_messages = []
        for m in messages:
            role = m.get("role", "user")
            content = m.get("content", "")
            if role == "system":
                system_parts.append(content)
            else:
                user_messages.append({
                    "role": "user" if role == "user" else "assistant",
                    "content": content
                })

        if not user_messages:
            user_messages = [{"role": "user", "content": "Hello"}]

        payload: dict[str, Any] = {
            "model": model_id,
            "messages": user_messages,
            "max_tokens": max_tokens or 4096,
            "temperature": min(max(temperature, 0.0), 1.0),
            "stream": True,
        }
        if system_parts:
            payload["system"] = "\n\n".join(system_parts)

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as response:
                if response.status_code != 200:
                    error_bytes = await response.aread()
                    error_text = error_bytes.decode("utf-8", errors="replace")
                    scrubbed = _scrub_secrets(error_text, api_key)
                    logger.error(f"Anthropic returned HTTP {response.status_code}: {scrubbed}")
                    yield f"\n[Anthropic Error {response.status_code}: {scrubbed[:200]}]"
                    return

                buffer = ""
                async for chunk in response.aiter_text():
                    buffer += chunk
                    while "\n" in buffer:
                        line, buffer = buffer.split("\n", 1)
                        line = line.strip()
                        if not line or line.startswith(":"):
                            continue
                        if line.startswith("data: "):
                            data_str = line[6:].strip()
                            try:
                                data = json.loads(data_str)
                                etype = data.get("type")
                                if etype == "content_block_delta":
                                    delta = data.get("delta", {})
                                    if delta.get("type") == "text_delta":
                                        yield delta.get("text", "")
                            except json.JSONDecodeError:
                                continue

    async def _stream_gemini(
        self,
        base_url: str,
        model_id: str,
        api_key: str,
        messages: list[dict[str, Any]],
        temperature: float,
        max_tokens: int,
    ) -> AsyncGenerator[str, None]:
        clean_model = model_id.removeprefix("models/")
        url = f"{base_url or 'https://generativelanguage.googleapis.com'}/v1beta/models/{clean_model}:streamGenerateContent?alt=sse&key={api_key}"
        headers = {
            "Content-Type": "application/json",
        }

        contents = []
        system_instruction = None
        for m in messages:
            role = m.get("role", "user")
            content = m.get("content", "")
            if role == "system":
                system_instruction = {"parts": [{"text": content}]}
            else:
                gemini_role = "user" if role == "user" else "model"
                contents.append({
                    "role": gemini_role,
                    "parts": [{"text": content}]
                })

        if not contents:
            contents = [{"role": "user", "parts": [{"text": "Hello"}]}]

        payload: dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens or 4096,
            }
        }
        if system_instruction:
            payload["systemInstruction"] = system_instruction

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as response:
                if response.status_code != 200:
                    error_bytes = await response.aread()
                    error_text = error_bytes.decode("utf-8", errors="replace")
                    scrubbed = _scrub_secrets(error_text, api_key)
                    logger.error(f"Gemini returned HTTP {response.status_code}: {scrubbed}")
                    yield f"\n[Gemini Error {response.status_code}: {scrubbed[:200]}]"
                    return

                buffer = ""
                async for chunk in response.aiter_text():
                    buffer += chunk
                    while "\n" in buffer:
                        line, buffer = buffer.split("\n", 1)
                        line = line.strip()
                        if not line or line.startswith(":"):
                            continue
                        if line.startswith("data: "):
                            data_str = line[6:].strip()
                            try:
                                data = json.loads(data_str)
                                candidates = data.get("candidates", [])
                                if candidates:
                                    content_obj = candidates[0].get("content", {})
                                    parts = content_obj.get("parts", [])
                                    for part in parts:
                                        if "text" in part:
                                            yield part["text"]
                            except json.JSONDecodeError:
                                continue

    async def test_connection(
        self,
        provider: str,
        model_id: str,
        api_key: str,
        api_base: str | None = None,
    ) -> dict[str, Any]:
        """Send a test probe to check API key and model connectivity."""
        t0 = time.perf_counter()
        try:
            test_messages = [{"role": "user", "content": "Ping"}]
            first_token = ""
            async for token in self.stream_chat(
                provider=provider,
                model_id=model_id,
                api_key=api_key,
                messages=test_messages,
                api_base=api_base,
                temperature=0.1,
                max_tokens=4,
            ):
                first_token += token
                if len(first_token.strip()) > 0:
                    break

            latency_ms = round((time.perf_counter() - t0) * 1000, 1)
            if (
                first_token.startswith("\n[Provider Error")
                or first_token.startswith("\n[Anthropic Error")
                or first_token.startswith("\n[Gemini Error")
            ):
                return {
                    "success": False,
                    "latency_ms": latency_ms,
                    "error": _scrub_secrets(first_token.strip("[]\n "), api_key),
                }

            return {
                "success": True,
                "latency_ms": latency_ms,
                "message": f"Successfully connected to {provider} ({model_id}) in {latency_ms}ms.",
            }
        except Exception as e:
            latency_ms = round((time.perf_counter() - t0) * 1000, 1)
            err_msg = _scrub_secrets(str(e), api_key)
            logger.exception(f"Connection test failed for {provider}/{model_id}: {err_msg}")
            return {
                "success": False,
                "latency_ms": latency_ms,
                "error": err_msg,
            }


llm_provider = LLMProviderDispatcher()
