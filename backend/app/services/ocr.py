import io
import re
from pathlib import Path
from typing import Optional

from PIL import Image

from app.schemas import ImportIngredientGroup, ImportResult

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


def _clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _parse_ocr_text(text: str) -> ImportResult:
    """Parse raw OCR / PDF text into structured recipe data using heuristics."""
    lines = [l.strip() for l in text.splitlines() if l.strip()]

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
    noise_re = re.compile(
        r"^(?:chefkoch|rezept\s+online\b|aufrufen\b|rezept\s+von\b|schwierigkeitsgrad\b"
        r"|gesamtzeit\b|portionsgröße\b|kalorien\b|nährwert|foto[:\s]).*$",
        re.IGNORECASE,
    )

    # Timing patterns.
    # arbeitszeit_re: "Arbeitszeit ca. 35 Minuten", "Arbeitszeit: 35 min"
    # kochzeit_re: "Koch-/Backzeit ca. 20 Minuten", "Kochzeit: 15 min"
    # Requiring *zeit* in the matched word prevents false positives from step
    # instructions like "im Backofen ca. 20 Minuten backen".
    arbeitszeit_re = re.compile(
        r"\barbeitszeit\b[\s:]+(?:ca\.?\s+)?(\d+)\s*min", re.IGNORECASE
    )
    kochzeit_re = re.compile(
        r"\b(?:koch|back)[-/\w]*zeit\b[\s:]+(?:ca\.?\s+)?(\d+)\s*min", re.IGNORECASE
    )

    in_ingredients = False
    in_steps = False
    current_group: Optional[dict] = None  # {"name": str, "ingredients": list[str]}

    ingredients_headers = {"zutaten", "ingredients", "zutat", "ingredient"}
    steps_headers = {"zubereitung", "anleitung", "instructions", "steps", "preparation", "method"}

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

    for line in lines:
        lower = line.lower().rstrip(":").strip()

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

        # ── Ingredient group headers (checked BEFORE the generic section header
        #    so "Zutaten für den Teig:" is treated as a named group, not merely
        #    as a second "Zutaten" section restart) ────────────────────────────
        if group_header_re.match(line):
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
            in_ingredients = True
            in_steps = False
            continue

        # ── Section: Steps / Preparation ─────────────────────────────────────
        if lower in steps_headers:
            _flush_current_group()
            in_steps = True
            in_ingredients = False
            continue

        # ── Title: first meaningful non-boilerplate, non-amount line ─────────
        if not title and len(line) > 3 and not amount_re.search(line) and not line.isupper():
            title = line
            continue

        # ── Ingredient section content ────────────────────────────────────────
        if in_ingredients:
            if step_re.match(line) or len(line) > 80:
                # Long / numbered line → transition to steps.
                _flush_current_group()
                in_steps = True
                in_ingredients = False
                # Fall through so this line is also handled by the steps block.
            else:
                if current_group is not None:
                    current_group["ingredients"].append(line)
                else:
                    ingredients.append(line)
                continue

        # ── Steps content ─────────────────────────────────────────────────────
        if in_steps:
            cleaned = re.sub(r"^\d+[\.\):\s]+", "", line).strip()
            if cleaned:
                steps.append(cleaned)
            continue

        # ── Fallback heuristics (unclassified lines) ──────────────────────────
        if amount_re.search(line) and len(line) < 80:
            ingredients.append(line)
        elif step_re.match(line) or len(line) > 50:
            steps.append(re.sub(r"^\d+[\.\):\s]+", "", line).strip())

    # Save last open group
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


def ocr_image(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    handwriting: bool = False,
) -> ImportResult:
    """Run OCR on an image and extract recipe data.

    Parameters
    ----------
    handwriting:
        When True, applies contrast/sharpening preprocessing and uses
        Tesseract's LSTM-only engine with column-aware page segmentation,
        which works better for handwritten recipe pages.
    """
    if not OCR_AVAILABLE:
        return ImportResult(title="OCR nicht verfügbar", ingredients=[], steps=[])

    from PIL import ImageEnhance, ImageFilter

    image = Image.open(io.BytesIO(image_bytes))
    # Convert to grayscale for better OCR accuracy
    image = image.convert("L")

    if handwriting:
        # Enhance contrast and sharpen to help LSTM neural net read handwriting
        image = ImageEnhance.Contrast(image).enhance(2.0)
        image = image.filter(ImageFilter.SHARPEN)
        # OEM 1 = LSTM only; PSM 6 = assume uniform block of text (good for handwriting)
        tesseract_config = "--oem 1 --psm 6"
    else:
        # OEM 3 = default (LSTM + legacy); PSM 3 = fully automatic page segmentation
        tesseract_config = "--oem 3 --psm 3"

    text = pytesseract.image_to_string(image, lang="deu+eng", config=tesseract_config)
    return _parse_ocr_text(text)


def ocr_pdf(pdf_bytes: bytes, handwriting: bool = False) -> ImportResult:
    """Extract text from PDF (with optional OCR fallback for image-based or handwritten PDFs)."""
    if PDF_AVAILABLE:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        full_text = ""
        for page in doc:
            full_text += page.get_text()
        if full_text.strip():
            return _parse_ocr_text(full_text)
        # No text layer – render every page and OCR
        if OCR_AVAILABLE:
            pages_text: list[str] = []
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
                pages_text.append(pytesseract.image_to_string(img, lang="deu+eng", config=cfg))
            return _parse_ocr_text("\n".join(pages_text))

    # Fallback: try pdf2image + pytesseract (processes ALL pages)
    if OCR_AVAILABLE:
        try:
            from pdf2image import convert_from_bytes

            pages = convert_from_bytes(pdf_bytes, dpi=150)
            pages_text = []
            for page_img in pages:
                img = page_img.convert("L")
                if handwriting:
                    from PIL import ImageEnhance, ImageFilter

                    img = ImageEnhance.Contrast(img).enhance(2.0)
                    img = img.filter(ImageFilter.SHARPEN)
                    cfg = "--oem 1 --psm 6"
                else:
                    cfg = "--oem 3 --psm 3"
                pages_text.append(pytesseract.image_to_string(img, lang="deu+eng", config=cfg))
            return _parse_ocr_text("\n".join(pages_text))
        except ImportError:
            pass

    return ImportResult(title="PDF Import nicht vollständig verfügbar", ingredients=[], steps=[])


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
        ingredients=ingredients[:50],
        ingredient_groups=ingredient_groups,
        steps=steps[:30],
        tags=tags,
        prep_time=prep_time,
        cook_time=cook_time,
        servings=servings,
    )

