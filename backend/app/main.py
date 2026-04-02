import os
import threading

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api import admin_router, auth_router, import_router, recipe_router
from app.config import settings
from app.database import Base, SessionLocal, engine

# Create tables on startup (use Alembic in production)
Base.metadata.create_all(bind=engine)


def _migrate_site_settings() -> None:
    """Add columns introduced after the initial schema creation.

    Uses ``ADD COLUMN IF NOT EXISTS`` so it is safe to run on every startup –
    it is a no-op when the columns already exist.  Column names and types are
    taken from the hardcoded ``_SITE_SETTINGS_NEW_COLUMNS`` list; no
    user-supplied input is interpolated into the SQL.
    """
    _SITE_SETTINGS_NEW_COLUMNS = [
        ("logo_light_url", "VARCHAR(512)"),
        ("logo_dark_url", "VARCHAR(512)"),
        ("favicon_url", "VARCHAR(512)"),
        ("appicon_url", "VARCHAR(512)"),
        ("ext_ai_provider", "VARCHAR(20)"),
        ("ext_ai_api_key", "VARCHAR(512)"),
        ("ext_ai_model", "VARCHAR(100)"),
    ]
    # Allowed column names and types – validated before interpolation so that
    # accidental future changes to the list cannot introduce SQL injection.
    _allowed_names = {col for col, _ in _SITE_SETTINGS_NEW_COLUMNS}
    _allowed_types = {"VARCHAR(512)", "VARCHAR(20)", "VARCHAR(100)"}
    with engine.connect() as conn:
        for col_name, col_type in _SITE_SETTINGS_NEW_COLUMNS:
            if col_name not in _allowed_names or col_type not in _allowed_types:
                raise ValueError(f"Unexpected migration value: {col_name!r} {col_type!r}")
            conn.execute(
                text(
                    f"ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS"
                    f" {col_name} {col_type}"
                )
            )
        conn.commit()


_migrate_site_settings()

# Default units seeded when the units table is first created
_DEFAULT_UNITS = [
    "keine Einheit", "g", "kg", "ml", "l", "EL", "TL",
    "Tasse", "Prise", "Msp.", "Stück", "Scheibe(n)", "Bund",
    "Packung", "Dose", "Glas", "cm", "nach Geschmack",
]


def _seed_units() -> None:
    from app.models import Unit  # local import to avoid circular deps at module level

    db = SessionLocal()
    try:
        if db.query(Unit).count() == 0:
            for i, name in enumerate(_DEFAULT_UNITS):
                db.add(Unit(name=name, position=i))
            db.commit()
    finally:
        db.close()


_seed_units()

app = FastAPI(
    title="KochSchmiede API",
    description="Self-hosted recipe management platform API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(recipe_router, prefix="/api")
app.include_router(import_router, prefix="/api")
app.include_router(admin_router, prefix="/api")

# Serve uploaded logo/icon files
_UPLOADS_DIR = "/app/uploads"
os.makedirs(_UPLOADS_DIR, exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=_UPLOADS_DIR), name="uploads")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "KochSchmiede API"}


# ── Background: Ollama model auto-pull ───────────────────────────────────────
# Trigger once at startup in a daemon thread so it does not block the server.
# The thread queries Ollama for available models and pulls the recommended
# pair (llama3.2 + llava:7b) if neither a text nor a vision model is present.
def _startup_ensure_models() -> None:
    try:
        from app.services.ollama_models import ensure_models_available

        ensure_models_available()
    except Exception as exc:
        import logging

        logging.getLogger(__name__).warning(
            "Ollama model auto-pull startup task failed: %s", exc
        )


_t = threading.Thread(target=_startup_ensure_models, daemon=True, name="ollama-autopull")
_t.start()


@app.get("/api/setup/status")
def setup_status():
    """Check whether initial setup is required (no users have been created yet)."""
    from app.models import User

    db = SessionLocal()
    try:
        needs_setup = db.query(User).count() == 0
        return {"needs_setup": needs_setup}
    finally:
        db.close()


@app.get("/api/settings/public")
def public_settings(db=None):
    """Return the subset of settings the frontend needs without authentication."""
    from app.database import SessionLocal
    from app.services.settings import get_settings as _get

    db = SessionLocal()
    try:
        s = _get(db)
        return {
            "site_mode": s.site_mode,
            "registration_mode": s.registration_mode,
            "logo_light_url": s.logo_light_url,
            "logo_dark_url": s.logo_dark_url,
            "favicon_url": s.favicon_url,
            "appicon_url": s.appicon_url,
            "ext_ai_configured": bool(s.ext_ai_provider and s.ext_ai_api_key and s.ext_ai_model),
        }
    finally:
        db.close()


@app.get("/api/units")
def public_units():
    """Return the list of configured ingredient units (no authentication required)."""
    from app.models import Unit
    from app.schemas import UnitOut

    db = SessionLocal()
    try:
        units = db.query(Unit).order_by(Unit.position, Unit.name).all()
        return [UnitOut.model_validate(u) for u in units]
    finally:
        db.close()
