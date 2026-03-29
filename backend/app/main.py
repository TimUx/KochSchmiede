from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth_router, import_router, recipe_router
from app.config import settings
from app.database import Base, engine

# Create tables on startup (use Alembic in production)
Base.metadata.create_all(bind=engine)

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


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "KochSchmiede API"}
