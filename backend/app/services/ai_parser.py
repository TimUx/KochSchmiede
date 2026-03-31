"""AI-powered recipe parser with multi-backend support.

Priority order for parsing
--------------------------
1. **OpenAI-compatible chat/vision API** (``OPENAI_API_KEY`` or custom
   ``OPENAI_BASE_URL``) – text *and* vision.
   Compatible with: OpenAI (GPT-4o / GPT-4o-mini), Groq, Together.ai,
   LM Studio, Ollama ``/v1`` endpoint, Azure OpenAI, and any other server
   that implements the OpenAI Chat Completions spec.
   Vision-capable models (``gpt-4o``, ``llava``, ``llama3.2-vision``, …)
   can parse recipe *images* directly — no OCR step required.

2. **Ollama native ``/api/generate``** (``AI_ENDPOINT``) – text-only,
   kept for backwards compatibility.

3. **Heuristic parser** – always available, zero configuration.

Quick-start examples
--------------------
OpenAI (best quality)::

    OPENAI_API_KEY=sk-...

Groq (fast, generous free tier)::

    OPENAI_API_KEY=gsk_...
    OPENAI_BASE_URL=https://api.groq.com/openai/v1
    OPENAI_MODEL=llama-3.1-8b-instant

Ollama (local, free)::

    OPENAI_BASE_URL=http://ollama:11434/v1
    OPENAI_MODEL=llama3.2               # or llama3.2-vision for image support

LM Studio (local, free)::

    OPENAI_BASE_URL=http://localhost:1234/v1
"""
from __future__ import annotations

import base64
import json
import logging
from typing import Optional

from app.config import settings
from app.schemas import ImportIngredientGroup, ImportResult

logger = logging.getLogger(__name__)

# Max characters of recipe text sent to the LLM to stay within typical
# context windows and avoid long inference times.
_AI_TEXT_LIMIT = 8000

# ── System prompt ─────────────────────────────────────────────────────────────
# Shared by both text and vision backends.

_SYSTEM_PROMPT = """\
Du bist ein präziser Rezept-Parser-Assistent. Deine Aufgabe ist es, Rezeptdaten
aus beliebig formatiertem Text oder Bildern zu extrahieren – egal ob Fließtext,
mehrspaltige Layouts, Tabellen, Grids oder handgeschriebene Rezepte.

Gib **ausschließlich** ein valides JSON-Objekt zurück (kein Text davor/danach):

{
  "title": "Rezeptname",
  "description": "Kurze Beschreibung oder null",
  "ingredients": ["500 g Mehl", "3 Eier", ...],
  "ingredient_groups": [
    {"name": "Für den Teig", "ingredients": ["500 g Mehl", ...]},
    {"name": "Für die Soße", "ingredients": ["200 ml Sahne", ...]}
  ],
  "steps": ["Schritt-Text...", "Nächster Schritt...", ...],
  "tags": ["Low-Carb", "Vegetarisch", ...],
  "prep_time": 35,
  "cook_time": 20,
  "servings": 4
}

Regeln:
- Wenn alle Zutaten zu einer Gruppe gehören → "ingredients" (flache Liste),
  "ingredient_groups" leer lassen.
- Bei mehreren Zutatengruppen → "ingredient_groups" nutzen, "ingredients" leer.
- Jeder Absatz / Abschnitt der Zubereitung = ein eigener Eintrag in "steps".
- Zeitangaben wie "Arbeitszeit ca. 35 Minuten"  → prep_time: 35
- Zeitangaben wie "Koch-/Backzeit ca. 20 Minuten" → cook_time: 20
- "Gesamtzeit" und "Schwierigkeitsgrad" werden ignoriert.
- Tabellen, Spalten und Grids werden korrekt interpretiert.
- Fehlende Werte als null zurückgeben, nicht weglassen.
"""


# ── Helpers ───────────────────────────────────────────────────────────────────


def _openai_api_enabled() -> bool:
    """True when the OpenAI-compatible chat API can be used.

    Covers:
    - OpenAI (``OPENAI_API_KEY`` set, default base URL)
    - Any local endpoint (``OPENAI_BASE_URL`` overridden, no key required)
    - Groq / Together / Azure / etc. (key + custom base URL)
    """
    return bool(settings.OPENAI_API_KEY) or (
        settings.OPENAI_BASE_URL != "https://api.openai.com/v1"
    )


def _ollama_enabled() -> bool:
    return bool(settings.AI_ENDPOINT)


def _build_import_result(parsed: dict) -> ImportResult:
    """Convert a raw LLM-returned dict into a validated ``ImportResult``."""
    groups_raw = parsed.pop("ingredient_groups", []) or []
    groups = [
        ImportIngredientGroup(
            name=g.get("name", "Zutaten"),
            ingredients=[str(i) for i in g.get("ingredients", [])],
        )
        for g in groups_raw
        if isinstance(g, dict)
    ]
    allowed = set(ImportResult.model_fields)
    safe = {k: v for k, v in parsed.items() if k in allowed}
    safe["ingredient_groups"] = groups
    return ImportResult(**safe)


# ── Backend 1: OpenAI-compatible chat completions (text + vision) ─────────────


def _call_chat_completions(messages: list[dict]) -> Optional[ImportResult]:
    """POST to any OpenAI-compatible ``/chat/completions`` endpoint."""
    if not _openai_api_enabled():
        return None
    try:
        import httpx

        base = settings.OPENAI_BASE_URL.rstrip("/")
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if settings.OPENAI_API_KEY:
            headers["Authorization"] = f"Bearer {settings.OPENAI_API_KEY}"

        resp = httpx.post(
            f"{base}/chat/completions",
            json={
                "model": settings.OPENAI_MODEL,
                "messages": messages,
                "response_format": {"type": "json_object"},
                "temperature": 0.1,
                "max_tokens": 2048,
            },
            headers=headers,
            timeout=120,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        parsed: dict = json.loads(content)
        return _build_import_result(parsed)
    except Exception as exc:
        logger.debug("OpenAI-compatible API call failed: %s", exc)
        return None


# ── Backend 2: Ollama /api/generate (legacy, text-only) ───────────────────────


def _parse_with_ollama_generate(text: str) -> Optional[ImportResult]:
    """Call Ollama's native ``/api/generate`` endpoint (text-only, legacy)."""
    try:
        import httpx

        resp = httpx.post(
            f"{settings.AI_ENDPOINT}/api/generate",
            json={
                "model": settings.AI_MODEL,
                "prompt": f"Parse this recipe text:\n\n{text[:_AI_TEXT_LIMIT]}",
                "system": _SYSTEM_PROMPT,
                "stream": False,
                "format": "json",
            },
            timeout=120,
        )
        resp.raise_for_status()
        raw = resp.json()
        parsed: dict = json.loads(raw.get("response", "{}"))
        return _build_import_result(parsed)
    except Exception as exc:
        logger.debug("Ollama /api/generate failed: %s", exc)
        return None


# ── Public API ────────────────────────────────────────────────────────────────


def parse_with_ai(text: str) -> Optional[ImportResult]:
    """Parse raw recipe text with the best available AI backend.

    Tries the OpenAI-compatible chat API first; falls back to Ollama's native
    endpoint if configured.  Returns ``None`` when no AI backend is available
    so callers can fall back to the heuristic parser.
    """
    if not text.strip():
        return None

    # 1. OpenAI-compatible chat completions (preferred)
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"Parse this recipe:\n\n{text[:_AI_TEXT_LIMIT]}",
        },
    ]
    result = _call_chat_completions(messages)
    if result:
        return result

    # 2. Ollama /api/generate (legacy)
    if _ollama_enabled():
        return _parse_with_ollama_generate(text)

    return None


def parse_image_with_ai(
    image_bytes: bytes, mime_type: str = "image/jpeg"
) -> Optional[ImportResult]:
    """Parse a recipe image directly using a vision-capable AI model.

    Sends the raw image to the vision model, bypassing Tesseract OCR
    entirely.  This yields significantly better results for complex
    layouts, tables, multi-column PDFs, and handwritten recipes.

    Requires the OpenAI-compatible API with a vision model such as
    ``gpt-4o``, ``gpt-4o-mini``, ``llava``, or ``llama3.2-vision``.

    Returns ``None`` when no vision AI is configured or the call fails.
    """
    if not _openai_api_enabled():
        return None

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
    return _call_chat_completions(messages)


def has_text_ai() -> bool:
    """Return ``True`` if any text-based AI backend is configured."""
    return _openai_api_enabled() or _ollama_enabled()


def has_vision_ai() -> bool:
    """Return ``True`` if a vision-capable AI backend is configured.

    Vision AI sends images directly to the model (no OCR needed).
    Requires ``OPENAI_API_KEY`` or a custom ``OPENAI_BASE_URL`` pointing
    to a vision-capable model (e.g. ``gpt-4o``, ``llava``,
    ``llama3.2-vision``).
    """
    return _openai_api_enabled()
