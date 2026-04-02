"""External AI parser – optional paid API backends (OpenAI, Google Gemini).

These backends are used when configured in the admin settings and the user
selects the external AI option during import.  Unlike the local LLM backend,
these require an API key and make network requests to external services.

Supported providers
-------------------
* ``openai``  – OpenAI Chat Completions (gpt-4o, gpt-4o-mini, …)
* ``gemini``  – Google Gemini via the official ``google-generativeai`` SDK
                (gemini-2.0-flash, gemini-1.5-flash, gemini-1.5-pro, …)
"""
from __future__ import annotations

import base64
import io
import json
import logging
from typing import Optional

import httpx

from app.schemas import ImportResult
from app.services.ai_parser import _AI_TEXT_LIMIT, _SYSTEM_PROMPT, _build_import_result

logger = logging.getLogger(__name__)

_OPENAI_BASE_URL = "https://api.openai.com/v1"
_EXTERNAL_AI_TIMEOUT = 120  # seconds


def _safe_json_loads(text: str) -> dict:
    """Parse *text* as JSON, tolerating markdown code-fence wrappers.

    Some models (especially newer Gemini previews) may wrap their JSON output
    in a ``\`\`\`json … \`\`\`` block even when the JSON response MIME type is
    requested.  This helper strips those fences before handing the string to
    :func:`json.loads`.
    """
    stripped = text.strip()
    if stripped.startswith("```"):
        # Remove opening fence (```json or ```)
        first_newline = stripped.find("\n")
        if first_newline != -1:
            stripped = stripped[first_newline + 1:]
        # Remove closing fence
        if stripped.endswith("```"):
            stripped = stripped[: stripped.rfind("```")]
    return json.loads(stripped.strip())


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
        parsed: dict = _safe_json_loads(content)
        return _build_import_result(parsed)
    except httpx.HTTPStatusError as exc:
        logger.warning(
            "OpenAI API call failed: HTTP %s – %s",
            exc.response.status_code,
            exc.response.text[:500],
        )
        return None
    except Exception as exc:
        logger.warning("OpenAI API call failed: %s", exc)
        return None


# ── Google Gemini (official SDK) ──────────────────────────────────────────────


def _call_gemini(
    user_text: str,
    api_key: str,
    model: str,
    image_bytes: Optional[bytes] = None,
) -> Optional[ImportResult]:
    """Call the Google Gemini API via the official ``google-generativeai`` SDK.

    When *image_bytes* are provided the image is opened with ``PIL.Image``
    first, which transparently converts HEIC/HEIF and other exotic formats into
    a representation the SDK can send.  This is more reliable than passing raw
    bytes with an explicit MIME type, and matches the approach recommended in
    Google's own documentation.
    """
    try:
        import google.generativeai as genai
        from PIL import Image

        genai.configure(api_key=api_key)
        gemini_model = genai.GenerativeModel(
            model_name=model,
            system_instruction=_SYSTEM_PROMPT,
        )

        parts: list[str | Image.Image] = []
        if image_bytes:
            img = Image.open(io.BytesIO(image_bytes))
            parts.append(img)
        parts.append(user_text)

        response = gemini_model.generate_content(
            parts,
            generation_config={
                "response_mime_type": "application/json",
                "temperature": 0.1,
                "max_output_tokens": 8192,
            },
        )
        parsed: dict = _safe_json_loads(response.text)
        return _build_import_result(parsed)
    except Exception as exc:
        logger.warning("Gemini API call failed: %s", exc)
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
        )

    logger.warning("Unknown external AI provider: %s", provider)
    return None
