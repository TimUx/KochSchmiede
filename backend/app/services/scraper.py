import re
from ipaddress import ip_address, ip_network
from typing import Optional
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

from app.schemas import ImportResult

# Private/loopback networks to block (SSRF protection)
_BLOCKED_NETWORKS = [
    ip_network("127.0.0.0/8"),
    ip_network("10.0.0.0/8"),
    ip_network("172.16.0.0/12"),
    ip_network("192.168.0.0/16"),
    ip_network("169.254.0.0/16"),
    ip_network("::1/128"),
    ip_network("fc00::/7"),
]


def _validate_url(url: str) -> None:
    """Raise ValueError if the URL is unsafe (non-HTTP/S or private IP)."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Only http/https URLs are allowed")
    hostname = parsed.hostname or ""
    if not hostname:
        raise ValueError("Invalid URL: missing hostname")
    # Resolve and block private IP ranges
    import socket

    try:
        addr = ip_address(socket.gethostbyname(hostname))
        for net in _BLOCKED_NETWORKS:
            if addr in net:
                raise ValueError(f"Requests to private/internal addresses are not allowed: {addr}")
    except (socket.gaierror, ValueError) as e:
        if "not allowed" in str(e):
            raise
        # DNS resolution failed or hostname is not an IP — still allow (fail at request time)



def _clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _detect_ingredients(lines: list[str]) -> list[str]:
    """
    Heuristic: lines with amounts/units are likely ingredients.
    """
    amount_pattern = re.compile(
        r"(\d+[\.,]?\d*\s*(g|kg|ml|l|cl|tl|el|tbsp|tsp|cup|oz|lb|prise|bunch|piece|stk|stück|pkg|pck)?)",
        re.IGNORECASE,
    )
    result = []
    for line in lines:
        stripped = line.strip()
        if not stripped or len(stripped) < 3:
            continue
        if amount_pattern.search(stripped):
            result.append(stripped)
    return result


def _detect_steps(lines: list[str]) -> list[str]:
    """
    Heuristic: numbered lines or longer instruction lines are steps.
    """
    step_pattern = re.compile(r"^(\d+[\.\):]?\s+|schritt\s+\d+|step\s+\d+)", re.IGNORECASE)
    result = []
    for line in lines:
        stripped = line.strip()
        if not stripped or len(stripped) < 15:
            continue
        if step_pattern.match(stripped) or len(stripped) > 40:
            result.append(re.sub(r"^\d+[\.\):\s]+", "", stripped).strip())
    return result


def scrape_url(url: str) -> ImportResult:
    """Scrape a recipe website and extract structured data."""
    _validate_url(url)
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (compatible; KochSchmiede/1.0; +https://github.com/TimUx/KochSchmiede)"
        )
    }
    resp = requests.get(url, headers=headers, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "lxml")

    # Title
    title: Optional[str] = None
    og_title = soup.find("meta", property="og:title")
    if og_title and og_title.get("content"):
        title = _clean_text(og_title["content"])
    if not title and soup.title:
        title = _clean_text(soup.title.text)

    # Description
    description: Optional[str] = None
    og_desc = soup.find("meta", property="og:description")
    if og_desc and og_desc.get("content"):
        description = _clean_text(og_desc["content"])

    # Image
    image_url: Optional[str] = None
    og_img = soup.find("meta", property="og:image")
    if og_img and og_img.get("content"):
        image_url = og_img["content"]

    # Try JSON-LD structured data first (most accurate)
    import json

    ingredients: list[str] = []
    steps: list[str] = []
    tags: list[str] = []

    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            if isinstance(data, list):
                data = next((d for d in data if d.get("@type") in ("Recipe", "recipe")), {})
            recipe_type = data.get("@type", "")
            if recipe_type not in ("Recipe", "recipe"):
                # check @graph
                graph = data.get("@graph", [])
                data = next((d for d in graph if d.get("@type") == "Recipe"), {})

            if data.get("recipeIngredient"):
                ingredients = [_clean_text(i) for i in data["recipeIngredient"]]
            if data.get("recipeInstructions"):
                raw = data["recipeInstructions"]
                if isinstance(raw, list):
                    for item in raw:
                        if isinstance(item, str):
                            steps.append(_clean_text(item))
                        elif isinstance(item, dict):
                            steps.append(_clean_text(item.get("text", "")))
                elif isinstance(raw, str):
                    steps = [_clean_text(s) for s in raw.split("\n") if s.strip()]
            if data.get("keywords"):
                kw = data["keywords"]
                tags = [t.strip() for t in (kw.split(",") if isinstance(kw, str) else kw)]
            if data.get("name") and not title:
                title = _clean_text(data["name"])
        except Exception:
            pass

    # Fallback: heuristic text extraction
    if not ingredients or not steps:
        text_lines = [line for line in soup.get_text(separator="\n").splitlines() if line.strip()]
        if not ingredients:
            ingredients = _detect_ingredients(text_lines)[:20]
        if not steps:
            steps = _detect_steps(text_lines)[:15]

    return ImportResult(
        title=title,
        description=description,
        image_url=image_url,
        source_url=url,
        ingredients=ingredients,
        steps=steps,
        tags=tags,
    )
