"""App-construction guards: /docs, /redoc, /openapi.json must not be
publicly reachable in production -- they fully disclose the API surface
(every route, schema, field) to anyone who requests them."""
import pytest

from app.config import get_settings
from app.main import create_app


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_docs_disabled_in_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "a-real-secret-from-the-vault")
    monkeypatch.setenv("FRAUD_HASH_SECRET", "a-real-fraud-secret-from-the-vault")
    app = create_app()
    assert app.docs_url is None
    assert app.redoc_url is None
    assert app.openapi_url is None


def test_docs_enabled_outside_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    app = create_app()
    assert app.docs_url == "/docs"
    assert app.redoc_url == "/redoc"
    assert app.openapi_url == "/openapi.json"


def test_create_app_registers_webp_even_when_the_os_table_lacks_it() -> None:
    """create_app() must not depend on the host's MIME table.

    This is the bug that shipped: on this developer machine Python already
    knows .webp, so it worked everywhere except where it mattered. The slim
    container image has no /etc/mime.types and that Python's built-in table
    has no .webp entry, so StaticFiles served every uploaded WebP as
    "text/plain; charset=utf-8" and the browser -- under nosniff -- refused to
    render it.

    Stripping the mapping first is what makes this test reproduce the
    container rather than the laptop.
    """
    import mimetypes

    from app.main import create_app

    saved_types = dict(mimetypes.types_map)
    saved_db = mimetypes._db  # type: ignore[attr-defined]
    try:
        mimetypes.init([])  # rebuild with no OS mime files at all
        mimetypes.types_map.pop(".webp", None)
        assert mimetypes.guess_type("a.webp")[0] is None, "precondition: .webp unknown"

        create_app()

        assert mimetypes.guess_type("a.webp")[0] == "image/webp"
        assert mimetypes.guess_type("a.avif")[0] == "image/avif"
    finally:
        mimetypes._db = saved_db  # type: ignore[attr-defined]
        mimetypes.types_map.clear()
        mimetypes.types_map.update(saved_types)
