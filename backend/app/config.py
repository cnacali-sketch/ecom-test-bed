"""Application configuration loaded from environment variables.

Uses pydantic-settings so all config is validated at startup and can be
overridden via a `.env` file (see `.env.example`) or real environment
variables in production. No secrets are hardcoded here.
"""
from functools import lru_cache
from typing import ClassVar

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
    debug: bool = False  # override via DEBUG=true in .env

    cors_origins: str = "http://localhost:3000"

    # Leave empty in dev; set a secret in production .env
    api_key: str = ""

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/savvyarchitect"
    redis_url: str = "redis://localhost:6379/0"
    rabbitmq_url: str = "amqp://guest:guest@localhost:5672//"

    # --- Auth (P1) ---
    # Dev default keeps tests runnable without a .env; production MUST override.
    # `is_production` below hard-fails startup if this default survives to prod.
    jwt_secret: str = "dev_only_insecure_secret_do_not_use_in_production"
    jwt_algorithm: str = "HS256"
    jwt_access_ttl_min: int = 15
    jwt_refresh_ttl_days: int = 30
    # Cookies are httpOnly always; Secure is off in dev so http://localhost works.
    cookie_secure: bool = False
    cookie_samesite: str = "lax"

    # --- Email (P2 groundwork; used today by the enumeration-safe /register) ---
    # Dev stub logs the message to the app logger instead of sending it, so the
    # register flow is exercisable without an SMTP server.
    email_dev_stub: bool = True
    email_from: str = "no-reply@savvyinteal.local"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    email_verify_ttl_hours: int = 24

    # Base URL used to build links inside emails.
    frontend_url: str = "http://localhost:3000"

    # Only these opt IN to dev conveniences (insecure default secret, open CORS).
    # Anything else — including a typo'd or unset APP_ENV — is treated as
    # production, so a misconfigured deploy fails closed rather than silently
    # signing tokens with a public secret.
    DEV_ENVS: ClassVar[frozenset[str]] = frozenset({"development", "dev", "local", "test"})

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() not in self.DEV_ENVS

    @property
    def cors_origin_list(self) -> list[str]:
        """Return CORS origins as a list, split on commas."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


DEV_JWT_SECRET = "dev_only_insecure_secret_do_not_use_in_production"


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance (avoids re-parsing env on every call)."""
    settings = Settings()

    # Fail fast rather than sign production tokens with a public dev secret.
    if settings.is_production and settings.jwt_secret == DEV_JWT_SECRET:
        raise RuntimeError(
            f"JWT_SECRET must be set to a real secret when APP_ENV={settings.app_env!r}. "
            f"Recognised dev environments: {sorted(Settings.DEV_ENVS)}"
        )

    # main.py sends CORS with allow_credentials=True. Browsers reject "*" with
    # credentials anyway; refuse it here so the misconfiguration is loud.
    if "*" in settings.cors_origin_list:
        raise RuntimeError("CORS_ORIGINS cannot be '*' — credentialed CORS requires exact origins")

    return settings
