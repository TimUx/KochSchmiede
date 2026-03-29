from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import get_admin_user, get_current_user
from app.database import get_db
from app.models import User
from app.schemas import SiteSettingsOut, SiteSettingsUpdate, UserCreate, UserOut
from app.services.auth import create_user, get_user_by_username, hash_password
from app.services.settings import get_settings, update_settings

router = APIRouter(prefix="/admin", tags=["admin"])


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
