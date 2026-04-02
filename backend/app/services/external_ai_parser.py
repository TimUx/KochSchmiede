"""External AI parser – optional paid API backends (OpenAI, Google Gemini).

These backends are used when configured in the admin settings and the user
selects the external AI option during import.  Unlike the local LLM backend,
these require an API key and make network requests to external services.

Supported providers
-------------------
* ``openai``  – OpenAI Chat Completions (gpt-4o, gpt-4o-mini, …)
* ``gemini``  – Google Gemini (gemini-1.5-flash, gemini-1.5-pro, …)
"""
from __future__ import annotations

import base64
import json
import logging
from typing import Optional

import httpx

from app.schemas import ImportResult
from app.services.ai_parser import _AI_TEXT_LIMIT, _SYSTEM_PROMPT, _build_import_result

logger = logging.getLogger(__name__)

_OPENAI_BASE_URL = "https://api.openai.com/v1"
_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
_EXTERNAL_AI_TIMEOUT = 120  # seconds


# ── OpenAI ────────────────────────────────────────────────────────────────────


def _call_openai(
    messages: list[dict],
    api_key: str,
    model: str,
) -> Optional[ImportResult]:
    """POST to the OpenAI Chat Completions endpoint."""
    try:
        resp = httpx.post(
            f"{_OPENAI_BASE_URL}/chat/completions",
            json={
                "model": model,
                "messages": messages,
                "response_format": {"type": "json_object"},
                "temperature": 0.1,
                "max_tokens": 2048,
            },
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            timeout=_EXTERNAL_AI_TIMEOUT,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        parsed: dict = json.loads(content)
        return _build_import_result(parsed)
    except Exception as exc:
        logger.debug("OpenAI API call failed: %s", exc)
        return None


# ── Google Gemini ─────────────────────────────────────────────────────────────


def _call_gemini(
    user_text: str,
    api_key: str,
    model: str,
    image_bytes: Optional[bytes] = None,
    mime_type: str = "image/jpeg",
) -> Optional[ImportResult]:
    """POST to the Google Gemini generateContent endpoint."""
    try:
        parts: list[dict] = []
        if image_bytes:
            b64 = base64.b64encode(image_bytes).decode()
            parts.append(
                {
                    "inline_data": {
                        "mime_type": mime_type,
                        "data": b64,
                    }
                }
            )
        parts.append({"text": user_text})

        resp = httpx.post(
            f"{_GEMINI_BASE_URL}/models/{model}:generateContent",
            params={"key": api_key},
            json={
                "system_instruction": {
                    "parts": [{"text": _SYSTEM_PROMPT}]
                },
                "contents": [{"parts": parts}],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0.1,
                    "maxOutputTokens": 2048,
                },
            },
            headers={"Content-Type": "application/json"},
            timeout=_EXTERNAL_AI_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        content = data["candidates"][0]["content"]["parts"][0]["text"]
        parsed: dict = json.loads(content)
        return _build_import_result(parsed)
    except Exception as exc:
        logger.debug("Gemini API call failed: %s", exc)
        return None


# ── Public API ────────────────────────────────────────────────────────────────


def parse_with_external_ai(
    text: str,
    provider: str,
    api_key: str,
    model: str,
) -> Optional[ImportResult]:
    """Parse recipe text using an external AI provider.

    Supports ``openai`` and ``gemini`` providers.  Returns ``None`` when the
    provider is unknown, credentials are missing, or the API call fails.
    """
    if not text.strip() or not api_key or not model:
        return None

    if provider == "openai":
        messages = [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Parse this recipe:\n\n{text[:_AI_TEXT_LIMIT]}",
            },
        ]
        return _call_openai(messages, api_key, model)

    if provider == "gemini":
        return _call_gemini(
            f"Parse this recipe:\n\n{text[:_AI_TEXT_LIMIT]}",
            api_key,
            model,
        )

    logger.warning("Unknown external AI provider: %s", provider)
    return None


def parse_image_with_external_ai(
    image_bytes: bytes,
    mime_type: str,
    provider: str,
    api_key: str,
    model: str,
) -> Optional[ImportResult]:
    """Parse a recipe image using an external AI provider.

    Supports vision-capable models from OpenAI and Google Gemini.
    Returns ``None`` when credentials are missing or the API call fails.
    """
    if not image_bytes or not api_key or not model:
        return None

    if provider == "openai":
        b64 = base64.b64encode(image_bytes).decode()
        messages = [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Analysiere dieses Rezeptbild und extrahiere alle "
                            "Rezeptdaten als JSON."
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime_type};base64,{b64}"},
                    },
                ],
            },
        ]
        return _call_openai(messages, api_key, model)

    if provider == "gemini":
        return _call_gemini(
            "Analysiere dieses Rezeptbild und extrahiere alle Rezeptdaten als JSON.",
            api_key,
            model,
            image_bytes=image_bytes,
            mime_type=mime_type,
        )

    logger.warning("Unknown external AI provider: %s", provider)
    return None
