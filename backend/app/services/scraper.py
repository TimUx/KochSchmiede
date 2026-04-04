import re
from ipaddress import ip_address, ip_network
from typing import Optional
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

from app.schemas import ImportIngredientGroup, ImportResult

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


def _parse_duration_iso(value: str) -> Optional[int]:
    """Parse an ISO 8601 duration string (e.g. 'PT30M', 'PT1H15M', 'P1DT2H') into minutes."""
    if not value:
        return None
    m = re.match(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", value, re.IGNORECASE)
    if not m:
        return None
    days = int(m.group(1) or 0)
    hours = int(m.group(2) or 0)
    minutes = int(m.group(3) or 0)
    seconds = int(m.group(4) or 0)
    total = days * 24 * 60 + hours * 60 + minutes + seconds // 60
    return total if total > 0 else None


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


def _extract_ingredient_groups_from_jsonld(data: dict) -> list[ImportIngredientGroup]:
    """
    Attempt to extract grouped ingredients from a JSON-LD Recipe node.

    Some sites annotate ingredient sections using ``@type: HowToSection`` inside
    ``recipeIngredient`` or embed groups as separate schema objects.  We also look
    for a top-level list of named sections.
    """
    groups: list[ImportIngredientGroup] = []
    raw = data.get("recipeIngredient")

    # Case 1: recipeIngredient is a list of HowToSection / ItemList objects
    if isinstance(raw, list):
        for item in raw:
            if isinstance(item, dict) and item.get("@type") in ("HowToSection", "ItemList"):
                name = _clean_text(item.get("name", "Zutaten"))
                items = item.get("itemListElement") or item.get("recipeIngredient") or []
                ing_list = []
                for el in items:
                    if isinstance(el, str):
                        ing_list.append(_clean_text(el))
                    elif isinstance(el, dict):
                        ing_list.append(_clean_text(el.get("text") or el.get("name") or ""))
                if ing_list:
                    groups.append(ImportIngredientGroup(name=name, ingredients=ing_list))

    return groups


def scrape_url(url: str, check_ssrf: bool = True) -> ImportResult:
    """Scrape a recipe website and extract structured data."""
    if check_ssrf:
        _validate_url(url)
    else:
        # Even without full SSRF protection, still require http/https.
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            raise ValueError("Only http/https URLs are allowed")
    with requests.Session() as session:
        session.headers.update(
            {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
                "Accept-Encoding": "gzip, deflate, br",
                "DNT": "1",
            }
        )
        resp = session.get(url, timeout=15)
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
    ingredient_groups: list[ImportIngredientGroup] = []
    steps: list[str] = []
    tags: list[str] = []
    prep_time: Optional[int] = None
    cook_time: Optional[int] = None
    servings: Optional[int] = None

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
                raw_ings = data["recipeIngredient"]
                # Try to extract groups first
                groups = _extract_ingredient_groups_from_jsonld(data)
                if groups:
                    ingredient_groups = groups
                else:
                    # Flat list
                    ingredients = [
                        _clean_text(i) for i in raw_ings if isinstance(i, str)
                    ]

            if data.get("recipeInstructions"):
                raw = data["recipeInstructions"]
                if isinstance(raw, list):
                    for item in raw:
                        if isinstance(item, str):
                            steps.append(_clean_text(item))
                        elif isinstance(item, dict):
                            item_type = item.get("@type", "")
                            if item_type == "HowToSection":
                                # Grouped steps – flatten for now
                                for sub in item.get("itemListElement", []):
                                    if isinstance(sub, str):
                                        steps.append(_clean_text(sub))
                                    elif isinstance(sub, dict):
                                        steps.append(_clean_text(sub.get("text", "")))
                            else:
                                steps.append(_clean_text(item.get("text", "")))
                elif isinstance(raw, str):
                    steps = [_clean_text(s) for s in raw.split("\n") if s.strip()]

            if data.get("keywords"):
                kw = data["keywords"]
                tags = [t.strip() for t in (kw.split(",") if isinstance(kw, str) else kw)]
            if data.get("name") and not title:
                title = _clean_text(data["name"])

            # Timing fields
            if data.get("prepTime"):
                prep_time = _parse_duration_iso(data["prepTime"])
            if data.get("cookTime"):
                cook_time = _parse_duration_iso(data["cookTime"])
            if data.get("recipeYield"):
                raw_yield = data["recipeYield"]
                if isinstance(raw_yield, list):
                    raw_yield = raw_yield[0] if raw_yield else ""
                m = re.search(r"\d+", str(raw_yield))
                if m:
                    servings = int(m.group())
        except Exception:
            pass

    # Fallback: heuristic text extraction
    if not ingredients and not ingredient_groups:
        text_lines = [line for line in soup.get_text(separator="\n").splitlines() if line.strip()]
        ingredients = _detect_ingredients(text_lines)[:20]
    if not steps:
        text_lines = [line for line in soup.get_text(separator="\n").splitlines() if line.strip()]
        steps = _detect_steps(text_lines)[:15]

    return ImportResult(
        title=title,
        description=description,
        image_url=image_url,
        source_url=url,
        ingredients=ingredients,
        ingredient_groups=ingredient_groups,
        steps=steps,
        tags=tags,
        prep_time=prep_time,
        cook_time=cook_time,
        servings=servings,
    )

