import os
import warnings
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from dotenv import dotenv_values

service_root = Path(__file__).resolve().parents[2]
dotenv_settings = {}
for dotenv_path in (service_root.parent / "backend" / ".env", service_root / ".env"):
    for key, value in dotenv_values(dotenv_path).items():
        if value is not None and value.strip():
            dotenv_settings[key] = value


def is_valid_mongodb_uri(value: str | None) -> bool:
    normalized = (value or "").strip()
    if not normalized or "^" in normalized:
        return False
    try:
        parsed = urlsplit(normalized)
        if parsed.scheme not in {"mongodb", "mongodb+srv"} or not parsed.hostname:
            return False
        parsed.port
    except ValueError:
        return False

    options = {key.lower(): values for key, values in parse_qs(parsed.query).items()}
    retry_writes = options.get("retrywrites", [])
    return all(value.lower() in {"true", "false"} for value in retry_writes)


def resolve_mongodb_uri(
    environment_uri: str | None,
    dotenv_uri: str | None,
    *,
    production: bool,
) -> str:
    if is_valid_mongodb_uri(environment_uri):
        return environment_uri.strip()

    if environment_uri and production:
        raise ValueError("MONGODB_URI from the process environment is malformed")

    if is_valid_mongodb_uri(dotenv_uri):
        if environment_uri:
            warnings.warn(
                "Ignoring malformed process MONGODB_URI; using the project .env value in local mode.",
                RuntimeWarning,
                stacklevel=2,
            )
        return dotenv_uri.strip()

    if dotenv_uri:
        raise ValueError("MONGODB_URI from the project .env file is malformed")

    if environment_uri:
        raise ValueError("MONGODB_URI is malformed and no valid project .env value is available")

    return "mongodb://localhost:27017/trustrag"


for key, value in dotenv_settings.items():
    os.environ.setdefault(key, value)

os.environ["MONGODB_URI"] = resolve_mongodb_uri(
    os.getenv("MONGODB_URI"),
    dotenv_settings.get("MONGODB_URI"),
    production=os.getenv("PYTHON_ENV", os.getenv("NODE_ENV", "development")).lower()
    == "production",
)


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
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "auto").strip().lower()
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "").rstrip("/")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:3b")
    OLLAMA_TIMEOUT_SECONDS: float = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "180"))

    GEMINI_API_KEY: str = clean_provider_secret(os.getenv("GEMINI_API_KEY", ""))
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-lite")

    OPENROUTER_API_KEY: str = clean_provider_secret(os.getenv("OPENROUTER_API_KEY", ""))
    OPENROUTER_MODEL: str = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
    OPENROUTER_SITE_URL: str = os.getenv("OPENROUTER_SITE_URL", "")
    OPENROUTER_APP_NAME: str = os.getenv("OPENROUTER_APP_NAME", "TrustRAG")

    GROQ_API_KEY: str = clean_provider_secret(os.getenv("GROQ_API_KEY", ""))
    # GROQ_MODEL is kept for backward compat; llm_router uses hardcoded Groq-native IDs for auto-fallback
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

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
