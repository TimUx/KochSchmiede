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
    """Parse raw OCR text into structured recipe data using heuristics."""
    lines = [l.strip() for l in text.splitlines() if l.strip()]

    title: Optional[str] = None
    ingredients: list[str] = []
    ingredient_groups: list[ImportIngredientGroup] = []
    steps: list[str] = []

    amount_re = re.compile(
        r"(\d+[\.,]?\d*\s*(g|kg|ml|l|cl|tl|el|tbsp|tsp|cup|oz|lb|prise|stk|stück)?)",
        re.IGNORECASE,
    )
    step_re = re.compile(r"^(\d+[\.\):]?\s+)", re.IGNORECASE)

    # Pattern for ingredient sub-group headers, e.g. "Für den Teig:", "Soße:", "Marinade"
    group_header_re = re.compile(
        r"^(für\s+\w.*|for\s+the\s+\w.*|teig|soße|sauce|füllung|topping|dressing|marinade"
        r"|glasur|belag|kruste|suppe|brühe|fond|garnierung|creme|sirup)[\s:]*$",
        re.IGNORECASE,
    )

    in_ingredients = False
    in_steps = False
    current_group: Optional[dict] = None  # {"name": str, "ingredients": list[str]}

    ingredients_headers = {"zutaten", "ingredients", "zutat", "ingredient"}
    steps_headers = {"zubereitung", "anleitung", "instructions", "steps", "preparation", "method"}

    for line in lines:
        lower = line.lower().rstrip(":").strip()

        if lower in ingredients_headers:
            in_ingredients = True
            in_steps = False
            # Don't reset current_group – might be a sub-header follows
            continue
        if lower in steps_headers:
            # Save any open ingredient group
            if current_group is not None:
                ingredient_groups.append(
                    ImportIngredientGroup(
                        name=current_group["name"],
                        ingredients=current_group["ingredients"][:30],
                    )
                )
                current_group = None
            in_steps = True
            in_ingredients = False
            continue

        if not title and len(line) > 3 and not amount_re.search(line):
            title = line
            continue

        if in_ingredients:
            # Detect ingredient group sub-headers
            if group_header_re.match(line):
                if current_group is not None:
                    ingredient_groups.append(
                        ImportIngredientGroup(
                            name=current_group["name"],
                            ingredients=current_group["ingredients"][:30],
                        )
                    )
                current_group = {"name": line.rstrip(":").strip(), "ingredients": []}
                continue

            if step_re.match(line) or len(line) > 80:
                # Transition to steps
                if current_group is not None:
                    ingredient_groups.append(
                        ImportIngredientGroup(
                            name=current_group["name"],
                            ingredients=current_group["ingredients"][:30],
                        )
                    )
                    current_group = None
                in_steps = True
                in_ingredients = False
            else:
                if current_group is not None:
                    current_group["ingredients"].append(line)
                else:
                    ingredients.append(line)
                continue

        if in_steps:
            cleaned = re.sub(r"^\d+[\.\):\s]+", "", line).strip()
            if cleaned:
                steps.append(cleaned)
            continue

        # fallback heuristics
        if amount_re.search(line) and len(line) < 80:
            ingredients.append(line)
        elif step_re.match(line) or len(line) > 50:
            steps.append(re.sub(r"^\d+[\.\):\s]+", "", line).strip())

    # Save last open group
    if current_group is not None:
        ingredient_groups.append(
            ImportIngredientGroup(
                name=current_group["name"],
                ingredients=current_group["ingredients"][:30],
            )
        )

    return ImportResult(
        title=title or "Importiertes Rezept",
        ingredients=ingredients[:30],
        ingredient_groups=ingredient_groups,
        steps=steps[:20],
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
    )

