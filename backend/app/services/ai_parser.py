"""AI-powered recipe parser – free / local backends only.

Priority order for parsing
--------------------------
1. **Local LLM via OpenAI Chat Completions protocol** (``LLM_BASE_URL``) –
   text *and* vision.  Works with any local server that implements the
   OpenAI-compatible API:

   * **Ollama** – start the bundled service with
     ``docker compose --profile ollama up``, then set
     ``LLM_BASE_URL=http://ollama:11434/v1``.

     The pipeline automatically discovers all loaded Ollama models and selects:
       – the fastest/smallest available **text model** for clean PDF/text input
       – the best available **vision model** for complex images / magazine scans

     Models are auto-pulled on first use when ``OLLAMA_AUTO_PULL=true`` (the
     default): a lightweight text model (``llama3.2``) and a vision model
     (``llava:7b``) are downloaded if none are already present.

   * **LM Studio** – free desktop app at https://lmstudio.ai.
     Start the local server, load a model, and set
     ``LLM_BASE_URL=http://host.docker.internal:1234/v1``
     ``LLM_MODEL=your-loaded-model-name``  (required for LM Studio).

   **Model override**: set ``LLM_MODEL=<name>`` in ``.env`` to lock a
   specific model instead of relying on auto-selection.

2. **Ollama native ``/api/generate``** (``AI_ENDPOINT``) – text-only,
   kept for backwards compatibility.

3. **Heuristic parser** – always available, zero configuration.

Quick-start (Ollama, fully automatic)::

    # 1. Start stack with Ollama included
    docker compose --profile ollama up -d

    # 2. Add to .env (models are pulled automatically on first import)
    LLM_BASE_URL=http://ollama:11434/v1

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
import re
from typing import Optional

from app.config import settings
from app.schemas import ImportIngredientGroup, ImportResult

logger = logging.getLogger(__name__)

# Max characters of recipe text sent to the LLM to stay within typical
# context windows and avoid long inference times.
# Set conservatively so that the system prompt + recipe text fits within a
# 4096-token context window (common for small local models such as llama3.2 3B).
_AI_TEXT_LIMIT = 3000

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
- Stehen Menge, Einheit und Zutatenname auf getrennten Zeilen oder in getrennten
  Spalten (z.B. "g\n250\nMagerquark"), kombiniere sie immer zu einem einzigen
  String: "250 g Magerquark".  Jede Zutat = genau ein Eintrag im ingredients-Array.
- Jeden Absatz der Zubereitung als eigenen step-Eintrag ausgeben.  Niemals mehrere
  Absätze zu einem step zusammenfassen.
- "Gesamtzeit", "Schwierigkeitsgrad" und ähnliche Metadaten gehören NICHT in steps.
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


def _get_text_model() -> Optional[str]:
    """Return the model name to use for text parsing.

    Returns the explicit ``LLM_MODEL`` setting when set, otherwise queries
    Ollama for the best available text model.  Returns ``None`` when no model
    is available.
    """
    if settings.LLM_MODEL:
        return settings.LLM_MODEL
    from app.services.ollama_models import get_best_text_model

    return get_best_text_model()


def _get_vision_model() -> Optional[str]:
    """Return the model name to use for vision parsing.

    When ``LLM_MODEL`` is set explicitly:
    - ``LLM_VISION=True``  → always return the model (user explicitly confirmed
      vision capability, e.g. a custom GGUF with an unusual name).
    - ``LLM_VISION=False`` → return ``None`` (user opted out of vision).
    - ``LLM_VISION=None``  → auto-detect:
        1. If the model name matches a known vision-capable pattern (e.g.
           "llava", "vision", "moondream"), return it directly.
        2. Otherwise the model is assumed to be text-only.  Query Ollama for a
           dedicated vision model (e.g. ``llava:7b`` pulled alongside a text
           model such as ``llama3.2``).
        3. If no dedicated vision model is found either, return ``None`` so
           ``has_vision_ai()`` reports ``False`` and the pipeline skips the
           vision step instead of sending an image to a text-only model.

    When ``LLM_MODEL`` is empty, queries Ollama for the best available vision
    model.  ``LLM_VISION=false`` can still be used to override auto-detection.
    """
    if settings.LLM_VISION is False:
        return None  # explicit opt-out

    if settings.LLM_MODEL:
        if settings.LLM_VISION is True:
            # User explicitly confirmed this model handles vision.
            return settings.LLM_MODEL

        # LLM_VISION is None — check whether the model name looks vision-capable.
        from app.services.ollama_models import _VISION_NAME_PATTERNS

        if any(p.search(settings.LLM_MODEL) for p in _VISION_NAME_PATTERNS):
            return settings.LLM_MODEL

        # Model name doesn't look vision-capable (e.g. LLM_MODEL=llama3.2).
        # Try Ollama auto-detection so a dedicated vision model (e.g. llava:7b)
        # can be used even when LLM_MODEL is locked to a text-only model.
        from app.services.ollama_models import get_best_vision_model

        return get_best_vision_model()

    # Auto-detect: find the best vision-capable model in Ollama.
    from app.services.ollama_models import get_best_vision_model

    return get_best_vision_model()


# ── Ingredient fragment post-processing ───────────────────────────────────────
# Small AI models (≤ 7 B) often return ingredient tables as separate strings
# for amount, unit and name when the PDF source has them in different columns or
# on different lines.  Examples of broken AI output:
#   ["g", "250", "Magerquark"]    → should be "250 g Magerquark"
#   ["TL 2", "Ketchup"]           → should be "2 TL Ketchup"
#   ["3 Scheibe/n", "Schmelzkäse"] → should be "3 Scheibe/n Schmelzkäse"
#
# A "fragment" is a string that carries only the quantitative part of an
# ingredient (pure unit, pure number, "unit amount", or "amount unit") without
# the ingredient name.

_UNITS_GROUP = r"(?:g|kg|ml|l|cl|tl|el|tbsp|tsp|cup|oz|lb|prise|stk|stück|scheibe[\w/]*)"

# Matches any string that is only a fragment (no ingredient name).
_INGREDIENT_FRAGMENT_RE = re.compile(
    r"^(?:"
    + _UNITS_GROUP
    + r"|\d+[\.,]?\d*"  # pure number
    + r"|" + _UNITS_GROUP + r"\s+\d+[\.,]?\d*"  # unit + number (wrong order)
    + r"|\d+[\.,]?\d*\s+" + _UNITS_GROUP  # number + unit (correct order)
    + r")$",
    re.IGNORECASE,
)

# Matches "unit amount" so it can be reordered to "amount unit".
_UNIT_THEN_NUM_RE = re.compile(
    r"^(" + _UNITS_GROUP + r")\s+(\d+[\.,]?\d*)$", re.IGNORECASE
)


def _normalize_fragment(s: str) -> str:
    """Reorder 'unit amount' to 'amount unit', e.g. 'g 250' → '250 g'."""
    m = _UNIT_THEN_NUM_RE.match(s)
    if m:
        return f"{m.group(2)} {m.group(1)}"
    return s


def _combine_ingredient_fragments(items: list[str]) -> list[str]:
    """Merge consecutive unit/amount fragments with the following ingredient name.

    Handles the common small-model output pattern where amount, unit and
    ingredient name are returned as separate list entries instead of one
    combined string.

    Examples::

        ["g", "250", "Magerquark"]     → ["250 g Magerquark"]
        ["TL 2", "Ketchup"]            → ["2 TL Ketchup"]
        ["3", "Ei(er)"]                → ["3 Ei(er)"]
        ["Salz und Pfeffer"]           → ["Salz und Pfeffer"]  (unchanged)
    """
    result: list[str] = []
    buffer: list[str] = []  # accumulated raw fragment strings waiting for a name

    for raw in items:
        s = raw.strip()
        if not s:
            continue
        if _INGREDIENT_FRAGMENT_RE.match(s):
            # Store raw; normalization (unit/amount reordering) happens at join time.
            buffer.append(s)
        else:
            if buffer:
                prefix = _normalize_fragment(" ".join(buffer))
                result.append(f"{prefix} {s}".strip())
                buffer = []
            else:
                result.append(s)

    # Flush any leftover fragment (e.g. ingredient with no following name).
    if buffer:
        result.append(_normalize_fragment(" ".join(buffer)))

    return result


# Threshold for the merged-step quality check in ``_result_looks_valid``.
# Steps longer than this (in characters) are inspected for boilerplate content.
_MERGED_STEP_LENGTH_THRESHOLD = 300


def _result_looks_valid(result: ImportResult) -> bool:
    """Return ``False`` when the AI result has obvious structural problems.

    A ``False`` return causes the caller to discard the AI result and fall
    back to the heuristic parser, which handles the same text more reliably.

    Checks performed:

    * Title must exist and be at least 3 characters long.
    * If only one step exists, is very long (> ``_MERGED_STEP_LENGTH_THRESHOLD``
      chars) **and** contains boilerplate timing / metadata text (Gesamtzeit,
      Schwierigkeitsgrad, "ca. N Minuten"), the model merged all preparation
      paragraphs into one block — a clear sign of failure.
    """
    if not result.title or len(result.title.strip()) < 3:
        return False

    if len(result.steps) == 1 and len(result.steps[0]) > _MERGED_STEP_LENGTH_THRESHOLD:
        merged = result.steps[0]
        if re.search(
            r"\bGesamtzeit\b|Schwierigkeitsgrad|\bca\.\s*\d+\s*Min",
            merged,
            re.IGNORECASE,
        ):
            return False

    return True


def _build_import_result(parsed: dict) -> Optional[ImportResult]:
    """Convert a raw LLM-returned dict into a validated ``ImportResult``.

    Returns ``None`` when the parsed result has obvious structural problems
    so callers can fall back to the heuristic parser instead.
    """
    groups_raw = parsed.pop("ingredient_groups", []) or []
    groups = [
        ImportIngredientGroup(
            name=g.get("name", "Zutaten"),
            ingredients=_combine_ingredient_fragments(
                [str(i) for i in g.get("ingredients", [])]
            ),
        )
        for g in groups_raw
        if isinstance(g, dict)
    ]
    allowed = set(ImportResult.model_fields)
    safe = {k: v for k, v in parsed.items() if k in allowed}
    # Fix fragmented flat ingredient list as well.
    if "ingredients" in safe and isinstance(safe["ingredients"], list):
        safe["ingredients"] = _combine_ingredient_fragments(
            [str(i) for i in safe["ingredients"]]
        )
    safe["ingredient_groups"] = groups
    # Deduplication: small models sometimes populate both ``ingredients`` and
    # ``ingredient_groups`` despite the system prompt saying to leave
    # ``ingredients`` empty when groups are used.  Remove flat items already
    # covered by a named group and append any remainder to the last group,
    # mirroring the heuristic parser's post-processing logic.
    if groups and safe.get("ingredients"):
        grouped_items = {item for g in groups for item in g.ingredients}
        remaining = [item for item in safe["ingredients"] if item not in grouped_items]
        if remaining:
            groups[-1].ingredients.extend(remaining)
        safe["ingredients"] = []
    result = ImportResult(**safe)
    if not _result_looks_valid(result):
        logger.debug("AI result failed quality check – falling back to heuristic")
        return None
    return result


# ── Backend 1: local LLM via OpenAI Chat Completions protocol ─────────────────


def _call_chat_completions(
    messages: list[dict], model: Optional[str] = None
) -> Optional[ImportResult]:
    """POST to a local ``/chat/completions`` endpoint (Ollama /v1, LM Studio, …).

    *model* overrides the auto-selected model for this call.  When omitted the
    best available text model is used (as returned by ``_get_text_model()``).
    """
    if not _llm_api_enabled():
        return None
    resolved_model = model or _get_text_model()
    if not resolved_model:
        logger.debug("No text model available — skipping chat completions")
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
                "model": resolved_model,
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
        # Use the best text model (auto-selected or overridden via LLM_MODEL).
        result = _call_chat_completions(messages, model=_get_text_model())
        if result:
            return result

    # 2. Ollama /api/generate (legacy)
    if _ollama_enabled():
        return _parse_with_ollama_generate(text)

    return None


def parse_image_with_ai(
    image_bytes: bytes, mime_type: str = "image/jpeg"
) -> Optional[ImportResult]:
    """Parse a recipe image directly using the best available vision-capable model.

    Sends the raw image to a vision model (auto-selected from Ollama or
    overridden via ``LLM_MODEL``), bypassing Tesseract OCR entirely.  This
    yields significantly better results for complex layouts, tables,
    multi-column magazine pages, and handwritten recipes.

    Returns ``None`` when no vision model is configured/available or the
    call fails.
    """
    if not _llm_api_enabled():
        return None

    vision_model = _get_vision_model()
    if not vision_model:
        logger.debug("No vision model available — skipping vision AI step")
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
    logger.debug("Using vision model '%s' for image parsing", vision_model)
    return _call_chat_completions(messages, model=vision_model)


def has_text_ai() -> bool:
    """Return ``True`` if any text-based AI backend is configured and has a model."""
    if _ollama_enabled():
        return True
    if not _llm_api_enabled():
        return False
    return _get_text_model() is not None


def has_vision_ai() -> bool:
    """Return ``True`` if a vision-capable model is available.

    Auto-detects by querying Ollama for vision-capable models when
    ``LLM_MODEL`` is not set explicitly.  ``LLM_VISION=false`` overrides this
    and always returns ``False`` regardless of available models.
    """
    if not _llm_api_enabled():
        return False
    return _get_vision_model() is not None
