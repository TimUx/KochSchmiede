import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.auth import get_admin_user, get_current_user
from app.database import get_db
from app.models import User, Unit
from app.schemas import SiteSettingsOut, SiteSettingsUpdate, UnitCreate, UnitOut, UnitUpdate, UserCreate, UserOut
from app.services.auth import create_user, get_user_by_username, hash_password
from app.services.settings import get_settings, update_settings

router = APIRouter(prefix="/admin", tags=["admin"])

# ─── Logo / Icon upload helpers ───────────────────────────────────────────────

UPLOAD_DIR = Path("/app/uploads/logos")
ALLOWED_LOGO_TYPES = {"logo_light", "logo_dark", "favicon", "appicon"}
_LOGO_FIELD_MAP = {
    "logo_light": "logo_light_url",
    "logo_dark": "logo_dark_url",
    "favicon": "favicon_url",
    "appicon": "appicon_url",
}
ALLOWED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}
MAX_UPLOAD_SIZE = 5 * 1024 * 1024  # 5 MB


# ─── Site Settings ────────────────────────────────────────────────────────────


@router.get("/settings", response_model=SiteSettingsOut)
def read_settings(
    db: Session = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    return get_settings(db)


@router.put("/settings", response_model=SiteSettingsOut)
def write_settings(
    payload: SiteSettingsUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    return update_settings(
        db,
        site_mode=payload.site_mode,
        registration_mode=payload.registration_mode,
        ssrf_protection=payload.ssrf_protection,
    )


# ─── Logo / Icon Management ───────────────────────────────────────────────────


@router.post("/logos/{logo_type}", response_model=SiteSettingsOut)
async def upload_logo(
    logo_type: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    if logo_type not in ALLOWED_LOGO_TYPES:
        raise HTTPException(status_code=400, detail=f"Ungültiger Logo-Typ. Erlaubt: {', '.join(sorted(ALLOWED_LOGO_TYPES))}")
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Ungültiges Dateiformat. Erlaubt: PNG, JPEG, WEBP, GIF")

    data = await file.read()
    if len(data) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="Datei zu groß (max. 5 MB)")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # Determine extension from content type
    ext_map = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif"}
    ext = ext_map.get(file.content_type, ".png")
    filename = f"{logo_type}_{uuid.uuid4().hex[:8]}{ext}"
    dest = UPLOAD_DIR / filename

    # Delete the previous custom file for this slot (if any)
    settings_row = get_settings(db)
    old_url: str | None = getattr(settings_row, _LOGO_FIELD_MAP[logo_type])
    if old_url:
        old_path = UPLOAD_DIR / os.path.basename(old_url)
        old_path.unlink(missing_ok=True)

    dest.write_bytes(data)

    url = f"/api/uploads/logos/{filename}"
    return update_settings(db, **{_LOGO_FIELD_MAP[logo_type]: url})


@router.delete("/logos/{logo_type}", response_model=SiteSettingsOut)
def reset_logo(
    logo_type: str,
    db: Session = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    if logo_type not in ALLOWED_LOGO_TYPES:
        raise HTTPException(status_code=400, detail=f"Ungültiger Logo-Typ. Erlaubt: {', '.join(sorted(ALLOWED_LOGO_TYPES))}")

    settings_row = get_settings(db)
    field = _LOGO_FIELD_MAP[logo_type]
    old_url: str | None = getattr(settings_row, field)
    if old_url:
        old_path = UPLOAD_DIR / os.path.basename(old_url)
        old_path.unlink(missing_ok=True)

    return update_settings(db, _force_null_keys={field}, **{field: None})


# ─── User Management ──────────────────────────────────────────────────────────


@router.get("/users", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    return db.query(User).order_by(User.created_at).all()


@router.post("/users", response_model=UserOut, status_code=201)
def create_user_by_admin(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    if get_user_by_username(db, user_in.username):
        raise HTTPException(status_code=400, detail="Username already taken")
    return create_user(db, user_in)


@router.patch("/users/{user_id}/toggle-admin", response_model=UserOut)
def toggle_admin(
    user_id: str,
    db: Session = Depends(get_db),
    current_admin=Depends(get_admin_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own admin status")
    user.is_admin = not user.is_admin
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_admin=Depends(get_admin_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    db.delete(user)
    db.commit()


# ─── Unit Management ──────────────────────────────────────────────────────────


@router.get("/units", response_model=list[UnitOut])
def list_units(
    db: Session = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    return db.query(Unit).order_by(Unit.position, Unit.name).all()


@router.post("/units", response_model=UnitOut, status_code=201)
def create_unit(
    unit_in: UnitCreate,
    db: Session = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    name = unit_in.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name darf nicht leer sein")
    if db.query(Unit).filter(Unit.name == name).first():
        raise HTTPException(status_code=400, detail="Einheit existiert bereits")
    position = db.query(Unit).count()
    unit = Unit(name=name, position=position)
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return unit


@router.patch("/units/{unit_id}", response_model=UnitOut)
def rename_unit(
    unit_id: str,
    unit_in: UnitUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Einheit nicht gefunden")
    name = unit_in.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name darf nicht leer sein")
    existing = db.query(Unit).filter(Unit.name == name, Unit.id != unit_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Einheit existiert bereits")
    unit.name = name
    db.commit()
    db.refresh(unit)
    return unit


@router.delete("/units/{unit_id}", status_code=204)
def delete_unit(
    unit_id: str,
    db: Session = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Einheit nicht gefunden")
    db.delete(unit)
    db.commit()
