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

class Settings:
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")

    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_MODEL: str = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
    OPENROUTER_SITE_URL: str = os.getenv("OPENROUTER_SITE_URL", "")
    OPENROUTER_APP_NAME: str = os.getenv("OPENROUTER_APP_NAME", "TrustRAG")

    OLLAMA_ENDPOINT: str = os.getenv("OLLAMA_ENDPOINT", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3.2")

    TAVILY_API_KEY: str = os.getenv("TAVILY_API_KEY", "")
    EXTERNAL_VERIFICATION_ENABLED: bool = os.getenv(
        "EXTERNAL_VERIFICATION_ENABLED", "true"
    ).lower() in {"1", "true", "yes", "on"}

    CHROMA_PERSIST_DIR: str = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")  # unused, kept for compat
    EMBEDDING_MODEL_NAME: str = os.getenv("EMBEDDING_MODEL_NAME", "BAAI/bge-small-en-v1.5")
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017/trustrag")

    # Render backend URL — used to whitelist CORS
    BACKEND_URL: str = os.getenv("BACKEND_URL", "")

    @property
    def DEFAULT_MODEL(self) -> str:
        return self.GEMINI_MODEL

settings = Settings()
