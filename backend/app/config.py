from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuração via variáveis de ambiente (.env). Nenhum segredo vai para o frontend."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_version: str = "1.0.0"
    database_url: str = "postgresql+psycopg://mpa:mpa@localhost:5432/mpa"
    cors_origins: str = "http://localhost:5173"

    jwt_secret: str = "change-me"
    jwt_expires_minutes: int = 60

    # n8n — o app dispara workflows via webhook e o n8n devolve resultados assinados
    n8n_base_url: str = ""
    n8n_api_key: str = ""
    n8n_webhook_secret: str = ""  # segredo HMAC compartilhado app <-> n8n
    n8n_timeout_seconds: float = 30.0

    # OpenAI — apenas no servidor
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    gross_margin: float = 0.55
    attribution_model: str = "last-click"


@lru_cache
def get_settings() -> Settings:
    return Settings()
