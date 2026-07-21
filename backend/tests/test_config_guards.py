"""Startup guards: a misconfigured deploy must fail loudly, not silently."""
import pytest

from app.config import DEV_JWT_SECRET, Settings, get_settings


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_recognised_dev_envs_are_not_production():
    for env in ("development", "dev", "local", "test"):
        assert not Settings(app_env=env).is_production


def test_unknown_env_is_treated_as_production():
    """Fail closed: a typo'd APP_ENV must not unlock dev defaults."""
    assert Settings(app_env="prodction").is_production
    assert Settings(app_env="staging").is_production
    assert Settings(app_env="").is_production


def test_production_with_dev_jwt_secret_raises(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", DEV_JWT_SECRET)
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        get_settings()


def test_production_with_real_jwt_secret_is_allowed(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "a-real-secret-from-the-vault")
    assert get_settings().is_production


def test_wildcard_cors_is_rejected(monkeypatch):
    """allow_credentials=True + '*' is invalid; refuse it at startup."""
    monkeypatch.setenv("CORS_ORIGINS", "*")
    with pytest.raises(RuntimeError, match="CORS_ORIGINS"):
        get_settings()
