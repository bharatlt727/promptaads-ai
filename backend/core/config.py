"""Application settings loaded from environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "PromptAds AI"
    debug: bool = False

    # ── Database ──────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://promptads:changeme_in_production@localhost:5432/promptads"

    # ── Qdrant ────────────────────────────────────────────
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_collection: str = "ad_embeddings"

    # ── LLM / Embeddings ─────────────────────────────────
    llm_provider: str = "gemini"                      # "openai" | "gemini"
    llm_api_key: str = ""                              # Provider API key
    llm_model: str = "gemini-2.5-flash"               # Chat model
    llm_base_url: str = ""                             # Custom base URL (auto-set per provider)
    embedding_model: str = "gemini-embedding-001"        # Embedding model
    embedding_dimensions: int = 3072                    # Gemini text-embedding-004 → 768

    # Legacy alias
    openai_api_key: str = ""

    @property
    def resolved_api_key(self) -> str:
        return self.llm_api_key or self.openai_api_key

    @property
    def resolved_base_url(self) -> str | None:
        if self.llm_base_url:
            return self.llm_base_url
        if self.llm_provider == "gemini":
            return "https://generativelanguage.googleapis.com/v1beta/openai/"
        return None  # OpenAI default

    # ── JWT ────────────────────────────────────────────────
    jwt_secret_key: str = "change-this-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440  # 24 hours

    # ── CORS ──────────────────────────────────────────────
    backend_cors_origins: list[str] = ["http://localhost:3000"]


settings = Settings()
