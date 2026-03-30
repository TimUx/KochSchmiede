"""Optional AI-based recipe parser using a local LLM (Ollama-compatible API).

Set the ``AI_ENDPOINT`` environment variable to point to an Ollama (or any
OpenAI-compatible) server, e.g.::

    AI_ENDPOINT=http://ollama:11434
    AI_MODEL=llama3.2          # default

When ``AI_ENDPOINT`` is not set the module degrades gracefully – every call to
:func:`parse_with_ai` returns ``None`` and the caller falls back to the
built-in heuristic parser.
"""

from __future__ import annotations

import json
import logging
from typing import Optional

from app.config import settings
from app.schemas import ImportIngredientGroup, ImportResult

logger = logging.getLogger(__name__)

# Maximum characters of recipe text sent to the LLM to stay within typical context windows
# and avoid unnecessarily long inference times.
_AI_TEXT_LIMIT = 6000

_SYSTEM_PROMPT = """Du bist ein Rezept-Parser. Extrahiere Rezeptdaten aus dem
gegebenen Text und gib ein JSON-Objekt mit diesen Feldern zurück:

- title: Rezeptname (string)
- description: kurze Beschreibung oder null
- ingredients: flache Liste von Zutaten als Strings (wenn keine Gruppen)
- ingredient_groups: Liste von {name: string, ingredients: [string, ...]} für Rezepte mit mehreren Zutaten-Gruppen (z.B. "Für den Teig", "Für die Soße")
- steps: Zubereitungsschritte als Strings (nummeriert oder als Liste)
- tags: Liste von Stichwörtern (Küche, Diät, Kategorie usw.)
- prep_time: Vorbereitungszeit in Minuten (Ganzzahl) oder null
- cook_time: Kochzeit in Minuten (Ganzzahl) oder null
- servings: Anzahl der Portionen (Ganzzahl) oder null

Gib ausschließlich gültiges JSON zurück, keinen anderen Text."""


def parse_with_ai(text: str) -> Optional[ImportResult]:
    """Use a local LLM to parse raw recipe text into a structured ``ImportResult``.

    Returns ``None`` when ``AI_ENDPOINT`` is not configured or the request fails,
    so callers can fall back to the heuristic parser transparently.
    """
    if not settings.AI_ENDPOINT:
        return None

    try:
        import httpx

        payload: dict = {
            "model": settings.AI_MODEL,
            "prompt": f"Parse this recipe text:\n\n{text[:_AI_TEXT_LIMIT]}",
            "system": _SYSTEM_PROMPT,
            "stream": False,
            "format": "json",
        }
        response = httpx.post(
            f"{settings.AI_ENDPOINT}/api/generate",
            json=payload,
            timeout=90,
        )
        response.raise_for_status()
        raw = response.json()
        parsed: dict = json.loads(raw.get("response", "{}"))

        # Build ImportResult – unknown fields are silently ignored
        groups_raw = parsed.pop("ingredient_groups", [])
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
    except Exception as exc:
        logger.debug("AI parsing failed (%s); falling back to heuristics.", exc)
        return None
