"""Food image search service.

Currently supports the **Pixabay** image API (free, 500 req/hour).
Set ``IMAGE_SEARCH_API_KEY`` and ``IMAGE_SEARCH_PROVIDER=pixabay`` in the
environment to enable image search during recipe import.

Returns a list of :class:`ImageSearchItem` dictionaries that the import
endpoint forwards to the frontend.
"""

import logging
from typing import TypedDict

import requests

from app.config import settings

logger = logging.getLogger(__name__)

_PIXABAY_API_URL = "https://pixabay.com/api/"
_DEFAULT_COUNT = 6
_PIXABAY_MAX_PER_PAGE = 20  # Pixabay API upper limit for per_page


class ImageSearchItem(TypedDict):
    thumb_url: str
    url: str
    photographer: str
    source_url: str


def search_food_images(query: str, count: int = _DEFAULT_COUNT) -> list[ImageSearchItem]:
    """Search for food images matching *query*.

    Returns up to *count* items.  Returns an empty list when the image search
    feature is not configured or when the upstream API call fails.
    """
    provider = settings.IMAGE_SEARCH_PROVIDER.lower()
    api_key = settings.IMAGE_SEARCH_API_KEY

    if not api_key:
        return []

    if provider == "pixabay":
        return _search_pixabay(query, api_key, count)

    logger.warning("Unknown IMAGE_SEARCH_PROVIDER %r – image search disabled", provider)
    return []


def _search_pixabay(query: str, api_key: str, count: int) -> list[ImageSearchItem]:
    """Query the Pixabay API and return normalised results."""
    try:
        resp = requests.get(
            _PIXABAY_API_URL,
            params={
                "key": api_key,
                "q": query,
                "image_type": "photo",
                "category": "food",
                "per_page": min(count, _PIXABAY_MAX_PER_PAGE),
                "safesearch": "true",
                "lang": "de",
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning("Pixabay image search failed: %s", exc)
        return []

    results: list[ImageSearchItem] = []
    for hit in data.get("hits", [])[:count]:
        results.append(
            ImageSearchItem(
                thumb_url=hit.get("previewURL", ""),
                url=hit.get("webformatURL", hit.get("previewURL", "")),
                photographer=hit.get("user", ""),
                source_url=hit.get("pageURL", ""),
            )
        )
    return results
