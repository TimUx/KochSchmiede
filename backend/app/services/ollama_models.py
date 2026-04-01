"""Ollama model discovery, preference ranking, and auto-pull helpers.

At runtime this module queries the Ollama ``/api/tags`` endpoint to discover
which models are currently loaded.  It then selects the best available text
and vision model from curated, priority-ordered preference lists (smallest /
fastest models first) and optionally auto-pulls a recommended pair when the
Ollama service is reachable but no suitable models are present yet.

The results are cached for ``_CACHE_TTL_SECONDS`` seconds so that every import
request does not incur an extra HTTP round-trip.

Usage (from ai_parser.py / imports.py)::

    from app.services.ollama_models import get_best_text_model, get_best_vision_model

    text_model  = get_best_text_model()   # e.g. "llama3.2:3b" or None
    vision_model = get_best_vision_model() # e.g. "llava:7b" or None
"""
from __future__ import annotations

import logging
import re
import threading
import time
from typing import Optional

logger = logging.getLogger(__name__)

# ── Cache ─────────────────────────────────────────────────────────────────────

_CACHE_TTL_SECONDS = 300  # refresh model list at most every 5 minutes
_cache_lock = threading.Lock()
_cached_models: Optional[list[dict]] = None
_cache_timestamp: float = 0.0
_pull_attempted = False  # ensure auto-pull runs at most once per process lifetime


# ── Preference lists ──────────────────────────────────────────────────────────
# Text-only models, ordered from fastest/smallest to largest.
# All of these are suitable for structured recipe text (good JSON output).
_PREFERRED_TEXT_MODELS: list[str] = [
    "llama3.2:1b",
    "llama3.2:3b",
    "llama3.2",
    "qwen2.5:1.5b",
    "qwen2.5:3b",
    "qwen2:1.5b",
    "qwen2:7b",
    "phi3:mini",
    "phi3:3.8b",
    "phi3",
    "gemma3:1b",
    "gemma3:4b",
    "gemma2:2b",
    "mistral:7b",
    "mistral",
    "llama3:8b",
    "llama3",
    "llama2",
    "deepseek-r1:1.5b",
    "deepseek-r1:7b",
]

# Vision-capable models, ordered by quality/speed balance.
_PREFERRED_VISION_MODELS: list[str] = [
    "llama3.2-vision:11b",
    "llama3.2-vision",
    "llava:7b",
    "llava",
    "llava:13b",
    "minicpm-v",
    "moondream",
    "bakllava",
]

# Model names / family strings that indicate vision capability even when the
# model name is a custom alias (e.g. "my-llava-model").
_VISION_NAME_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"vision",
        r"\bllava\b",
        r"minicpm.?v",
        r"moondream",
        r"bakllava",
        r"phi.*vision",
        r"qwen.*vl",
        r"internvl",
    ]
]

# Ollama model family strings that indicate a multimodal / vision model.
_VISION_FAMILIES: frozenset[str] = frozenset(
    ["mllama", "clip", "llava", "blip", "blip2", "internvl", "minicpmv"]
)

# Models to automatically pull when Ollama is reachable but empty.
# These are kept small so a fresh install does not download gigabytes
# without user awareness.  Both are pulled concurrently.
_AUTO_PULL_TEXT_MODEL = "llama3.2"     # ~2 GB — fast, great JSON output
_AUTO_PULL_VISION_MODEL = "llava:7b"   # ~4.7 GB — good vision quality


# ── Internal helpers ──────────────────────────────────────────────────────────


def _get_ollama_base_url() -> Optional[str]:
    """Derive the Ollama REST base URL from the configured LLM endpoint.

    Supports both the OpenAI-compatible path (``LLM_BASE_URL`` ending in
    ``/v1``) and the legacy Ollama native path (``AI_ENDPOINT``).
    Returns ``None`` when neither is configured.
    """
    from app.config import settings  # local import to avoid circular deps

    base = settings.LLM_BASE_URL.rstrip("/")
    if base:
        # Strip the "/v1" suffix that the OpenAI-compatible path uses so we
        # reach the raw Ollama API (e.g. http://ollama:11434).
        return re.sub(r"/v1$", "", base)

    if settings.AI_ENDPOINT:
        return settings.AI_ENDPOINT.rstrip("/")

    return None


def _fetch_models_from_ollama(base_url: str) -> list[dict]:
    """Call ``GET /api/tags`` and return the model list, or ``[]`` on error."""
    try:
        import httpx

        resp = httpx.get(f"{base_url}/api/tags", timeout=5)
        resp.raise_for_status()
        return resp.json().get("models", [])
    except Exception as exc:
        logger.debug("Could not fetch Ollama model list: %s", exc)
        return []


def _is_vision_capable(model: dict) -> bool:
    """Return True when the model entry indicates vision / multimodal capability."""
    name: str = model.get("name", "") or model.get("model", "")
    # Check name patterns first (most reliable for standard Ollama models).
    if any(p.search(name) for p in _VISION_NAME_PATTERNS):
        return True
    # Check the families array returned by newer Ollama versions.
    details = model.get("details") or {}
    families = [f.lower() for f in (details.get("families") or [])]
    family = (details.get("family") or "").lower()
    all_families = set(families) | {family}
    return bool(all_families & _VISION_FAMILIES)


def _refresh_cache_if_needed(base_url: str) -> list[dict]:
    """Return the cached model list, refreshing it when the TTL has expired."""
    global _cached_models, _cache_timestamp

    now = time.monotonic()
    with _cache_lock:
        if _cached_models is not None and (now - _cache_timestamp) < _CACHE_TTL_SECONDS:
            return _cached_models
        models = _fetch_models_from_ollama(base_url)
        _cached_models = models
        _cache_timestamp = now
        return models


def _normalise_name(name: str) -> str:
    """Normalise a model name for comparison (lower-case, strip whitespace)."""
    return name.strip().lower()


def _names_match(available: str, preferred: str) -> bool:
    """True when *available* matches *preferred* in a case-insensitive way.

    Also handles the common Ollama suffix pattern where ``llama3.2`` may be
    listed as ``llama3.2:latest`` (and vice-versa).
    """
    a = _normalise_name(available)
    p = _normalise_name(preferred)
    if a == p:
        return True
    # Strip ":latest" tag from either side for a more lenient comparison.
    a_base = a.split(":")[0] if ":" in a else a
    p_base = p.split(":")[0] if ":" in p else p
    a_tag = a.split(":", 1)[1] if ":" in a else "latest"
    p_tag = p.split(":", 1)[1] if ":" in p else "latest"
    return (a_base == p_base) and (a_tag == p_tag or p_tag == "latest")


# ── Public API ────────────────────────────────────────────────────────────────


def get_available_models() -> list[dict]:
    """Return the list of models currently loaded in Ollama.

    Returns an empty list when Ollama is not configured or not reachable.
    """
    base_url = _get_ollama_base_url()
    if not base_url:
        return []
    return _refresh_cache_if_needed(base_url)


def get_best_text_model() -> Optional[str]:
    """Return the name of the best available text-only (or general) model.

    Iterates through ``_PREFERRED_TEXT_MODELS`` in priority order and returns
    the first one that is present in the Ollama model list.  Returns ``None``
    when Ollama is unreachable or no matching model is found.

    Vision-capable models are intentionally **included** as fallback text
    models here: they also work for text parsing (just use more VRAM).
    """
    from app.config import settings  # local import

    # Explicit override wins.
    if settings.LLM_MODEL:
        return settings.LLM_MODEL

    available = get_available_models()
    if not available:
        return None

    available_names = [m.get("name", "") for m in available]

    # First pass: prefer pure text models from the priority list.
    for preferred in _PREFERRED_TEXT_MODELS:
        if any(_names_match(a, preferred) for a in available_names):
            return preferred

    # Second pass: accept any available model (vision models work for text too).
    if available_names:
        return available_names[0]

    return None


def get_best_vision_model() -> Optional[str]:
    """Return the name of the best available vision-capable model.

    Iterates through ``_PREFERRED_VISION_MODELS`` in priority order.  Also
    scans all loaded models for vision capability markers.  Returns ``None``
    when no vision model is available.
    """
    available = get_available_models()
    if not available:
        return None

    available_names = [m.get("name", "") for m in available]

    # First pass: check priority list.
    for preferred in _PREFERRED_VISION_MODELS:
        if any(_names_match(a, preferred) for a in available_names):
            return preferred

    # Second pass: scan all available models for vision capability markers.
    for model in available:
        if _is_vision_capable(model):
            return model.get("name", "")

    return None


def invalidate_cache() -> None:
    """Force a fresh model list on the next call (e.g. after a pull)."""
    global _cached_models, _cache_timestamp
    with _cache_lock:
        _cached_models = None
        _cache_timestamp = 0.0


def ensure_models_available() -> None:
    """Pull recommended models into Ollama when none are present yet.

    This function is intended to be called once in a background thread at
    startup.  It is a no-op when:
    - Ollama is not configured (``LLM_BASE_URL`` / ``AI_ENDPOINT`` empty).
    - ``OLLAMA_AUTO_PULL=false`` is set in the environment.
    - At least one text model and one vision model are already available.
    - A pull has already been attempted in this process lifetime.

    Pulls run sequentially to avoid hammering the Ollama daemon.
    """
    global _pull_attempted

    with _cache_lock:
        if _pull_attempted:
            return
        _pull_attempted = True

    from app.config import settings  # local import

    if not settings.OLLAMA_AUTO_PULL:
        return

    base_url = _get_ollama_base_url()
    if not base_url:
        return

    available = _fetch_models_from_ollama(base_url)
    available_names = [m.get("name", "") for m in available]
    has_text = any(
        _names_match(a, p) for p in _PREFERRED_TEXT_MODELS for a in available_names
    )
    has_vision = any(
        _names_match(a, p) for p in _PREFERRED_VISION_MODELS for a in available_names
    ) or any(_is_vision_capable(m) for m in available)

    models_to_pull: list[str] = []
    if not has_text:
        models_to_pull.append(_AUTO_PULL_TEXT_MODEL)
    if not has_vision:
        models_to_pull.append(_AUTO_PULL_VISION_MODEL)

    if not models_to_pull:
        logger.info(
            "Ollama: text_model=%s, vision_model=%s — no pull needed.",
            get_best_text_model(),
            get_best_vision_model(),
        )
        return

    try:
        import httpx

        for model_name in models_to_pull:
            logger.info("Ollama: pulling model '%s' (this may take a while)…", model_name)
            with httpx.stream(
                "POST",
                f"{base_url}/api/pull",
                json={"name": model_name},
                timeout=None,  # pulls can take many minutes
            ) as resp:
                resp.raise_for_status()
                for line in resp.iter_lines():
                    if '"status"' in line:
                        try:
                            import json

                            status = json.loads(line).get("status", "")
                            if status:
                                logger.debug("Ollama pull '%s': %s", model_name, status)
                        except Exception:
                            pass

        # Invalidate so the next request sees the freshly pulled models.
        invalidate_cache()
        logger.info(
            "Ollama: finished pulling %s.",
            ", ".join(f"'{m}'" for m in models_to_pull),
        )
    except Exception as exc:
        logger.warning("Ollama model auto-pull failed: %s", exc)
