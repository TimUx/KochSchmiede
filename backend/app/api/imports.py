"""Recipe import endpoints.

Parsing priority for every file / camera import
------------------------------------------------
The pipeline automatically chooses the most efficient strategy based on
the document type and content quality:

1. **Clean PDF with extractable text** → text AI (fast, resource-efficient)
   → heuristic fallback.

2. **Image with good OCR quality** (score ≥ 0.4, recipe keywords present,
   low noise) → text AI on Tesseract output → heuristic fallback.

3. **Complex image** (poor OCR quality: magazine scans, handwriting,
   multi-column layouts with ads) → vision AI first → text AI on OCR as
   fallback → heuristic.

Model selection is fully automatic:
- The pipeline queries Ollama for all available models and picks the
  fastest/smallest text model and the best available vision model.
- Set ``LLM_MODEL=<name>`` in ``.env`` to lock a specific model (e.g. for
  LM Studio where only one model is loaded).
- Models are auto-pulled from Ollama on first use when none are present
  (controlled by ``OLLAMA_AUTO_PULL``, default ``true``).
"""

import logging

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import ImportResult
from app.services.ai_parser import (
    has_vision_ai,
    parse_image_with_ai,
    parse_with_ai,
)
from app.services.ocr import (
    extract_image_text,
    extract_pdf_text_and_image,
    merge_import_results,
    parse_ocr_text,
    render_pdf_first_page,
)
from app.services.scraper import scrape_url
from app.services.settings import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/import", tags=["import"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/tiff", "image/heic", "image/heif"}
ALLOWED_PDF_TYPE = "application/pdf"
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

# OCR quality threshold for smart routing.
# Score ≥ this value → OCR text is clean enough for a fast text-only LLM pass.
# Score < this value → try vision model first (higher quality for complex images).
#
# The default of 0.60 is intentionally conservative: only clearly structured
# recipe text (clean PDFs, Chefkoch screenshots) takes the fast path; anything
# ambiguous (scanned magazines, handwriting, multi-column layouts) is routed to
# vision.  Lower this value (e.g. to 0.40) to prefer the text path more often
# and save vision model resources at the cost of lower accuracy on complex inputs.
# Raise it (e.g. to 0.80) to route almost everything through vision.
_OCR_QUALITY_THRESHOLD = 0.60


def _is_pdf(file: UploadFile) -> bool:
    return (file.content_type or "") == ALLOWED_PDF_TYPE or (
        file.filename or ""
    ).lower().endswith(".pdf")


def _is_image(file: UploadFile) -> bool:
    return (file.content_type or "") in ALLOWED_IMAGE_TYPES or any(
        (file.filename or "").lower().endswith(ext)
        for ext in (".jpg", ".jpeg", ".png", ".webp", ".tiff", ".heic", ".heif")
    )


def _assess_ocr_quality(text: str) -> float:
    """Return a 0.0–1.0 quality score for OCR output.

    Combines text-level heuristics with a fast heuristic parse of the text
    to detect garbled, column-merged, or ad-polluted OCR output.

    A **high score** (≥ threshold) means the text is clean and structured
    enough for a fast text-only LLM pass.

    A **low score** (< threshold) indicates garbled output — magazine
    two-column merges, ad text, heavily fragmented lines — where a vision
    model would do better.

    Scoring components:
    - Heuristic parse quality (completeness of extracted recipe data): 0.50
    - Column-merge artifact detection (low = more artifacts):          0.25
    - Noise character ratio:                                           0.15
    - Mostly-uppercase line ratio (ad/brand text):                     0.10
    """
    import re

    if not text.strip():
        return 0.0

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if not lines:
        return 0.0

    # ── Component 1: heuristic parse completeness (0.0–0.50) ─────────────────
    # Run parse_ocr_text (pure regex, sub-millisecond) and assess how much
    # valid recipe content was extracted.
    parse_score = 0.0
    try:
        from app.services.ocr import parse_ocr_text as _parse

        r = _parse(text)
        total_ingr = len(r.ingredients) + sum(len(g.ingredients) for g in r.ingredient_groups)

        # Title heuristics: reject ad/magazine slogans
        title = r.title or ""
        has_real_title = (
            bool(title)
            and title != "Importiertes Rezept"
            and len(title) > 5
            # Titles ending with conjunctions/prepositions are slogans not recipe names
            and not re.search(r"\bund$|\boder$|\bfür$|\bsowie$", title, re.IGNORECASE)
            # Reject magazine headline patterns
            and not re.search(r"\bRezepten?\b|\bmehr gibt\b|\bOstern\b", title, re.IGNORECASE)
            and not re.match(r"^(?:die|das|der|mit)\s+\w", title, re.IGNORECASE)
        )

        # Step quality: garbled steps contain amounts/units mid-sentence,
        # start with lone lowercase letters, or contain semicolons — all
        # signs of two-column OCR merge artefacts.
        garbled_step_re = re.compile(
            r"^[a-z‚'\"\s]{0,5}\d"  # starts with lower/garbage then digit
            r"|^\w{1,2}\s+\w{2,}"   # starts with a 1-2 char garbled token
            r"|\b\w{1,2}\s*;\s*\w"  # garbled abbreviation + semicolon mid-text
            r"|^\d+\s*[gGmMlL]\b",  # starts with amount/unit (column bleed)
            re.IGNORECASE,
        )
        garbled_step_count = sum(1 for s in r.steps if garbled_step_re.search(s))
        steps_look_clean = (
            len(r.steps) >= 2
            and garbled_step_count <= len(r.steps) * 0.3
        )

        # Ingredient coverage: compare found ingredients against document
        # length.  Short magazine snippets with few ingredients relative to
        # text length indicate incomplete extraction.
        doc_chars = len(text.strip())
        expected_ingr_min = max(3, doc_chars // 200)
        coverage = total_ingr / max(expected_ingr_min, 5)

        parse_score += 0.15 if has_real_title else 0.0
        parse_score += min(coverage, 1.0) * 0.20
        parse_score += 0.10 if steps_look_clean else 0.0
        parse_score += 0.05 if r.prep_time or r.cook_time or r.servings else 0.0
    except Exception:
        pass

    # ── Component 2: column-merge artifact detection (0.0–0.25) ──────────────
    # Lines that contain both an ingredient amount pattern AND step-number text
    # are a reliable sign of two-column OCR merge (magazine / complex layouts).
    merge_re = re.compile(
        r"^\d+[\d/.,]*\s*\w{0,5}\s+.*\d+\s*[.)]",  # "100 g we ; 2. Für den..."
        re.IGNORECASE,
    )
    garbled_word_re = re.compile(r"\b[A-Za-z]{1,2}\b")
    merge_lines = sum(1 for ln in lines if merge_re.search(ln))
    # Lines with many short (1-2 char) tokens are likely garbled
    garbled_lines = sum(
        1
        for ln in lines
        if len(ln) > 10
        and len(garbled_word_re.findall(ln)) > len(ln.split()) * 0.4
    )
    artifact_ratio = (merge_lines + garbled_lines) / len(lines) if lines else 0.0
    merge_score = max(0.0, 1.0 - artifact_ratio * 4.0) * 0.25

    # ── Component 3: noise character ratio (0.0–0.15) ─────────────────────────
    total_chars = len(text)
    noise_chars = sum(1 for c in text if c in "|@©®#$%^&*_=~`{}<>[]\\")
    noise_ratio = noise_chars / total_chars if total_chars > 0 else 1.0
    noise_score = max(0.0, 1.0 - noise_ratio * 10.0) * 0.15

    # ── Component 4: mostly-uppercase line ratio (0.0–0.10) ───────────────────
    caps_lines = sum(
        1
        for ln in lines
        if len(ln) > 4
        and sum(1 for c in ln if c.isalpha() and c.isupper())
        / max(1, len([c for c in ln if c.isalpha()]))
        > 0.65
    )
    caps_score = max(0.0, 1.0 - (caps_lines / len(lines)) * 3.0) * 0.10

    return parse_score + merge_score + noise_score + caps_score


def _parse_pdf(content: bytes, handwriting: bool) -> ImportResult:
    """Full parse pipeline for a PDF file.

    Routing strategy (fastest/cheapest first):

    1. Extract raw text from the PDF.
    2. If the extracted text has good quality (score ≥ threshold):
       → Text AI first (fast, no rendering needed).
    3. If text quality is poor (scanned / image-only PDF):
       → Vision AI on the rendered first page (best for complex layouts).
    4. Fallback: Text AI on whatever text was extracted.
    5. Heuristic parser.
    """
    raw_text, image_url = extract_pdf_text_and_image(content, handwriting)
    ocr_quality = _assess_ocr_quality(raw_text)

    result: ImportResult | None = None
    chat_completions_failed = False

    logger.debug("PDF import: OCR quality=%.2f", ocr_quality)

    # Step 1 – Text AI on extracted text (fast path for clean PDFs)
    if raw_text.strip() and ocr_quality >= _OCR_QUALITY_THRESHOLD:
        result = parse_with_ai(raw_text)
        if result:
            logger.debug("PDF parsed via text AI (quality=%.2f)", ocr_quality)

    # Step 2 – Vision AI on rendered first page (for scanned / complex PDFs)
    if result is None and has_vision_ai():
        page_img = render_pdf_first_page(content)
        if page_img:
            result = parse_image_with_ai(page_img, mime_type="image/jpeg")
            if result:
                logger.debug("PDF parsed via vision AI (rendered first page)")
            else:
                chat_completions_failed = True

    # Step 3 – Text AI fallback on raw text
    if result is None and raw_text.strip():
        result = parse_with_ai(raw_text, skip_chat_completions=chat_completions_failed)
        if result:
            logger.debug("PDF parsed via text AI (fallback)")

    # Step 4 – Heuristic fallback
    if result is None:
        if raw_text.strip():
            result = parse_ocr_text(raw_text)
            logger.debug("PDF parsed via heuristic parser")
        else:
            result = ImportResult(
                title="PDF Import nicht vollständig verfügbar",
                ingredients=[],
                steps=[],
            )

    # Restore embedded photo extracted by PyMuPDF
    if image_url and not result.image_url:
        result.image_url = image_url

    return result


def _parse_image(
    content: bytes, mime_type: str, handwriting: bool
) -> ImportResult:
    """Full parse pipeline for an image file.

    Routing strategy (fastest/cheapest first):

    1. Run Tesseract OCR and score the output quality.
    2. If OCR quality is good (score ≥ threshold) AND not handwriting mode:
       → Text AI (fast, resource-efficient).
    3. If OCR quality is poor OR handwriting mode:
       → Vision AI (send raw image to vision model, no prior OCR).
    4. If vision AI is unavailable or fails → Text AI on OCR output.
    5. Heuristic fallback (always available).
    """
    result: ImportResult | None = None

    # Step 1 – Run OCR to assess quality (always needed for text-path fallback)
    raw_text = extract_image_text(content, handwriting)
    ocr_quality = _assess_ocr_quality(raw_text)
    use_vision_first = handwriting or ocr_quality < _OCR_QUALITY_THRESHOLD

    logger.debug(
        "Image import: OCR quality=%.2f, handwriting=%s → %s",
        ocr_quality,
        handwriting,
        "vision-first" if use_vision_first else "text-first",
    )

    # Step 2 – Text AI (fast path for clean OCR)
    if not use_vision_first and raw_text.strip():
        result = parse_with_ai(raw_text)
        if result:
            logger.debug("Image parsed via text AI after OCR (quality=%.2f)", ocr_quality)

    # Step 3 – Vision AI (for complex images, handwriting, or after text-AI miss)
    if result is None and has_vision_ai():
        result = parse_image_with_ai(content, mime_type=mime_type)
        if result:
            logger.debug("Image parsed via vision AI")

    # Step 4 – Text AI on OCR output (fallback when vision was tried first)
    if result is None and raw_text.strip():
        result = parse_with_ai(raw_text)
        if result:
            logger.debug("Image parsed via text AI (fallback after vision miss)")

    # Step 5 – Heuristic fallback
    if result is None:
        if raw_text.strip():
            result = parse_ocr_text(raw_text)
        else:
            result = ImportResult(title="Kein Text erkannt", ingredients=[], steps=[])
        logger.debug("Image parsed via heuristic parser")

    return result


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/url", response_model=ImportResult)
def import_from_url(
    url: str = Query(..., description="Recipe website URL"),
    db: Session = Depends(get_db),
):
    site_settings = get_settings(db)
    try:
        result = scrape_url(url, check_ssrf=site_settings.ssrf_protection)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not scrape URL: {e}")

    # Try AI enhancement on scraped text (URL scraper already structures data)
    combined_text = "\n".join(
        [result.title or ""]
        + result.ingredients
        + [i for g in result.ingredient_groups for i in g.ingredients]
        + result.steps
    )
    ai_result = parse_with_ai(combined_text)
    if ai_result:
        if not ai_result.source_url:
            ai_result.source_url = result.source_url
        if not ai_result.image_url:
            ai_result.image_url = result.image_url
        return ai_result

    return result


@router.post("/file", response_model=ImportResult)
async def import_from_file(
    file: UploadFile = File(...),
    handwriting: bool = Query(False, description="Enable enhanced OCR for handwritten recipes"),
):
    """Import a single PDF or image file."""
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 20 MB)")

    if _is_pdf(file):
        return _parse_pdf(content, handwriting)
    elif _is_image(file):
        return _parse_image(content, file.content_type or "image/jpeg", handwriting)
    else:
        raise HTTPException(status_code=415, detail="Unsupported file type. Use PDF or image.")


@router.post("/files", response_model=ImportResult)
async def import_from_files(
    files: list[UploadFile] = File(...),
    handwriting: bool = Query(False, description="Enable enhanced OCR for handwritten recipes"),
):
    """Import multiple files representing pages of a single recipe (multi-page support)."""
    if not files:
        raise HTTPException(status_code=422, detail="No files provided")

    all_texts: list[str] = []
    all_image_urls: list[str | None] = []
    # Parallel list: raw image bytes + MIME type for image files, None for PDFs.
    image_data: list[tuple[bytes, str] | None] = []

    for file in files:
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File '{file.filename}' is too large (max 20 MB per file)",
            )
        if _is_pdf(file):
            raw_text, img_url = extract_pdf_text_and_image(content, handwriting)
            all_texts.append(raw_text)
            all_image_urls.append(img_url)
            image_data.append(None)
        elif _is_image(file):
            all_texts.append(extract_image_text(content, handwriting))
            all_image_urls.append(None)
            image_data.append((content, file.content_type or "image/jpeg"))
        else:
            logger.warning(
                "Skipped unsupported file '%s' (content-type: %s) in multi-file import.",
                file.filename,
                file.content_type,
            )

    if not any(t.strip() for t in all_texts):
        raise HTTPException(status_code=422, detail="No processable content found")

    first_image_url = next((u for u in all_image_urls if u), None)
    result: ImportResult | None = None

    # Determine whether any image page needs vision processing.
    # Vision is used when handwriting mode is active OR when any image file
    # scored below the OCR quality threshold (magazine scans, complex layouts).
    use_vision_for_images = handwriting or any(
        _assess_ocr_quality(t) < _OCR_QUALITY_THRESHOLD
        for t, img in zip(all_texts, image_data)
        if img is not None
    )

    # Vision path: process each file individually and merge the results.
    # This gives significantly better accuracy for scanned magazines, handwritten
    # recipe cards, and other complex multi-page layouts where combined garbled
    # OCR text would mislead the text AI.
    if use_vision_for_images and has_vision_ai():
        page_results: list[ImportResult] = []
        for t, img in zip(all_texts, image_data):
            if img is not None:
                img_content, mime = img
                pr = parse_image_with_ai(img_content, mime_type=mime)
                if pr is None and t.strip():
                    pr = parse_with_ai(t)
                if pr is None and t.strip():
                    pr = parse_ocr_text(t)
            elif t.strip():
                pr = parse_with_ai(t) or parse_ocr_text(t)
            else:
                pr = None
            if pr is not None:
                page_results.append(pr)
        if page_results:
            result = merge_import_results(page_results)
            logger.debug(
                "Multi-file parsed via vision AI (merged %d pages)", len(page_results)
            )

    # Text AI on combined OCR text (fast path for clean documents / vision miss)
    if result is None:
        combined_text = "\n\n".join(t for t in all_texts if t.strip())
        result = parse_with_ai(combined_text)

    # Heuristic fallback: parse each page separately and merge
    if result is None:
        page_results = [parse_ocr_text(t) for t in all_texts if t.strip()]
        if not page_results:
            raise HTTPException(status_code=422, detail="No processable files found")
        result = merge_import_results(page_results)

    if first_image_url and not result.image_url:
        result.image_url = first_image_url

    return result


@router.post("/camera", response_model=ImportResult)
async def import_from_camera(
    file: UploadFile = File(...),
    handwriting: bool = Query(False, description="Enable enhanced OCR for handwritten recipes"),
):
    """Process a photo taken from the camera."""
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large")

    return _parse_image(content, file.content_type or "image/jpeg", handwriting)
