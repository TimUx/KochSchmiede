import logging

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import ImportResult
from app.services.ai_parser import parse_with_ai
from app.services.ocr import merge_import_results, ocr_image, ocr_pdf
from app.services.scraper import scrape_url
from app.services.settings import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/import", tags=["import"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/tiff"}
ALLOWED_PDF_TYPE = "application/pdf"
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


def _is_pdf(file: UploadFile) -> bool:
    return (file.content_type or "") == ALLOWED_PDF_TYPE or (
        file.filename or ""
    ).lower().endswith(".pdf")


def _is_image(file: UploadFile) -> bool:
    return (file.content_type or "") in ALLOWED_IMAGE_TYPES or any(
        (file.filename or "").lower().endswith(ext)
        for ext in (".jpg", ".jpeg", ".png", ".webp", ".tiff")
    )


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

    # Try AI enhancement if the endpoint is configured
    combined_text = "\n".join(
        [result.title or ""]
        + result.ingredients
        + [i for g in result.ingredient_groups for i in g.ingredients]
        + result.steps
    )
    ai_result = parse_with_ai(combined_text)
    if ai_result:
        # Preserve fields that the AI result may have left empty
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
        result = ocr_pdf(content, handwriting=handwriting)
    elif _is_image(file):
        result = ocr_image(content, file.content_type or "image/jpeg", handwriting=handwriting)
    else:
        raise HTTPException(status_code=415, detail="Unsupported file type. Use PDF or image.")

    # Optional AI enhancement
    if result.title and (result.ingredients or result.ingredient_groups or result.steps):
        combined_text = "\n".join(
            [result.title or ""]
            + result.ingredients
            + [i for g in result.ingredient_groups for i in g.ingredients]
            + result.steps
        )
        ai_result = parse_with_ai(combined_text)
        if ai_result:
            return ai_result

    return result


@router.post("/files", response_model=ImportResult)
async def import_from_files(
    files: list[UploadFile] = File(...),
    handwriting: bool = Query(False, description="Enable enhanced OCR for handwritten recipes"),
):
    """Import multiple files representing pages of a single recipe (multi-page support)."""
    if not files:
        raise HTTPException(status_code=422, detail="No files provided")

    page_results: list[ImportResult] = []
    for file in files:
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File '{file.filename}' is too large (max 20 MB per file)",
            )
        if _is_pdf(file):
            page_results.append(ocr_pdf(content, handwriting=handwriting))
        elif _is_image(file):
            page_results.append(
                ocr_image(content, file.content_type or "image/jpeg", handwriting=handwriting)
            )
        else:
            logger.warning(
                "Skipped unsupported file '%s' (content-type: %s) in multi-file import.",
                file.filename,
                file.content_type,
            )

    if not page_results:
        raise HTTPException(status_code=422, detail="No processable files found")

    merged = merge_import_results(page_results)

    # Optional AI enhancement on merged text
    if merged.title:
        combined_text = "\n".join(
            [merged.title or ""]
            + merged.ingredients
            + [i for g in merged.ingredient_groups for i in g.ingredients]
            + merged.steps
        )
        ai_result = parse_with_ai(combined_text)
        if ai_result:
            return ai_result

    return merged


@router.post("/camera", response_model=ImportResult)
async def import_from_camera(
    file: UploadFile = File(...),
    handwriting: bool = Query(False, description="Enable enhanced OCR for handwritten recipes"),
):
    """Process a photo taken from the camera."""
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large")

    result = ocr_image(content, file.content_type or "image/jpeg", handwriting=handwriting)

    # Optional AI enhancement
    if result.title:
        combined_text = "\n".join(
            [result.title or ""]
            + result.ingredients
            + [i for g in result.ingredient_groups for i in g.ingredients]
            + result.steps
        )
        ai_result = parse_with_ai(combined_text)
        if ai_result:
            return ai_result

    return result

