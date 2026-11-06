"""Anthropic Claude backend for recipe extraction (text + image).

Kept in its own module so the Anthropic SDK code stays separate from the
OpenAI / Gemini code in ``external_ai_parser``.  Errors are raised to the
caller, which records a user-facing reason and falls back to the local AI.
"""

from __future__ import annotations

import base64
import io
import json
from typing import Optional

from PIL import Image

# Used when "automatic" model selection cannot list the account's models.
DEFAULT_MODEL = "claude-opus-5-5"

# Models that accept the server-side refusal fallback ("fallbacks": "default").
_FALLBACK_MODELS = {"claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"}
_FALLBACK_BETA = "server-side-fallback-2026-07-01"

# Claude accepts these image types directly; anything else (HEIC, TIFF, …) is
# converted to JPEG first.  Large photos are scaled down to keep requests small.
_SUPPORTED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
_MAX_IMAGE_SIDE = 2000
_MAX_IMAGE_BYTES = 4 * 1024 * 1024

_TIMEOUT_SECONDS = 180


def _strict_schema(schema: dict) -> dict:
    """Return *schema* with ``additionalProperties: false`` on every object."""
    out = dict(schema)
    if out.get("type") == "object" or "properties" in out:
        out["additionalProperties"] = False
        out["properties"] = {k: _strict_schema(v) for k, v in out.get("properties", {}).items()}
    if isinstance(out.get("items"), dict):
        out["items"] = _strict_schema(out["items"])
    return out


def _prepare_image(image_bytes: bytes, mime_type: str) -> tuple[str, str]:
    """Return ``(media_type, base64_data)`` in a form Claude accepts."""
    img = Image.open(io.BytesIO(image_bytes))
    needs_resize = max(img.size) > _MAX_IMAGE_SIDE
    if mime_type in _SUPPORTED_IMAGE_TYPES and not needs_resize and len(image_bytes) <= _MAX_IMAGE_BYTES:
        return mime_type, base64.standard_b64encode(image_bytes).decode("utf-8")

    img = img.convert("RGB")
    img.thumbnail((_MAX_IMAGE_SIDE, _MAX_IMAGE_SIDE))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=88)
    return "image/jpeg", base64.standard_b64encode(buf.getvalue()).decode("utf-8")


def call_claude(
    prompt: str,
    api_key: str,
    model: str,
    system_prompt: str,
    schema: dict,
    image_bytes: Optional[bytes] = None,
    mime_type: str = "image/jpeg",
) -> dict:
    """Send one extraction request to Claude and return the parsed JSON."""
    import anthropic

    content: list[dict] = []
    if image_bytes:
        media_type, data = _prepare_image(image_bytes, mime_type)
        content.append({"type": "image", "source": {"type": "base64", "media_type": media_type, "data": data}})
    content.append({"type": "text", "text": prompt})

    client = anthropic.Anthropic(api_key=api_key, timeout=_TIMEOUT_SECONDS)
    params: dict = {
        "model": model,
        "max_tokens": 16000,
        "system": system_prompt,
        "messages": [{"role": "user", "content": content}],
        "output_config": {"format": {"type": "json_schema", "schema": _strict_schema(schema)}},
    }
    if model in _FALLBACK_MODELS:
        # On a safety refusal the API re-runs the request on a fallback model.
        response = client.beta.messages.create(**params, betas=[_FALLBACK_BETA], fallbacks="default")
    else:
        response = client.messages.create(**params)

    if response.stop_reason == "refusal":
        raise RefusalError("Claude hat die Anfrage abgelehnt")
    if response.stop_reason == "max_tokens":
        raise ValueError("Claude response was cut off (max_tokens)")
    text = next(b.text for b in response.content if b.type == "text")
    return json.loads(text)


def list_models(api_key: str) -> list[dict]:
    """Return the account's Claude models, newest first, with capability flags."""
    import anthropic

    client = anthropic.Anthropic(api_key=api_key, timeout=20)
    models = []
    for m in client.models.list():
        caps = m.capabilities or {}
        models.append(
            {
                "id": m.id,
                "label": m.display_name or m.id,
                "vision": bool(caps.get("image_input", {}).get("supported")),
                "structured": bool(caps.get("structured_outputs", {}).get("supported")),
            }
        )
    return models


def pick_model(models: list[dict]) -> Optional[str]:
    """Pick the recommended model from :func:`list_models` output."""
    ids = {m["id"] for m in models}
    if DEFAULT_MODEL in ids:
        return DEFAULT_MODEL
    suitable = [m for m in models if m["vision"] and m["structured"]]
    for family in ("opus", "sonnet"):
        for m in suitable:  # newest first
            if family in m["id"]:
                return m["id"]
    return suitable[0]["id"] if suitable else None


class RefusalError(Exception):
    """Claude declined the request (``stop_reason == "refusal"``)."""
