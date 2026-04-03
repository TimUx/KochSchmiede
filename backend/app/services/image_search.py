"""Food image search service.

Supports multiple image API providers.  Configure one or more (comma-separated)
via ``IMAGE_SEARCH_PROVIDER`` and supply the matching API keys.  The service
tries providers in order and returns results from the first one that finds
something.

Supported providers
-------------------
pixabay  – Free, 500 req/hour.  Key: ``PIXABAY_API_KEY`` (or legacy
           ``IMAGE_SEARCH_API_KEY``).  https://pixabay.com/api/docs/
unsplash – Free (50 req/hour demo / 5000 req/hour production).
           Key: ``UNSPLASH_API_KEY``.  https://unsplash.com/developers
pexels   – Free, 200 req/hour.  Key: ``PEXELS_API_KEY``.
           https://www.pexels.com/api/
"""

import logging
from typing import TypedDict

import requests

from app.config import settings

logger = logging.getLogger(__name__)

_PIXABAY_API_URL = "https://pixabay.com/api/"
_UNSPLASH_API_URL = "https://api.unsplash.com/search/photos"
_PEXELS_API_URL = "https://api.pexels.com/v1/search"

_DEFAULT_COUNT = 6
_PIXABAY_MAX_PER_PAGE = 20  # Pixabay API upper limit for per_page

# Provider display names and home-page URLs used for attribution.
_PROVIDER_META: dict[str, tuple[str, str]] = {
    "pixabay": ("Pixabay", "https://pixabay.com"),
    "unsplash": ("Unsplash", "https://unsplash.com"),
    "pexels": ("Pexels", "https://www.pexels.com"),
}


class ImageSearchItem(TypedDict):
    thumb_url: str
    url: str
    photographer: str
    source_url: str
    source: str  # provider identifier, e.g. "pixabay"
    source_name: str  # human-readable name, e.g. "Pixabay"
    source_home: str  # provider home URL for attribution link


def search_food_images(query: str, count: int = _DEFAULT_COUNT) -> list[ImageSearchItem]:
    """Search for food images matching *query*.

    Tries the configured providers in order and returns results from the first
    one that finds at least one image.  Returns an empty list when no provider
    is configured or all upstream calls fail.
    """
    # Build provider-to-key mapping from the various env vars.
    keys: dict[str, str] = {}

    pixabay_key = settings.PIXABAY_API_KEY or settings.IMAGE_SEARCH_API_KEY
    if pixabay_key:
        keys["pixabay"] = pixabay_key
    if settings.UNSPLASH_API_KEY:
        keys["unsplash"] = settings.UNSPLASH_API_KEY
    if settings.PEXELS_API_KEY:
        keys["pexels"] = settings.PEXELS_API_KEY

    if not keys:
        return []

    # Determine the ordered list of providers to attempt.
    provider_setting = settings.IMAGE_SEARCH_PROVIDER.strip()
    if provider_setting:
        providers = [p.strip().lower() for p in provider_setting.split(",") if p.strip()]
    else:
        # Auto: try all configured providers in a sensible default order.
        providers = ["pixabay", "unsplash", "pexels"]

    for provider in providers:
        key = keys.get(provider)
        if not key:
            continue
        results = _dispatch(provider, query, key, count)
        if results:
            return results

    return []


# ─── Provider dispatch ────────────────────────────────────────────────────────


def _dispatch(provider: str, query: str, api_key: str, count: int) -> list[ImageSearchItem]:
    if provider == "pixabay":
        return _search_pixabay(query, api_key, count)
    if provider == "unsplash":
        return _search_unsplash(query, api_key, count)
    if provider == "pexels":
        return _search_pexels(query, api_key, count)
    logger.warning("Unknown IMAGE_SEARCH_PROVIDER %r – skipping", provider)
    return []


def _make_item(
    provider: str,
    *,
    thumb_url: str,
    url: str,
    photographer: str = "",
    source_url: str = "",
) -> ImageSearchItem:
    name, home = _PROVIDER_META.get(provider, (provider.capitalize(), ""))
    return ImageSearchItem(
        thumb_url=thumb_url,
        url=url,
        photographer=photographer,
        source_url=source_url,
        source=provider,
        source_name=name,
        source_home=home,
    )


# ─── Pixabay ─────────────────────────────────────────────────────────────────


def _search_pixabay(query: str, api_key: str, count: int) -> list[ImageSearchItem]:
    """Query the Pixabay API and return normalised results.

    First tries with ``category=food`` for better relevance.  Falls back to an
    unrestricted search so that specific recipe names (e.g. "Ei-Muffin") are
    still found even when Pixabay has no food-category entries for them.
    """
    base_params = {
        "key": api_key,
        "q": query,
        "image_type": "photo",
        "per_page": min(count, _PIXABAY_MAX_PER_PAGE),
        "safesearch": "true",
    }

    # First attempt: with food category filter.
    results = _search_pixabay_once(base_params | {"category": "food"}, count)
    if results:
        return results

    # Second attempt: without category restriction (catches specific dish names).
    return _search_pixabay_once(base_params, count)


def _search_pixabay_once(params: dict, count: int) -> list[ImageSearchItem]:
    try:
        resp = requests.get(_PIXABAY_API_URL, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning("Pixabay image search failed: %s", exc)
        return []

    results: list[ImageSearchItem] = []
    for hit in data.get("hits", [])[:count]:
        results.append(
            _make_item(
                "pixabay",
                thumb_url=hit.get("previewURL", ""),
                url=hit.get("webformatURL", hit.get("previewURL", "")),
                photographer=hit.get("user", ""),
                source_url=hit.get("pageURL", ""),
            )
        )
    return results


# ─── Unsplash ────────────────────────────────────────────────────────────────


def _search_unsplash(query: str, api_key: str, count: int) -> list[ImageSearchItem]:
    """Query the Unsplash API and return normalised results."""
    try:
        resp = requests.get(
            _UNSPLASH_API_URL,
            params={
                "query": query,
                "per_page": count,
                "orientation": "landscape",
            },
            headers={"Authorization": f"Client-ID {api_key}"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning("Unsplash image search failed: %s", exc)
        return []

    results: list[ImageSearchItem] = []
    for photo in data.get("results", [])[:count]:
        urls = photo.get("urls", {})
        user = photo.get("user", {})
        results.append(
            _make_item(
                "unsplash",
                thumb_url=urls.get("thumb", urls.get("small", "")),
                url=urls.get("regular", urls.get("full", "")),
                photographer=user.get("name", ""),
                source_url=photo.get("links", {}).get("html", ""),
            )
        )
    return results


# ─── Pexels ──────────────────────────────────────────────────────────────────


def _search_pexels(query: str, api_key: str, count: int) -> list[ImageSearchItem]:
    """Query the Pexels API and return normalised results."""
    try:
        resp = requests.get(
            _PEXELS_API_URL,
            params={
                "query": query,
                "per_page": count,
                "orientation": "landscape",
            },
            headers={"Authorization": api_key},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning("Pexels image search failed: %s", exc)
        return []

    results: list[ImageSearchItem] = []
    for photo in data.get("photos", [])[:count]:
        src = photo.get("src", {})
        results.append(
            _make_item(
                "pexels",
                thumb_url=src.get("small", src.get("medium", "")),
                url=src.get("large", src.get("original", "")),
                photographer=photo.get("photographer", ""),
                source_url=photo.get("url", ""),
            )
        )
    return results
