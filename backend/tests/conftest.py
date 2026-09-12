"""Shared pytest fixtures.

In-memory SQLite async session overrides the Postgres dependency — full
test suite runs without live infrastructure.
"""
from collections.abc import AsyncGenerator, Generator

import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool, StaticPool

from app.config import get_settings
from app.db import Base, get_db_session
from app.dependencies.auth import ACCESS_COOKIE, CSRF_COOKIE, CSRF_HEADER
from app.main import app
from app.models.user import ROLE_ADMIN, ROLE_CUSTOMER, ROLE_STAFF, User
from app.services import login_throttle
from app.services.security import create_access_token, hash_password


@pytest.fixture(autouse=True)
def _clear_login_throttle() -> "Generator[None, None, None]":
    """Every login_throttle key (register/refresh/login/order/...) lives in one
    process-global dict, keyed by IP — and every test client resolves to the
    same fake IP under ASGITransport. Without a reset, throttle counts would
    accumulate across unrelated tests in unrelated files and start producing
    spurious 429s once enough order/coupon/etc. tests ran in one session."""
    login_throttle._attempts.clear()
    yield
    login_throttle._attempts.clear()


@pytest.fixture(autouse=True)
def _http_test_cookies() -> "Generator[None, None, None]":
    """The ASGI test client talks http://; force auth cookies to non-Secure/lax
    so it stores and resends them. A deploy/preview .env may set Secure +
    SameSite=None for cross-site HTTPS, which would otherwise make the http
    test client silently drop the cookie and break every login round-trip."""
    settings = get_settings()
    saved = (settings.cookie_secure, settings.cookie_samesite)
    settings.cookie_secure = False
    settings.cookie_samesite = "lax"
    yield
    settings.cookie_secure, settings.cookie_samesite = saved


#: When set, the whole suite runs against this PostgreSQL database instead of
#: in-memory SQLite.
#:
#: Not a nicety. SQLite cannot express a tsvector, a GIN index, a plpgsql
#: trigger or JSONB containment, so every test touching those takes a fallback
#: path and passes against code the production database never runs. That is not
#: theoretical: `GET /api/products?q=` shipped a 500 because the PostgreSQL
#: branch of the search builder had never been executed by anything, while 645
#: tests reported green.
#:
#: Marking individual tests for PostgreSQL is not enough on its own either --
#: a mark controls whether a test runs, not which database it runs against.
TEST_POSTGRES_URL = os.getenv("TEST_POSTGRES_URL")


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    if TEST_POSTGRES_URL:
        engine = create_async_engine(TEST_POSTGRES_URL, poolclass=NullPool)
        # Dropped as well as created: a real database persists between tests,
        # where the in-memory one is new every time. Without this the first
        # test to insert a product makes every later assertion about counts
        # depend on what ran before it.
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
    else:
        engine = create_async_engine(
            "sqlite+aiosqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session

    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Anonymous AsyncClient — no auth cookies. Use for public endpoints."""
    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db_session] = _override
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


def _set_csrf(ac: AsyncClient) -> None:
    """These fixtures inject the access-token cookie directly (bypassing a
    real /login round-trip), so they must also stand in for the CSRF
    cookie+header pair a real login response would set — otherwise every
    mutating call in the suite would 403 against the double-submit check in
    dependencies/auth.py."""
    token = "test-csrf-token"
    ac.cookies.set(CSRF_COOKIE, token)
    ac.headers[CSRF_HEADER] = token


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> User:
    """A persisted admin account."""
    user = User(
        email="admin@example.com",
        password_hash=hash_password("admin-password"),
        role=ROLE_ADMIN,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def admin_client(
    db_session: AsyncSession, admin_user: User
) -> AsyncGenerator[AsyncClient, None]:
    """AsyncClient carrying a valid admin access cookie — for write endpoints."""
    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db_session] = _override
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        ac.cookies.set(ACCESS_COOKIE, create_access_token(admin_user.id, admin_user.role))
        _set_csrf(ac)
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def customer_user(db_session: AsyncSession) -> User:
    """A persisted non-admin account."""
    user = User(
        email="customer@example.com",
        password_hash=hash_password("customer-password"),
        role=ROLE_CUSTOMER,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def customer_client(
    db_session: AsyncSession, customer_user: User
) -> AsyncGenerator[AsyncClient, None]:
    """AsyncClient signed in as a customer — proves admin gates reject non-admins."""
    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db_session] = _override
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        ac.cookies.set(ACCESS_COOKIE, create_access_token(customer_user.id, customer_user.role))
        _set_csrf(ac)
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def staff_user(db_session: AsyncSession) -> User:
    """A persisted fulfilment account — back office, no money."""
    user = User(
        email="staff@example.com",
        password_hash=hash_password("staff-password"),
        role=ROLE_STAFF,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def staff_client(
    db_session: AsyncSession, staff_user: User
) -> AsyncGenerator[AsyncClient, None]:
    """AsyncClient signed in as staff — proves the fulfilment/money split
    holds from the outside, not just in the dependency function."""
    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db_session] = _override
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        ac.cookies.set(ACCESS_COOKIE, create_access_token(staff_user.id, staff_user.role))
        _set_csrf(ac)
        yield ac
    app.dependency_overrides.clear()


# ---- Sync fixture for non-DB router tests (health, pricing, inventory, recommendation) ----
@pytest.fixture
def sync_client() -> "Iterator[TestClient]":
    from collections.abc import Iterator
    from fastapi.testclient import TestClient as _TC
    with _TC(app) as tc:
        yield tc
