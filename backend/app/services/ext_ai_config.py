"""Storage for the ordered list of external AI providers.

The list is kept as JSON in ``site_settings.ext_ai_providers``.  Each entry is
``{"id", "provider", "api_key", "model"}``; ``model`` empty means automatic
selection.  Imports try the entries in order and fall back to the next one
when a provider fails.

Installations configured before multiple providers were supported have their
single provider in the legacy ``ext_ai_*`` columns.  That configuration is
returned as a one-entry list until the list is saved for the first time.
"""

from __future__ import annotations

import json
import logging
import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.models import SiteSettings
from app.services import ext_ai_models
from app.services.settings import update_settings

logger = logging.getLogger(__name__)

MAX_ENTRIES = 10
LEGACY_ID = "legacy"


def load_entries(row: SiteSettings) -> list[dict]:
    """Return the configured providers (including API keys), in priority order."""
    if row.ext_ai_providers:
        try:
            data = json.loads(row.ext_ai_providers)
            return [
                e for e in data
                if isinstance(e, dict) and e.get("provider") in ext_ai_models.PROVIDERS and e.get("api_key")
            ]
        except (ValueError, TypeError):
            logger.warning("Invalid ext_ai_providers JSON in site settings; ignoring it")
            return []
    if row.ext_ai_provider in ext_ai_models.PROVIDERS and row.ext_ai_api_key:
        return [{
            "id": LEGACY_ID,
            "provider": row.ext_ai_provider,
            "api_key": row.ext_ai_api_key,
            "model": row.ext_ai_model or "",
        }]
    return []


def public_entries(row: SiteSettings) -> list[dict]:
    """Return the providers without API keys, for the admin UI."""
    return [
        {"id": e["id"], "provider": e["provider"], "model": e.get("model") or None, "key_configured": True}
        for e in load_entries(row)
    ]


def stored_key(row: SiteSettings, entry_id: str, provider: str) -> Optional[str]:
    """Return the stored key of *entry_id* if it belongs to *provider*."""
    for e in load_entries(row):
        if e["id"] == entry_id and e["provider"] == provider:
            return e["api_key"]
    return None


def save_entries(db: Session, row: SiteSettings, incoming: list[dict]) -> SiteSettings:
    """Replace the provider list.

    *incoming* entries have ``id`` (optional for new entries), ``provider``,
    ``model`` and ``api_key``.  An empty ``api_key`` keeps the stored key of
    the entry with the same id, as long as the provider did not change.
    Raises ``ValueError`` with a German message when a key is missing.
    """
    existing = {e["id"]: e for e in load_entries(row)}
    entries = []
    for i, item in enumerate(incoming[:MAX_ENTRIES], start=1):
        old = existing.get(item.get("id") or "")
        key = (item.get("api_key") or "").strip()
        if not key and old and old["provider"] == item["provider"]:
            key = old["api_key"]
        if not key:
            raise ValueError(f"Bitte für KI Nr. {i} ({item['provider']}) einen API-Schlüssel eingeben.")
        entries.append({
            "id": old["id"] if old and old["id"] != LEGACY_ID else uuid.uuid4().hex[:12],
            "provider": item["provider"],
            "api_key": key,
            "model": (item.get("model") or "").strip(),
        })

    ext_ai_models.clear_cache()
    # The list supersedes the legacy single-provider columns, so clear them.
    return update_settings(
        db,
        ext_ai_providers=json.dumps(entries),
        ext_ai_provider=None,
        ext_ai_api_key=None,
        ext_ai_model=None,
        _force_null_keys={"ext_ai_provider", "ext_ai_api_key", "ext_ai_model"},
    )
