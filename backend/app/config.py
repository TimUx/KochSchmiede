from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://kochschmiede:secret@postgres:5432/kochschmiede"
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://frontend:3000"]

    # ── OpenAI-compatible API (text + vision; recommended) ────────────────────
    # Works with: OpenAI, Azure OpenAI, Groq, Together.ai, LM Studio,
    #             Ollama /v1 endpoint, and any other OpenAI-API-compatible server.
    # Vision-capable models (gpt-4o, llava, llama3.2-vision, …) can parse
    # recipe images directly without prior OCR.
    #
    # OpenAI:   OPENAI_API_KEY=sk-...
    # Groq:     OPENAI_API_KEY=gsk_...  OPENAI_BASE_URL=https://api.groq.com/openai/v1
    # Ollama:   OPENAI_BASE_URL=http://ollama:11434/v1  OPENAI_MODEL=llama3.2
    # LM Studio:OPENAI_BASE_URL=http://localhost:1234/v1
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_MODEL: str = "gpt-4o-mini"

    # ── Legacy Ollama /api/generate (kept for backwards compatibility) ─────────
    # Prefer OPENAI_BASE_URL=http://ollama:11434/v1 for new setups.
    # Example: AI_ENDPOINT=http://ollama:11434
    AI_ENDPOINT: str = ""
    AI_MODEL: str = "llama3.2"

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
