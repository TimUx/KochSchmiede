"""Recipe import endpoints.

Parsing priority for every file / camera import
------------------------------------------------
1. **Vision AI** – if a vision-capable local LLM is configured
   (``LLM_BASE_URL`` pointing to a vision model such as
   ``llama3.2-vision`` or ``llava``), the image / rendered PDF page is
   sent directly to the model.  This handles any layout (tables, columns,
   grids) with the highest accuracy.

2. **Text AI** – the raw OCR / PDF text is sent to the local LLM
   (``LLM_BASE_URL`` chat completions or legacy Ollama ``/api/generate``).
   Falls back here when vision AI is unavailable or fails.

3. **Heuristic parser** – the built-in regex-based parser that works without
   any external service.  Always available as the last resort.
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


def _is_pdf(file: UploadFile) -> bool:
    return (file.content_type or "") == ALLOWED_PDF_TYPE or (
        file.filename or ""
    ).lower().endswith(".pdf")


def _is_image(file: UploadFile) -> bool:
    return (file.content_type or "") in ALLOWED_IMAGE_TYPES or any(
        (file.filename or "").lower().endswith(ext)
        for ext in (".jpg", ".jpeg", ".png", ".webp", ".tiff", ".heic", ".heif")
    )


def _parse_pdf(content: bytes, handwriting: bool) -> ImportResult:
    """Full parse pipeline for a PDF file.

    1. Extract raw text + embedded photo.
    2. If vision AI is available, render the first page as JPEG and send to
       vision model (best for complex layouts).
    3. Otherwise try text AI on the extracted text.  If vision AI was
       attempted but failed (e.g. the chat-completions endpoint timed out),
       skip that endpoint for the text step to avoid a second long wait and
       go straight to the legacy /api/generate fallback.
    4. Fall back to the heuristic parser.
    """
    raw_text, image_url = extract_pdf_text_and_image(content, handwriting)

    result: ImportResult | None = None
    chat_completions_failed = False

    # Step 1 – Vision AI on rendered first page (handles complex layouts best)
    if has_vision_ai():
        page_img = render_pdf_first_page(content)
        if page_img:
            result = parse_image_with_ai(page_img, mime_type="image/jpeg")
            if result:
                logger.debug("PDF parsed via vision AI")
            else:
                # The chat-completions endpoint failed for vision; remember this
                # so we don't repeat the same slow timeout for the text step.
                chat_completions_failed = True

    # Step 2 – Text AI on extracted raw text
    if result is None and raw_text.strip():
        result = parse_with_ai(raw_text, skip_chat_completions=chat_completions_failed)
        if result:
            logger.debug("PDF parsed via text AI")

    # Step 3 – Heuristic fallback
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

    1. Vision AI – send image directly to vision model (skips OCR entirely).
    2. Text AI – OCR the image first, then send text to LLM.  If vision AI
       was attempted but failed, skip the chat-completions endpoint and go
       straight to the legacy /api/generate fallback.
    3. Heuristic fallback.
    """
    result: ImportResult | None = None
    chat_completions_failed = False

    # Step 1 – Vision AI (no OCR needed)
    if has_vision_ai():
        result = parse_image_with_ai(content, mime_type=mime_type)
        if result:
            logger.debug("Image parsed via vision AI")
        else:
            chat_completions_failed = True

    # Step 2 – OCR + Text AI / heuristic
    if result is None:
        raw_text = extract_image_text(content, handwriting)
        if raw_text.strip():
            result = parse_with_ai(raw_text, skip_chat_completions=chat_completions_failed)
            if result:
                logger.debug("Image parsed via text AI after OCR")
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
        elif _is_image(file):
            all_texts.append(extract_image_text(content, handwriting))
            all_image_urls.append(None)
        else:
            logger.warning(
                "Skipped unsupported file '%s' (content-type: %s) in multi-file import.",
                file.filename,
                file.content_type,
            )

    if not any(t.strip() for t in all_texts):
        raise HTTPException(status_code=422, detail="No processable content found")

    combined_text = "\n\n".join(t for t in all_texts if t.strip())
    first_image_url = next((u for u in all_image_urls if u), None)

    # Try AI on the full combined text (one pass → better context for the LLM)
    result = parse_with_ai(combined_text)
    if result is None:
        # Heuristic: parse each page separately, then merge
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
