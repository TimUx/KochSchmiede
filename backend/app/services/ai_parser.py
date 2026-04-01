"""AI-powered recipe parser – free / local backends only.

Priority order for parsing
--------------------------
1. **Local LLM via OpenAI Chat Completions protocol** (``LLM_BASE_URL``) –
   text *and* vision.  Works with any local server that implements the
   OpenAI-compatible API:

   * **Ollama** – start the bundled service with
     ``docker compose --profile ollama up``, then set
     ``LLM_BASE_URL=http://ollama:11434/v1``.
     Pull a vision model for best results:
     ``docker compose exec ollama ollama pull llama3.2-vision``

   * **LM Studio** – free desktop app at https://lmstudio.ai.
     Start the local server and set
     ``LLM_BASE_URL=http://host.docker.internal:1234/v1``.

   Vision-capable models (``llama3.2-vision``, ``llava``, ``minicpm-v``, …)
   parse recipe *images* directly — no OCR step required, handles tables /
   columns / grids perfectly.

   **Text-only model (Tesseract + LLM, resource-efficient)**:
   Set ``LLM_VISION=false`` in ``.env`` when using a text-only model such as
   ``llama3.2``.  The pipeline then runs Tesseract OCR on the image first and
   sends the extracted text to the LLM — no vision model needed.  This
   requires significantly less RAM/VRAM and is ideal for CPU-only or
   low-memory servers.

2. **Ollama native ``/api/generate``** (``AI_ENDPOINT``) – text-only,
   kept for backwards compatibility.

3. **Heuristic parser** – always available, zero configuration.

Quick-start (Ollama, vision model, recommended for best quality)::

    # 1. Start stack with Ollama included
    docker compose --profile ollama up -d

    # 2. Pull a vision model (best quality)
    docker compose exec ollama ollama pull llama3.2-vision

    # 3. Add to .env
    LLM_BASE_URL=http://ollama:11434/v1
    LLM_MODEL=llama3.2-vision

Quick-start (Ollama, text-only model + Tesseract OCR, resource-efficient)::

    # 1. Start stack with Ollama included
    docker compose --profile ollama up -d

    # 2. Pull a smaller text-only model
    docker compose exec ollama ollama pull llama3.2

    # 3. Add to .env
    LLM_BASE_URL=http://ollama:11434/v1
    LLM_MODEL=llama3.2
    LLM_VISION=false    # skip vision step → use Tesseract OCR instead

Quick-start (LM Studio)::

    # 1. Download LM Studio and load a model (e.g. llama-3.2-vision)
    # 2. Start the local server in LM Studio
    # 3. Add to .env
    LLM_BASE_URL=http://host.docker.internal:1234/v1
    LLM_MODEL=your-loaded-model-name
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


def _llm_api_enabled() -> bool:
    """True when a local LLM server is configured via ``LLM_BASE_URL``."""
    return bool(settings.LLM_BASE_URL)


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


# ── Backend 1: local LLM via OpenAI Chat Completions protocol ─────────────────


def _call_chat_completions(messages: list[dict]) -> Optional[ImportResult]:
    """POST to a local ``/chat/completions`` endpoint (Ollama /v1, LM Studio, …)."""
    if not _llm_api_enabled():
        return None
    try:
        import httpx

        base = settings.LLM_BASE_URL.rstrip("/")
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if settings.LLM_API_KEY:
            headers["Authorization"] = f"Bearer {settings.LLM_API_KEY}"

        resp = httpx.post(
            f"{base}/chat/completions",
            json={
                "model": settings.LLM_MODEL,
                "messages": messages,
                "response_format": {"type": "json_object"},
                "temperature": 0.1,
                "max_tokens": 2048,
            },
            headers=headers,
            timeout=settings.AI_TIMEOUT,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        parsed: dict = json.loads(content)
        return _build_import_result(parsed)
    except Exception as exc:
        logger.debug("Local LLM API call failed: %s", exc)
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
            timeout=settings.AI_TIMEOUT,
        )
        resp.raise_for_status()
        raw = resp.json()
        parsed: dict = json.loads(raw.get("response", "{}"))
        return _build_import_result(parsed)
    except Exception as exc:
        logger.debug("Ollama /api/generate failed: %s", exc)
        return None


# ── Public API ────────────────────────────────────────────────────────────────


def parse_with_ai(text: str, skip_chat_completions: bool = False) -> Optional[ImportResult]:
    """Parse raw recipe text with the best available free AI backend.

    Tries the local LLM server (Ollama /v1 or LM Studio) first; falls
    back to Ollama's native ``/api/generate`` endpoint if configured.
    Returns ``None`` when no AI backend is available so callers fall back
    to the heuristic parser.

    Set *skip_chat_completions* to ``True`` when the chat-completions
    endpoint is already known to be failing for the current request (e.g.
    it timed out for the vision step) so the fallback is reached immediately
    without another long wait.
    """
    if not text.strip():
        return None

    # 1. Local LLM via chat completions (Ollama /v1, LM Studio, …)
    if not skip_chat_completions:
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
    """Parse a recipe image directly using a vision-capable local LLM.

    Sends the raw image to the vision model, bypassing Tesseract OCR
    entirely.  This yields significantly better results for complex
    layouts, tables, multi-column PDFs, and handwritten recipes.

    Requires a local LLM server (``LLM_BASE_URL``) running a vision model
    such as ``llama3.2-vision``, ``llava``, or ``minicpm-v``.

    Returns ``None`` when no vision AI is configured or the call fails.
    """
    if not _llm_api_enabled():
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
    return _llm_api_enabled() or _ollama_enabled()


def has_vision_ai() -> bool:
    """Return ``True`` if a vision-capable local LLM is configured.

    Vision AI sends images directly to the model (no OCR needed).
    Requires ``LLM_BASE_URL`` pointing to a server running a vision model
    (e.g. ``llama3.2-vision``, ``llava``, ``minicpm-v``) **and**
    ``LLM_VISION=true`` (the default).

    Set ``LLM_VISION=false`` in ``.env`` when using a text-only model
    (e.g. ``llama3.2``): the pipeline will then run Tesseract OCR on the
    image first and send the extracted text to the LLM instead.  This
    requires significantly less RAM/VRAM and is ideal for CPU-only servers.
    """
    return _llm_api_enabled() and settings.LLM_VISION
