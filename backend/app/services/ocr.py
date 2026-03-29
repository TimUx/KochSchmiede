import io
import re
from pathlib import Path
from typing import Optional

from PIL import Image

from app.schemas import ImportResult

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
    steps: list[str] = []

    amount_re = re.compile(
        r"(\d+[\.,]?\d*\s*(g|kg|ml|l|cl|tl|el|tbsp|tsp|cup|oz|lb|prise|stk|stück)?)",
        re.IGNORECASE,
    )
    step_re = re.compile(r"^(\d+[\.\):]?\s+)", re.IGNORECASE)

    in_ingredients = False
    in_steps = False

    ingredients_headers = {"zutaten", "ingredients", "zutat", "ingredient"}
    steps_headers = {"zubereitung", "anleitung", "instructions", "steps", "preparation", "method"}

    for line in lines:
        lower = line.lower().rstrip(":").strip()

        if lower in ingredients_headers:
            in_ingredients = True
            in_steps = False
            continue
        if lower in steps_headers:
            in_steps = True
            in_ingredients = False
            continue

        if not title and len(line) > 3 and not amount_re.search(line):
            title = line
            continue

        if in_ingredients:
            if step_re.match(line) or len(line) > 80:
                in_steps = True
                in_ingredients = False
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

    return ImportResult(
        title=title or "Importiertes Rezept",
        ingredients=ingredients[:30],
        steps=steps[:20],
    )


def ocr_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> ImportResult:
    """Run OCR on an image and extract recipe data."""
    if not OCR_AVAILABLE:
        return ImportResult(title="OCR nicht verfügbar", ingredients=[], steps=[])

    image = Image.open(io.BytesIO(image_bytes))
    # Convert to grayscale for better OCR
    image = image.convert("L")
    text = pytesseract.image_to_string(image, lang="deu+eng")
    return _parse_ocr_text(text)


def ocr_pdf(pdf_bytes: bytes) -> ImportResult:
    """Extract text from PDF (with optional OCR fallback)."""
    if PDF_AVAILABLE:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        full_text = ""
        for page in doc:
            full_text += page.get_text()
        if full_text.strip():
            return _parse_ocr_text(full_text)
        # If no text layer, render and OCR
        if OCR_AVAILABLE:
            images_text = []
            for page in doc:
                pix = page.get_pixmap(dpi=150)
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                img = img.convert("L")
                images_text.append(pytesseract.image_to_string(img, lang="deu+eng"))
            return _parse_ocr_text("\n".join(images_text))

    # Fallback: try to use pytesseract directly on first page rendered as image
    if OCR_AVAILABLE:
        try:
            from pdf2image import convert_from_bytes

            pages = convert_from_bytes(pdf_bytes, dpi=150)
            text = pytesseract.image_to_string(pages[0].convert("L"), lang="deu+eng")
            return _parse_ocr_text(text)
        except ImportError:
            pass

    return ImportResult(title="PDF Import nicht vollständig verfügbar", ingredients=[], steps=[])
