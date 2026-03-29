from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin_router, auth_router, import_router, recipe_router
from app.config import settings
from app.database import Base, SessionLocal, engine

# Create tables on startup (use Alembic in production)
Base.metadata.create_all(bind=engine)

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


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "KochSchmiede API"}


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
