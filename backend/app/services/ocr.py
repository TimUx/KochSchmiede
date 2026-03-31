import io
import logging
import re
import uuid
from pathlib import Path
from typing import Optional

from PIL import Image

from app.schemas import ImportIngredientGroup, ImportResult

logger = logging.getLogger(__name__)

try:
    import pytesseract

    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False

try:
    import fitz  # PyMuPDF

    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False

_IMPORT_UPLOAD_DIR = Path("/app/uploads/imported")


def _clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _parse_ocr_text(text: str) -> ImportResult:
    """Parse raw OCR / PDF text into structured recipe data using heuristics."""
    # Preserve blank lines so they can serve as paragraph separators in the
    # steps section; only strip leading/trailing whitespace per line.
    raw_lines = [l.strip() for l in text.splitlines()]

    title: Optional[str] = None
    ingredients: list[str] = []
    ingredient_groups: list[ImportIngredientGroup] = []
    steps: list[str] = []
    prep_time: Optional[int] = None
    cook_time: Optional[int] = None
    servings: Optional[int] = None

    amount_re = re.compile(
        r"(\d+[\.,]?\d*\s*(g|kg|ml|l|cl|tl|el|tbsp|tsp|cup|oz|lb|prise|stk|stück)?)",
        re.IGNORECASE,
    )
    step_re = re.compile(r"^(\d{1,3}[\.\):]\s+|schritt\s+\d+|step\s+\d+)", re.IGNORECASE)

    # Ingredient sub-group headers.
    # Matches both short forms ("Für den Teig:", "Füllung:") and the longer
    # Chefkoch single-page form ("Zutaten für den Teig:", "Zutaten für die Sauce:").
    # \w[^.!?]{1,34} requires at least 2 chars after the article, preventing
    # bare "Für den" from matching; also prevents matching full sentences that
    # end with .!? because [^.!?] won't consume those characters.
    group_header_re = re.compile(
        r"^(?:"
        r"zutaten\s+für\s+(?:den|die|das)\s+\w[^.!?]{1,34}"  # "Zutaten für den Teig"
        r"|für\s+\w[^.!?]{1,34}"                              # "Für den Teig"
        r"|for\s+the\s+\w[^.!?]{1,24}"                        # "For the dough"
        r"|teig|soße|sauce|füllung|topping|dressing|marinade"
        r"|glasur|belag|kruste|suppe|brühe|fond|garnierung|creme|sirup"
        r")[\s:]*$",
        re.IGNORECASE,
    )

    # Boilerplate lines common in printed/exported recipe PDFs.
    # "gesamtzeit" has no trailing \b so it also matches "Gesamtzeitca." (PDF
    # formatting where no space appears between the keyword and "ca.").
    noise_re = re.compile(
        r"^(?:chefkoch|rezept\s+online\b|aufrufen\b|rezept\s+von\b|schwierigkeitsgrad\b"
        r"|gesamtzeit|portionsgröße\b|kalorien\b|nährwert|foto[:\s]).*$",
        re.IGNORECASE,
    )

    # Timing patterns.
    # Use [\s:]* (zero-or-more) instead of [\s:]+ so that PDFs where the
    # keyword is immediately followed by "ca." without a space are also
    # matched, e.g. "Arbeitszeitca. 35 Minuten" or "Koch-/Backzeitca. 20 Min".
    arbeitszeit_re = re.compile(
        r"\barbeitszeit[\s:]*(?:ca\.?\s*)?(\d+)\s*min", re.IGNORECASE
    )
    kochzeit_re = re.compile(
        r"\b(?:koch|back)[-/\w]*zeit[\s:]*(?:ca\.?\s*)?(\d+)\s*min", re.IGNORECASE
    )

    # Patterns for standalone timing-keyword lines whose value appears on the
    # *next* line, e.g. "Arbeitszeit\nca. 35 Minuten".
    arbeitszeit_keyword_re = re.compile(r"^arbeitszeit\s*$", re.IGNORECASE)
    kochzeit_keyword_re = re.compile(r"^(?:koch|back)[-/\w]*zeit\s*$", re.IGNORECASE)
    time_value_re = re.compile(r"(?:ca\.?\s*)?(\d+)\s*min", re.IGNORECASE)

    in_ingredients = False
    in_steps = False
    current_group: Optional[dict] = None  # {"name": str, "ingredients": list[str]}
    # Lines within the current step paragraph; flushed as one step on blank line.
    step_buffer: list[str] = []
    # Flags set when a timing keyword appears alone; the value is expected on
    # the very next non-blank line.
    pending_prep_time = False
    pending_cook_time = False

    ingredients_headers = {"zutaten", "ingredients", "zutat", "ingredient"}
    steps_headers = {"zubereitung", "anleitung", "instructions", "steps", "preparation", "method"}

    def _flush_step_buffer() -> None:
        nonlocal step_buffer
        if not step_buffer:
            return
        cleaned_parts = []
        for buf_line in step_buffer:
            # Skip lines that are just standalone step-number markers ("1", "2", …)
            if re.match(r"^\d+$", buf_line):
                continue
            # Strip standard numbered-step prefix ("1.", "1)", "1:", "1 ")
            cleaned = re.sub(r"^\d+[\.\):\s]+", "", buf_line).strip()
            if cleaned:
                cleaned_parts.append(cleaned)
        combined = " ".join(cleaned_parts).strip()
        if combined:
            steps.append(combined)
        step_buffer = []

    def _flush_current_group() -> None:
        nonlocal current_group
        if current_group is not None:
            ingredient_groups.append(
                ImportIngredientGroup(
                    name=current_group["name"],
                    ingredients=current_group["ingredients"][:30],
                )
            )
            current_group = None

    for line in raw_lines:
        # ── Blank line: paragraph separator ──────────────────────────────────
        if not line:
            if in_steps:
                _flush_step_buffer()
            pending_prep_time = False
            pending_cook_time = False
            continue

        lower = line.lower().rstrip(":").strip()

        # ── Consume the value line that follows a standalone timing keyword ───
        if pending_prep_time:
            pending_prep_time = False
            m = time_value_re.search(line)
            if m and prep_time is None:
                prep_time = int(m.group(1))
                continue
        if pending_cook_time:
            pending_cook_time = False
            m = time_value_re.search(line)
            if m and cook_time is None:
                cook_time = int(m.group(1))
                continue

        # ── Skip known noise / boilerplate ───────────────────────────────────
        if noise_re.match(line):
            continue

        # ── Extract timing metadata (valid anywhere in the document) ─────────
        if prep_time is None:
            m = arbeitszeit_re.search(line)
            if m:
                prep_time = int(m.group(1))
                continue
        if cook_time is None:
            m = kochzeit_re.search(line)
            if m:
                cook_time = int(m.group(1))
                continue

        # ── Standalone timing keyword (value on the next line) ────────────────
        if prep_time is None and arbeitszeit_keyword_re.match(line):
            pending_prep_time = True
            continue
        if cook_time is None and kochzeit_keyword_re.match(line):
            pending_cook_time = True
            continue

        # ── Ingredient group headers (checked BEFORE the generic section header
        #    so "Zutaten für den Teig:" is treated as a named group, not merely
        #    as a second "Zutaten" section restart) ────────────────────────────
        if group_header_re.match(line):
            _flush_step_buffer()
            in_ingredients = True
            in_steps = False
            _flush_current_group()
            current_group = {"name": line.rstrip(":").strip(), "ingredients": []}
            continue

        # ── Section: Ingredients ─────────────────────────────────────────────
        # "Zutaten für N Portionen" starts the section AND carries servings.
        # Plain "Zutaten" (and exact English equivalents) also starts the section.
        if lower in ingredients_headers or lower.startswith("zutaten"):
            if servings is None:
                m = re.search(
                    r"zutaten\s+für\s+(\d+)\s*(?:portion|person|stück|serving)",
                    line,
                    re.IGNORECASE,
                )
                if m:
                    servings = int(m.group(1))
            _flush_step_buffer()
            in_ingredients = True
            in_steps = False
            continue

        # ── Section: Steps / Preparation ─────────────────────────────────────
        if lower in steps_headers:
            _flush_current_group()
            _flush_step_buffer()
            in_steps = True
            in_ingredients = False
            continue

        # ── Title: first meaningful non-boilerplate, non-amount line ─────────
        if not title and len(line) > 3 and not amount_re.search(line) and not line.isupper():
            title = line
            continue

        # ── Ingredient section content ────────────────────────────────────────
        if in_ingredients:
            # Short lines starting with a lowercase letter are recipe taglines
            # or descriptions that slipped into the ingredient section (common
            # in single-page PDFs with multi-column layouts) – discard them.
            # German ingredient names always start with an uppercase letter.
            if line and line[0].islower() and len(line) <= 50:
                continue

            # If the recipe title reappears inside the ingredient section (a
            # common PDF layout artefact) skip it rather than adding it as an
            # ingredient.
            if title and line.lower() == title.lower():
                continue

            # Transition to steps when:
            # - A numbered step line (e.g. "1. Mix flour")
            # - A longer prose line (> 50 chars) typical of step instructions
            # - A sentence-continuation line that starts with a lowercase letter
            #   (len > 50; shorter lowercase lines are already discarded above)
            is_step_transition = (
                step_re.match(line)
                or len(line) > 50
                or (line and line[0].islower())
            )
            if is_step_transition:
                # Transition to steps; fall through to the steps block below.
                _flush_current_group()
                in_steps = True
                in_ingredients = False
            else:
                if current_group is not None:
                    current_group["ingredients"].append(line)
                else:
                    ingredients.append(line)
                continue

        # ── Steps content ─────────────────────────────────────────────────────
        if in_steps:
            step_buffer.append(line)
            continue

        # ── Fallback heuristics (unclassified lines) ──────────────────────────
        if amount_re.search(line) and len(line) < 80:
            ingredients.append(line)
        elif step_re.match(line) or len(line) > 50:
            steps.append(re.sub(r"^\d+[\.\):\s]+", "", line).strip())

    # Flush any remaining step paragraph and last open ingredient group.
    _flush_step_buffer()
    _flush_current_group()

    return ImportResult(
        title=title or "Importiertes Rezept",
        ingredients=ingredients[:30],
        ingredient_groups=ingredient_groups,
        steps=steps[:20],
        prep_time=prep_time,
        cook_time=cook_time,
        servings=servings,
    )


def _extract_best_pdf_image(doc: "fitz.Document") -> Optional[bytes]:  # type: ignore[name-defined]
    """Return raw bytes of the largest embedded image in the PDF document.

    Tiny images (icons, decorations) are skipped.  Returns ``None`` when no
    suitable image is found.
    """
    best_area = 0
    best_bytes: Optional[bytes] = None

    for page in doc:
        for img_info in page.get_images(full=True):
            xref = img_info[0]
            width = img_info[2]
            height = img_info[3]
            area = width * height
            if area < 100 * 100:  # skip very small images (icons, separators)
                continue
            try:
                base = doc.extract_image(xref)
                raw = base["image"]
                if area > best_area:
                    best_area = area
                    best_bytes = raw
            except Exception:
                logger.debug("Could not extract image xref=%d from PDF", xref, exc_info=True)
                continue

    return best_bytes


def _save_imported_image(img_bytes: bytes) -> Optional[str]:
    """Save raw image bytes as a JPEG in the uploads directory.

    Returns the URL path (``/api/uploads/imported/<name>.jpg``) or ``None``
    if saving fails.
    """
    try:
        _IMPORT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        img = Image.open(io.BytesIO(img_bytes))
        img = img.convert("RGB")
        filename = f"{uuid.uuid4().hex}.jpg"
        dest = _IMPORT_UPLOAD_DIR / filename
        img.save(dest, "JPEG", quality=85)
        return f"/api/uploads/imported/{filename}"
    except Exception:
        logger.warning("Failed to save imported PDF image", exc_info=True)
        return None


def extract_image_text(image_bytes: bytes, handwriting: bool = False) -> str:
    """Extract raw text from an image using Tesseract OCR.

    Returns an empty string when OCR is not available.
    """
    if not OCR_AVAILABLE:
        return ""

    from PIL import ImageEnhance, ImageFilter

    image = Image.open(io.BytesIO(image_bytes))
    image = image.convert("L")

    if handwriting:
        image = ImageEnhance.Contrast(image).enhance(2.0)
        image = image.filter(ImageFilter.SHARPEN)
        tesseract_config = "--oem 1 --psm 6"
    else:
        tesseract_config = "--oem 3 --psm 3"

    return pytesseract.image_to_string(image, lang="deu+eng", config=tesseract_config)


def _extract_text_via_pdf2image(pdf_bytes: bytes, handwriting: bool = False) -> str:
    """Fallback text extraction using pdf2image + Tesseract when PyMuPDF is unavailable."""
    if not OCR_AVAILABLE:
        return ""
    try:
        from pdf2image import convert_from_bytes

        pages = convert_from_bytes(pdf_bytes, dpi=150)
        parts: list[str] = []
        for page_img in pages:
            img = page_img.convert("L")
            if handwriting:
                from PIL import ImageEnhance, ImageFilter

                img = ImageEnhance.Contrast(img).enhance(2.0)
                img = img.filter(ImageFilter.SHARPEN)
                cfg = "--oem 1 --psm 6"
            else:
                cfg = "--oem 3 --psm 3"
            parts.append(pytesseract.image_to_string(img, lang="deu+eng", config=cfg))
        return "\n".join(parts)
    except ImportError:
        return ""


def extract_pdf_text_and_image(
    pdf_bytes: bytes, handwriting: bool = False
) -> tuple[str, Optional[str]]:
    """Extract raw text and the largest embedded image from a PDF.

    Returns ``(raw_text, image_url_or_None)``.  This is the low-level
    extraction step; *parsing* is handled separately so callers can choose
    between AI and heuristic parsers.

    Falls back to pdf2image + Tesseract when PyMuPDF is unavailable.
    """
    if not PDF_AVAILABLE:
        return _extract_text_via_pdf2image(pdf_bytes, handwriting), None

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    full_text = ""
    for page in doc:
        full_text += page.get_text()

    if not full_text.strip():
        # Image-based PDF – render each page and OCR
        if OCR_AVAILABLE:
            parts: list[str] = []
            for page in doc:
                pix = page.get_pixmap(dpi=150)
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                img = img.convert("L")
                if handwriting:
                    from PIL import ImageEnhance, ImageFilter

                    img = ImageEnhance.Contrast(img).enhance(2.0)
                    img = img.filter(ImageFilter.SHARPEN)
                    cfg = "--oem 1 --psm 6"
                else:
                    cfg = "--oem 3 --psm 3"
                parts.append(pytesseract.image_to_string(img, lang="deu+eng", config=cfg))
            full_text = "\n".join(parts)
        else:
            full_text = _extract_text_via_pdf2image(pdf_bytes, handwriting)

    # Extract the best embedded food photo from the PDF
    image_url: Optional[str] = None
    img_bytes = _extract_best_pdf_image(doc)
    if img_bytes:
        image_url = _save_imported_image(img_bytes)

    return full_text, image_url


def render_pdf_first_page(pdf_bytes: bytes, dpi: int = 150) -> Optional[bytes]:
    """Render the first page of a PDF to a JPEG image for vision AI.

    Returns raw JPEG bytes or ``None`` when PyMuPDF is unavailable or fails.
    This allows vision AI to parse PDFs with complex layouts (tables,
    multi-column, etc.) directly from the image instead of extracted text.
    """
    if not PDF_AVAILABLE:
        return None
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if not doc.page_count:
            return None
        pix = doc[0].get_pixmap(dpi=dpi)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=90)
        return buf.getvalue()
    except Exception:
        logger.debug("render_pdf_first_page failed", exc_info=True)
        return None


# Public alias so callers outside this module can use the heuristic parser
# directly (e.g. imports.py fallback path).
parse_ocr_text = _parse_ocr_text


def ocr_image(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    handwriting: bool = False,
) -> ImportResult:
    """Run OCR on an image and parse with the heuristic parser.

    Kept for backward compatibility.  New callers should prefer
    ``extract_image_text`` + ``parse_ocr_text`` so they can inject AI
    parsing between the two steps.
    """
    if not OCR_AVAILABLE:
        return ImportResult(title="OCR nicht verfügbar", ingredients=[], steps=[])
    raw_text = extract_image_text(image_bytes, handwriting)
    return _parse_ocr_text(raw_text)


def ocr_pdf(pdf_bytes: bytes, handwriting: bool = False) -> ImportResult:
    """Extract text from a PDF and parse with the heuristic parser.

    Kept for backward compatibility.  New callers should prefer
    ``extract_pdf_text_and_image`` + ``parse_ocr_text`` so they can inject
    AI parsing between the two steps.
    """
    raw_text, image_url = extract_pdf_text_and_image(pdf_bytes, handwriting)
    if not raw_text.strip():
        return ImportResult(
            title="PDF Import nicht vollständig verfügbar", ingredients=[], steps=[]
        )
    result = _parse_ocr_text(raw_text)
    if image_url and not result.image_url:
        result.image_url = image_url
    return result


def merge_import_results(results: list[ImportResult]) -> ImportResult:
    """Merge multiple ImportResult objects for multi-page / multi-file recipes."""
    if not results:
        return ImportResult(title="Importiertes Rezept")
    if len(results) == 1:
        return results[0]

    # Use the first non-placeholder title
    title = next(
        (r.title for r in results if r.title and r.title != "Importiertes Rezept"),
        None,
    ) or "Importiertes Rezept"

    # Use the first non-None value found across all pages for metadata
    image_url = next((r.image_url for r in results if r.image_url), None)
    prep_time = next((r.prep_time for r in results if r.prep_time is not None), None)
    cook_time = next((r.cook_time for r in results if r.cook_time is not None), None)
    servings = next((r.servings for r in results if r.servings is not None), None)

    # Combine ingredients (deduplicate)
    seen: set[str] = set()
    ingredients: list[str] = []
    for r in results:
        for ing in r.ingredients:
            if ing not in seen:
                seen.add(ing)
                ingredients.append(ing)

    # Combine ingredient groups (all groups from all pages)
    ingredient_groups: list[ImportIngredientGroup] = []
    for r in results:
        ingredient_groups.extend(r.ingredient_groups)

    # Combine steps in order
    steps: list[str] = []
    for r in results:
        steps.extend(r.steps)

    tags = list({tag for r in results for tag in r.tags})

    return ImportResult(
        title=title,
        image_url=image_url,
        ingredients=ingredients[:50],
        ingredient_groups=ingredient_groups,
        steps=steps[:30],
        tags=tags,
        prep_time=prep_time,
        cook_time=cook_time,
        servings=servings,
    )

