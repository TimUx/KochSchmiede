"""External AI parser – optional paid API backends (OpenAI, Google Gemini).

These backends are used when configured in the admin settings and the upload
complexity warrants them.  Unlike the local LLM backend, these require an API
key and make network requests to external services.

Supported providers
-------------------
* ``openai``  – OpenAI Responses API (gpt-4.1, gpt-4o, gpt-4o-mini, …)
               Uses ``json_schema`` structured output for reliable extraction.
* ``gemini``  – Google Gemini via the official ``google-genai`` SDK
                (gemini-2.0-flash, gemini-1.5-flash, gemini-1.5-pro, …)
"""
from __future__ import annotations

import base64
import io
import json
import logging
from typing import Optional

from app.schemas import ImportResult
from app.services.ai_parser import _AI_TEXT_LIMIT, _SYSTEM_PROMPT, _build_import_result

logger = logging.getLogger(__name__)

_EXTERNAL_AI_TIMEOUT = 120  # seconds

# ── OpenAI structured-output schema ───────────────────────────────────────────
# Used with response_format={"type": "json_schema", ...} to enforce the exact
# fields expected by _build_import_result.  Matches the schema described in
# _SYSTEM_PROMPT (English field names).

_OPENAI_RECIPE_SCHEMA: dict = {
    "name": "recipe",
    "schema": {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "description": {"type": ["string", "null"]},
            "ingredients": {
                "type": "array",
                "items": {"type": "string"},
            },
            "ingredient_groups": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "ingredients": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                    },
                    "required": ["name", "ingredients"],
                },
            },
            "steps": {
                "type": "array",
                "items": {"type": "string"},
            },
            "tags": {
                "type": "array",
                "items": {"type": "string"},
            },
            "prep_time": {"type": ["integer", "null"]},
            "cook_time": {"type": ["integer", "null"]},
            "servings": {"type": ["integer", "null"]},
        },
        "required": ["title", "ingredients", "ingredient_groups", "steps"],
    },
}


def _safe_json_loads(text: str) -> dict:
    """Parse *text* as JSON, tolerating markdown code-fence wrappers.

    Some models (especially newer Gemini previews) may wrap their JSON output
    in a triple-backtick code fence even when the JSON response MIME type is
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


def _call_openai_text(
    text: str,
    api_key: str,
    model: str,
) -> Optional[ImportResult]:
    """Call the OpenAI Responses API for text-based recipe extraction.

    Uses ``json_schema`` structured output to enforce the exact recipe fields
    and ``instructions`` to supply the system prompt.
    """
    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key, timeout=_EXTERNAL_AI_TIMEOUT)
        response = client.responses.create(
            model=model,
            instructions=_SYSTEM_PROMPT,
            input=f"Parse this recipe:\n\n{text[:_AI_TEXT_LIMIT]}",
            response_format={
                "type": "json_schema",
                "json_schema": _OPENAI_RECIPE_SCHEMA,
            },
            temperature=0.1,
            max_output_tokens=2048,
        )
        parsed: dict = _safe_json_loads(response.output_text)
        return _build_import_result(parsed)
    except Exception as exc:
        logger.warning("OpenAI API call (text) failed: %s", exc)
        return None


def _call_openai_image(
    image_bytes: bytes,
    mime_type: str,
    api_key: str,
    model: str,
) -> Optional[ImportResult]:
    """Call the OpenAI Responses API for vision-based recipe extraction.

    Sends the image as a base64-encoded ``input_image`` block alongside the
    extraction prompt.  Uses ``json_schema`` structured output to guarantee a
    well-formed recipe JSON response.
    """
    try:
        from openai import OpenAI

        b64 = base64.b64encode(image_bytes).decode()
        client = OpenAI(api_key=api_key, timeout=_EXTERNAL_AI_TIMEOUT)
        response = client.responses.create(
            model=model,
            instructions=_SYSTEM_PROMPT,
            input=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": (
                                "Analysiere dieses Rezeptbild und extrahiere "
                                "alle Rezeptdaten als JSON."
                            ),
                        },
                        {
                            "type": "input_image",
                            "image_url": f"data:{mime_type};base64,{b64}",
                        },
                    ],
                }
            ],
            response_format={
                "type": "json_schema",
                "json_schema": _OPENAI_RECIPE_SCHEMA,
            },
            temperature=0.1,
            max_output_tokens=2048,
        )
        parsed: dict = _safe_json_loads(response.output_text)
        return _build_import_result(parsed)
    except Exception as exc:
        logger.warning("OpenAI API call (vision) failed: %s", exc)
        return None


# ── Google Gemini (official SDK) ──────────────────────────────────────────────


def _call_gemini(
    user_text: str,
    api_key: str,
    model: str,
    image_bytes: Optional[bytes] = None,
) -> Optional[ImportResult]:
    """Call the Google Gemini API via the official ``google-genai`` SDK.

    When *image_bytes* are provided the image is opened with ``PIL.Image``
    first, which transparently converts HEIC/HEIF and other exotic formats into
    a representation the SDK can send.  This is more reliable than passing raw
    bytes with an explicit MIME type, and matches the approach recommended in
    Google's own documentation.
    """
    try:
        from google import genai
        from google.genai import types
        from PIL import Image

        client = genai.Client(api_key=api_key)

        parts: list = []
        if image_bytes:
            img = Image.open(io.BytesIO(image_bytes))
            parts.append(img)
        parts.append(user_text)

        response = client.models.generate_content(
            model=model,
            contents=parts,
            config=types.GenerateContentConfig(
                system_instruction=_SYSTEM_PROMPT,
                response_mime_type="application/json",
                temperature=0.1,
                max_output_tokens=8192,
            ),
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
        return _call_openai_text(text, api_key, model)

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
        return _call_openai_image(image_bytes, mime_type, api_key, model)

    if provider == "gemini":
        return _call_gemini(
            "Analysiere dieses Rezeptbild und extrahiere alle Rezeptdaten als JSON.",
            api_key,
            model,
            image_bytes=image_bytes,
        )

    logger.warning("Unknown external AI provider: %s", provider)
    return None
