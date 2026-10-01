import os
from pathlib import Path
from dotenv import dotenv_values

service_root = Path(__file__).resolve().parents[2]
dotenv_settings = {}
for dotenv_path in (service_root.parent / "backend" / ".env", service_root / ".env"):
    for key, value in dotenv_values(dotenv_path).items():
        if value is not None and value.strip():
            dotenv_settings[key] = value
for key, value in dotenv_settings.items():
    os.environ.setdefault(key, value)


def clean_provider_secret(value: str | None) -> str:
    """Return a provider key only when it is a real configured value.

    Example values from .env templates must not make /health report a ready
    service. The check is deliberately limited to obvious placeholder markers
    so valid provider keys are left unchanged.
    """
    normalized = (value or "").strip()
    lowered = normalized.lower()
    placeholder_markers = (
        "replace-with",
        "your-key",
        "your_",
        "placeholder",
        "example-key",
    )
    return "" if not normalized or any(marker in lowered for marker in placeholder_markers) else normalized


class Settings:
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")

    GEMINI_API_KEY: str = clean_provider_secret(os.getenv("GEMINI_API_KEY", ""))
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

    OPENROUTER_API_KEY: str = clean_provider_secret(os.getenv("OPENROUTER_API_KEY", ""))
    OPENROUTER_MODEL: str = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
    OPENROUTER_SITE_URL: str = os.getenv("OPENROUTER_SITE_URL", "")
    OPENROUTER_APP_NAME: str = os.getenv("OPENROUTER_APP_NAME", "TrustRAG")

    TAVILY_API_KEY: str = clean_provider_secret(os.getenv("TAVILY_API_KEY", ""))
    EXTERNAL_VERIFICATION_ENABLED: bool = os.getenv(
        "EXTERNAL_VERIFICATION_ENABLED", "true"
    ).lower() in {"1", "true", "yes", "on"}

    CHROMA_PERSIST_DIR: str = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")  # unused, kept for compat
    EMBEDDING_MODEL_NAME: str = os.getenv("EMBEDDING_MODEL_NAME", "gemini-embedding-2")
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017/trustrag")

    # Render backend URL — used to whitelist CORS
    BACKEND_URL: str = os.getenv("BACKEND_URL", "")
    SERVICE_TOKEN: str = os.getenv(
        "AI_SERVICE_TOKEN",
        "" if os.getenv("PYTHON_ENV", "development") == "production" else "dev-only-trustrag-service-token-change-me",
    )

    @property
    def DEFAULT_MODEL(self) -> str:
        return self.GEMINI_MODEL

settings = Settings()
