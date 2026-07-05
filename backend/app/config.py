"""Application configuration loaded from environment variables.

Uses pydantic-settings so all config is validated at startup and can be
overridden via a `.env` file (see `.env.example`) or real environment
variables in production. No secrets are hardcoded here.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central application settings.

    All values have safe local-dev defaults so the app is importable and
    testable without a `.env` file or live infrastructure (Postgres/Redis/
    RabbitMQ are not required to import or unit-test this project).
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "savvyarchitect-backend"
    app_env: str = "development"
    debug: bool = True

    cors_origins: str = "http://localhost:3000"

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/savvyarchitect"
    redis_url: str = "redis://localhost:6379/0"
    rabbitmq_url: str = "amqp://guest:guest@localhost:5672//"

    @property
    def cors_origin_list(self) -> list[str]:
        """Return CORS origins as a list, split on commas."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance (avoids re-parsing env on every call)."""
    return Settings()
