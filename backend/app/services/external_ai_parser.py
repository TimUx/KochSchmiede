"""External AI parser – optional paid API backends (OpenAI, Google Gemini, Anthropic Claude).

These backends are used when configured in the admin settings and the upload
complexity warrants them.  Unlike the local LLM backend, these require an API
key and make network requests to external services.

Supported providers
-------------------
* ``openai``  – OpenAI Responses API (gpt-4.1, gpt-4o, gpt-4o-mini, …)
               Uses ``json_schema`` structured output for reliable extraction.
* ``gemini``  – Google Gemini via the official ``google-genai`` SDK
                (gemini-2.5-flash, gemini-2.5-pro, …)
* ``anthropic`` – Anthropic Claude, see :mod:`app.services.anthropic_parser`

The model may be left empty in the settings; it is then chosen automatically
(see :mod:`app.services.ext_ai_models`).
"""
from __future__ import annotations

import base64
import io
import json
import logging
from contextvars import ContextVar
from typing import Optional

from app.schemas import ImportResult
from app.services import anthropic_parser
from app.services.ai_parser import _AI_TEXT_LIMIT, _SYSTEM_PROMPT, _build_import_result

logger = logging.getLogger(__name__)

_EXTERNAL_AI_TIMEOUT = 120  # seconds

# ── Failure reasons ───────────────────────────────────────────────────────────
# The parse functions return None on failure so callers can fall back to the
# local AI.  The reason of the most recent failure in the current request is
# kept here so the import warning can tell the user what actually went wrong.

_last_failure: ContextVar[Optional[str]] = ContextVar("external_ai_last_failure", default=None)


def last_failure_reason() -> Optional[str]:
    """Return a user-facing (German) reason for the last external AI failure."""
    return _last_failure.get()


def describe_failure(exc: BaseException) -> str:
    """Map an OpenAI / Gemini / Anthropic SDK exception to a short German explanation."""
    name = type(exc).__name__
    code = getattr(exc, "status_code", None) or getattr(exc, "code", None)
    if not isinstance(code, int):
        code = None
    # OpenAI puts the error code (e.g. "insufficient_quota") in the body.
    text = f"{exc} {getattr(exc, 'body', '')}".lower()

    if isinstance(exc, anthropic_parser.RefusalError):
        return "die KI hat die Anfrage aus Sicherheitsgründen abgelehnt"
    if isinstance(exc, json.JSONDecodeError):
        return "die Antwort der KI war kein gültiges Rezept-JSON"
    if "timeout" in name.lower() or isinstance(exc, TimeoutError):
        return "Zeitüberschreitung bei der Anfrage an den Anbieter"
    if "connection" in name.lower() or isinstance(exc, ConnectionError):
        return "der Anbieter ist nicht erreichbar (Netzwerkfehler)"
    if (
        code == 402
        or "prepayment credits" in text
        or "insufficient_quota" in text
        or "credit balance is too low" in text
    ):
        return "das Guthaben bzw. Kontingent beim Anbieter ist aufgebraucht – bitte Abrechnung prüfen"
    if code in (401, 403) or "api key not valid" in text or "api_key_invalid" in text or "incorrect api key" in text:
        return "der API-Key ist ungültig oder hat keine Berechtigung"
    if code == 404 or ("not found" in text and "model" in text):
        return "der Modellname ist unbekannt oder für diesen API-Key nicht verfügbar"
    if code == 429:
        return "zu viele Anfragen bzw. Rate-Limit erreicht – bitte später erneut versuchen"
    if code == 529 or "overloaded" in text:
        return "der Anbieter ist gerade überlastet – bitte später erneut versuchen"
    if code is not None and code >= 500:
        return f"der Anbieter hat einen Serverfehler gemeldet (HTTP {code}) – bitte später erneut versuchen"
    if code is not None:
        return f"der Anbieter hat die Anfrage abgelehnt (HTTP {code})"
    return f"unerwarteter Fehler ({name})"


def _record_failure(context: str, exc: BaseException) -> None:
    logger.warning("%s failed: %s", context, exc)
    _last_failure.set(describe_failure(exc))

# ── OpenAI structured-output schema ───────────────────────────────────────────
# Used as the structured-output format (see _OPENAI_TEXT_FORMAT) to enforce the exact
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


# The Responses API takes structured output via ``text.format``.  No
# ``temperature``: newer OpenAI reasoning models reject it.
_OPENAI_TEXT_FORMAT: dict = {
    "format": {
        "type": "json_schema",
        "name": _OPENAI_RECIPE_SCHEMA["name"],
        "schema": _OPENAI_RECIPE_SCHEMA["schema"],
        # The schema has optional fields, which strict mode does not allow.
        "strict": False,
    }
}


# ── OpenAI ────────────────────────────────────────────────────────────────────


def _call_openai_text(
    text: str,
    api_key: str,
    model: str,
    text_limit: int = _AI_TEXT_LIMIT,
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
            input=f"Parse this recipe:\n\n{text[:text_limit]}",
            text=_OPENAI_TEXT_FORMAT,
            max_output_tokens=8192,
        )
        parsed: dict = _safe_json_loads(response.output_text)
        return _build_import_result(parsed)
    except Exception as exc:
        _record_failure("OpenAI API call (text)", exc)
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
            text=_OPENAI_TEXT_FORMAT,
            max_output_tokens=8192,
        )
        parsed: dict = _safe_json_loads(response.output_text)
        return _build_import_result(parsed)
    except Exception as exc:
        _record_failure("OpenAI API call (vision)", exc)
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
        _record_failure("Gemini API call", exc)
        return None


# ── Anthropic Claude ──────────────────────────────────────────────────────────


def _call_anthropic(
    prompt: str,
    api_key: str,
    model: str,
    image_bytes: Optional[bytes] = None,
    mime_type: str = "image/jpeg",
) -> Optional[ImportResult]:
    try:
        parsed = anthropic_parser.call_claude(
            prompt,
            api_key,
            model,
            system_prompt=_SYSTEM_PROMPT,
            schema=_OPENAI_RECIPE_SCHEMA["schema"],
            image_bytes=image_bytes,
            mime_type=mime_type,
        )
        return _build_import_result(parsed)
    except Exception as exc:
        _record_failure("Claude API call", exc)
        return None


# ── Public API ────────────────────────────────────────────────────────────────


def parse_with_external_ai(
    text: str,
    provider: str,
    api_key: str,
    model: str,
    text_limit: int = _AI_TEXT_LIMIT,
) -> Optional[ImportResult]:
    """Parse recipe text using an external AI provider.

    Supports ``openai``, ``gemini`` and ``anthropic``.  Returns ``None`` when the
    provider is unknown, credentials are missing, or the API call fails.

    *text_limit* overrides the default character limit applied to *text*
    before sending it to the model.  Increase this for sources that benefit
    from more context (e.g. full web-page text).
    """
    _last_failure.set(None)
    if not text.strip() or not api_key or not model:
        return None

    if provider == "openai":
        return _call_openai_text(text, api_key, model, text_limit=text_limit)

    if provider == "gemini":
        return _call_gemini(
            f"Parse this recipe:\n\n{text[:text_limit]}",
            api_key,
            model,
        )

    if provider == "anthropic":
        return _call_anthropic(f"Parse this recipe:\n\n{text[:text_limit]}", api_key, model)

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

    Supports vision-capable models from OpenAI, Google Gemini and Anthropic.
    Returns ``None`` when credentials are missing or the API call fails.
    """
    _last_failure.set(None)
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

    if provider == "anthropic":
        return _call_anthropic(
            "Analysiere dieses Rezeptbild und extrahiere alle Rezeptdaten als JSON.",
            api_key,
            model,
            image_bytes=image_bytes,
            mime_type=mime_type,
        )

    logger.warning("Unknown external AI provider: %s", provider)
    return None
