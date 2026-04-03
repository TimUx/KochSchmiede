from typing import Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://kochschmiede:secret@postgres:5432/kochschmiede"
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://frontend:3000"]

    # ── Local / free LLM (text + vision) ─────────────────────────────────────
    # Uses the OpenAI Chat Completions protocol, which is supported by all
    # major free local servers:
    #   Ollama    – LLM_BASE_URL=http://ollama:11434/v1  (bundled Docker service)
    #   LM Studio – LLM_BASE_URL=http://host.docker.internal:1234/v1
    #
    # LLM_MODEL is optional: when left empty the import pipeline queries Ollama
    # for all available models and automatically picks the best one (smallest /
    # fastest text model first; vision model only when needed).
    # Set LLM_MODEL explicitly to lock a specific model (e.g. when using LM
    # Studio where only one model is loaded at a time).
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = ""          # empty = disabled; set to your local LLM server
    LLM_MODEL: str = ""             # empty = auto-select from Ollama model list

    # LLM_VISION is only needed when LLM_MODEL is set explicitly to a
    # text-only model (e.g. llama3.2) and you want to prevent the pipeline
    # from attempting vision calls.  When LLM_MODEL is empty the pipeline
    # auto-detects vision capability from the available Ollama models.
    LLM_VISION: Optional[bool] = None   # None = auto-detect; True/False = override

    # ── Legacy Ollama /api/generate (kept for backwards compatibility) ─────────
    # Prefer LLM_BASE_URL=http://ollama:11434/v1 for new setups.
    # Example: AI_ENDPOINT=http://ollama:11434
    AI_ENDPOINT: str = ""
    AI_MODEL: str = "llama3.2"

    # ── AI request timeout ────────────────────────────────────────────────────
    # Seconds to wait for a single LLM inference call.  Increase on slow
    # CPU-only hardware – local models can take several minutes per request.
    AI_TIMEOUT: int = 300

    # ── Image search for recipe import ───────────────────────────────────────
    # When a recipe is imported without a photo, the import page can search for
    # a suitable food image online.
    #
    # IMAGE_SEARCH_PROVIDER – comma-separated list of providers to try in order.
    #   Providers without a configured API key are silently skipped; the feature
    #   is disabled when no key is set at all.
    #
    # Per-provider API keys:
    #   PIXABAY_API_KEY   – https://pixabay.com/api/docs/       (free, 500 req/h)
    #   UNSPLASH_API_KEY  – https://unsplash.com/developers     (free, 50 req/h)
    #   PEXELS_API_KEY    – https://www.pexels.com/api/         (free, 200 req/h)
    #
    # Legacy: IMAGE_SEARCH_API_KEY is used as the Pixabay key when PIXABAY_API_KEY
    # is not set (backwards compatibility).
    IMAGE_SEARCH_API_KEY: str = ""   # legacy Pixabay key – prefer PIXABAY_API_KEY
    IMAGE_SEARCH_PROVIDER: str = "pixabay,unsplash,pexels"
    PIXABAY_API_KEY: str = ""
    UNSPLASH_API_KEY: str = ""
    PEXELS_API_KEY: str = ""

    # ── Ollama model auto-pull ────────────────────────────────────────────────
    # When True (the default) and Ollama is reachable but has no suitable text
    # or vision model loaded, the backend will automatically pull a recommended
    # model pair on first use:
    #   • llama3.2      (≈ 2 GB) – fast text model
    #   • llava:7b      (≈ 4.7 GB) – capable vision model
    # Set to False to disable automatic pulling (manage models manually).
    OLLAMA_AUTO_PULL: bool = True

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_must_be_set(cls, v: str) -> str:
        if not v:
            raise ValueError(
                "SECRET_KEY must be set via the SECRET_KEY environment variable. "
                "Use a long random string (e.g. `openssl rand -hex 32`)."
            )
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long.")
        return v

    class Config:
        env_file = ".env"


settings = Settings()
