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
    # Vision models (llava, llama3.2-vision, …) parse recipe images directly
    # without OCR.  No API key is required for local servers; leave
    # LLM_API_KEY empty.
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = ""          # empty = disabled; set to your local LLM server
    LLM_MODEL: str = "llama3.2"    # any model pulled in Ollama / loaded in LM Studio

    # Set to False when LLM_MODEL is a text-only model (e.g. llama3.2 instead
    # of llama3.2-vision).  The import pipeline then skips the vision step
    # entirely and runs Tesseract OCR on the image first, then sends the
    # extracted text to the LLM.  This requires far less RAM/VRAM than a
    # vision model and is a good choice for CPU-only or low-memory servers.
    LLM_VISION: bool = True

    # ── Legacy Ollama /api/generate (kept for backwards compatibility) ─────────
    # Prefer LLM_BASE_URL=http://ollama:11434/v1 for new setups.
    # Example: AI_ENDPOINT=http://ollama:11434
    AI_ENDPOINT: str = ""
    AI_MODEL: str = "llama3.2"

    # ── AI request timeout ────────────────────────────────────────────────────
    # Seconds to wait for a single LLM inference call.  Increase on slow
    # CPU-only hardware – local models can take several minutes per request.
    AI_TIMEOUT: int = 300

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
