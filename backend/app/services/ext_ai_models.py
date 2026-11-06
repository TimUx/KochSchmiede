"""Model discovery and automatic model selection for the external AI providers.

When no model is configured ("automatic"), the provider's model list is
fetched with the stored API key and the recommended model is picked: a
current, general-purpose model that handles both text and images.  The
result is cached so imports don't list models on every request.  If listing
fails, a fixed default per provider is used.
"""

from __future__ import annotations

import logging
import re
import threading
import time
from typing import Optional

from app.services import anthropic_parser

logger = logging.getLogger(__name__)

PROVIDERS = ("openai", "gemini", "anthropic")

DEFAULT_MODELS = {
    "openai": "gpt-4o",
    "gemini": "gemini-2.5-flash",
    "anthropic": anthropic_parser.DEFAULT_MODEL,
}

_CACHE_TTL = 12 * 3600  # seconds; a failed lookup is retried after 10 minutes
_FAILED_TTL = 600
_cache: dict[tuple[str, str], tuple[str, float]] = {}
_lock = threading.Lock()


# ── Listing ───────────────────────────────────────────────────────────────────

_OPENAI_EXCLUDE = re.compile(
    r"audio|realtime|search|transcribe|tts|image|codex|instruct|embedding|moderation|"
    r"preview|latest|nano|-pro|\d{4}-\d{2}-\d{2}"
)
_GEMINI_EXCLUDE = re.compile(r"preview|exp|lite|tts|image|live|embedding|aqa|thinking|latest|-\d{3}$")


def _version_key(model_id: str) -> tuple:
    """Sort key from the first version number in an id (e.g. "gpt-4.1" → (4, 1))."""
    m = re.search(r"(\d+)(?:[.-](\d+))?", model_id)
    if not m:
        return (0, 0)
    return (int(m.group(1)), int(m.group(2) or 0))


def _list_openai(api_key: str) -> list[dict]:
    from openai import OpenAI

    client = OpenAI(api_key=api_key, timeout=20)
    ids = [m.id for m in client.models.list()]
    chat = [i for i in ids if re.match(r"^(gpt-\d|o\d)", i) and not _OPENAI_EXCLUDE.search(i)]
    chat.sort(key=_version_key, reverse=True)
    return [{"id": i, "label": i} for i in chat]


def _pick_openai(models: list[dict]) -> Optional[str]:
    # Newest full-size GPT model ("gpt-5", "gpt-4.1", "gpt-4o"); skip "-mini"
    # variants and the o-series reasoning models.
    for m in models:
        if m["id"].startswith("gpt-") and "mini" not in m["id"]:
            return m["id"]
    return models[0]["id"] if models else None


def _list_gemini(api_key: str) -> list[dict]:
    from google import genai

    client = genai.Client(api_key=api_key)
    out = []
    for m in client.models.list():
        mid = (m.name or "").removeprefix("models/")
        actions = getattr(m, "supported_actions", None) or []
        if mid.startswith("gemini-") and "generateContent" in actions and not _GEMINI_EXCLUDE.search(mid):
            out.append({"id": mid, "label": getattr(m, "display_name", None) or mid})
    out.sort(key=lambda m: _version_key(m["id"]), reverse=True)
    return out


def _pick_gemini(models: list[dict]) -> Optional[str]:
    # Newest stable "Flash" model: fast, cheap and multimodal.
    for m in models:
        if re.fullmatch(r"gemini-[\d.]+-flash", m["id"]):
            return m["id"]
    return models[0]["id"] if models else None


def list_models(provider: str, api_key: str) -> list[dict]:
    """Return suitable models for *provider* (``id`` + ``label``), best first.

    Raises the provider SDK's exception when the key is invalid or the API
    cannot be reached.
    """
    if provider == "openai":
        return _list_openai(api_key)
    if provider == "gemini":
        return _list_gemini(api_key)
    if provider == "anthropic":
        models = anthropic_parser.list_models(api_key)
        return [m for m in models if m["vision"] and m["structured"]]
    raise ValueError(f"Unknown provider: {provider}")


def pick_model(provider: str, models: list[dict]) -> Optional[str]:
    if provider == "openai":
        return _pick_openai(models)
    if provider == "gemini":
        return _pick_gemini(models)
    if provider == "anthropic":
        return anthropic_parser.pick_model(models)
    return None


# ── Resolution ────────────────────────────────────────────────────────────────


def _cache_key(provider: str, api_key: str) -> tuple[str, str]:
    # In-memory only; the key is already held in memory with the settings.
    return provider, api_key


def resolve_model(provider: str, api_key: str, configured: Optional[str]) -> str:
    """Return the configured model, or the automatically selected one."""
    if configured:
        return configured

    key = _cache_key(provider, api_key)
    now = time.monotonic()
    with _lock:
        hit = _cache.get(key)
        if hit and hit[1] > now:
            return hit[0]

    model: Optional[str] = None
    try:
        model = pick_model(provider, list_models(provider, api_key))
        ttl = _CACHE_TTL
    except Exception as exc:  # invalid key, network error, …
        logger.warning("Could not list %s models, using default: %s", provider, exc)
        ttl = _FAILED_TTL
    if not model:
        model = DEFAULT_MODELS.get(provider, "")
        ttl = _FAILED_TTL
    else:
        logger.info("External AI: automatically selected %s model %s", provider, model)

    with _lock:
        _cache[key] = (model, now + ttl)
    return model


def clear_cache() -> None:
    with _lock:
        _cache.clear()
