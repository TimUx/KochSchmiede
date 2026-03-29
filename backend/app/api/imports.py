from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import ImportResult
from app.services.ocr import ocr_image, ocr_pdf
from app.services.scraper import scrape_url
from app.services.settings import get_settings

router = APIRouter(prefix="/import", tags=["import"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/tiff"}
ALLOWED_PDF_TYPE = "application/pdf"
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


@router.get("/url", response_model=ImportResult)
def import_from_url(
    url: str = Query(..., description="Recipe website URL"),
    db: Session = Depends(get_db),
):
    site_settings = get_settings(db)
    try:
        return scrape_url(url, check_ssrf=site_settings.ssrf_protection)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not scrape URL: {e}")


@router.post("/file", response_model=ImportResult)
async def import_from_file(file: UploadFile = File(...)):
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 20 MB)")

    mime = file.content_type or ""
    if mime == ALLOWED_PDF_TYPE or file.filename.lower().endswith(".pdf"):
        return ocr_pdf(content)
    elif mime in ALLOWED_IMAGE_TYPES or any(
        file.filename.lower().endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".webp", ".tiff")
    ):
        return ocr_image(content, mime)
    else:
        raise HTTPException(status_code=415, detail="Unsupported file type. Use PDF or image.")


@router.post("/camera", response_model=ImportResult)
async def import_from_camera(file: UploadFile = File(...)):
    """Process a photo taken from the camera."""
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large")
    return ocr_image(content, file.content_type or "image/jpeg")
