"""Shared pytest fixtures.

In-memory SQLite async session overrides the Postgres dependency — full
test suite runs without live infrastructure.
"""
from collections.abc import AsyncGenerator, Generator

import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool, StaticPool

from app.config import get_settings
from app.db import Base, get_db_session
from app.dependencies.auth import ACCESS_COOKIE, CSRF_COOKIE, CSRF_HEADER
from app.main import app
from app.models.user import ROLE_ADMIN, ROLE_CUSTOMER, ROLE_STAFF, User
from app.services import login_throttle, serviceability
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
def _deliver_everywhere(monkeypatch) -> "Generator[None, None, None]":
    """The shop only delivers to Bengaluru; this suite mostly is not about that.

    Left on, the delivery-area gate would quietly rewrite the meaning of tests
    that use an out-of-area address to check something else entirely -- the
    inter-state GST tests need a Kerala address precisely because it is not in
    Karnataka, and an order-snapshot test uses Mumbai because any address will
    do. Those would start failing with a 409 about the waitlist, which says
    nothing about invoicing.

    So the default posture here is "delivers everywhere", and the tests that
    are about the delivery area turn it back on explicitly. Same reasoning as
    the cookie fixture above: neutralise the environment, then let the tests
    that care set it themselves.
    """
    monkeypatch.setattr(
        serviceability,
        "area_from_document",
        lambda document: serviceability.Area(limited=False, districts=frozenset()),
    )
    yield

@pytest.fixture(autouse=True)
def _http_test_cookies() -> "Generator[None, None, None]":
    """The ASGI test client talks http:// to a host called `test`; force the
    auth cookies to attributes that host can actually accept, so it stores and
    resends them.

    A deploy environment sets Secure + a real cookie domain, and every one of
    those attributes makes the http test client silently drop the cookie --
    silently being the problem, since the response is still a 200 and the
    failure surfaces much later as an unexplained 401.

    `cookie_domain` is the one that is easiest to miss, because it only bites
    when the suite runs somewhere that has production settings loaded. Running
    the whole suite on the production droplet failed 14 auth tests for exactly
    this reason and for no other: `Domain=.savvyinteal.com` does not match a
    request to `http://test`, so http.cookiejar discarded all three cookies and
    `resp.cookies` came back empty. Neutralise it here rather than at 14 call
    sites, and the suite stops depending on where it is run."""
    settings = get_settings()
    saved = (settings.cookie_secure, settings.cookie_samesite, settings.cookie_domain)
    settings.cookie_secure = False
    settings.cookie_samesite = "lax"
    settings.cookie_domain = ""
    yield
    settings.cookie_secure, settings.cookie_samesite, settings.cookie_domain = saved


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


#: Set once the PostgreSQL schema exists for this pytest process.
_postgres_schema_ready = False
_pg_engine = None


def _postgres_engine():
    """One engine for the whole run, still one connection per test."""
    global _pg_engine
    if _pg_engine is None:
        _pg_engine = create_async_engine(TEST_POSTGRES_URL, poolclass=NullPool)
    return _pg_engine


async def _empty_postgres(engine) -> None:
    """Hand the next test an empty database, without rebuilding the schema.

    A real database persists between tests where the in-memory one is new every
    time, so something has to clear it or the first test to insert a product
    makes every later assertion about counts depend on what ran before it.

    That used to be `drop_all` + `create_all` per test: 22 tables with their
    indexes and constraints, built and torn down 652 times. Emptying the tables
    instead gets to the same place for a fraction of the work, and building the
    schema once is the right shape regardless of what it saves.

    Safe here specifically because no test alters this schema: the append-only
    trigger test builds its own private schema, and the migration test runs
    against its own throwaway SQLite file. If that ever stops being true, this
    has to go back to recreating.

    DELETE rather than TRUNCATE, which is the opposite of the usual advice and
    was measured, not assumed. These tables hold a handful of rows each, so
    there is nothing for TRUNCATE's file-level work to pay off against, while
    it still takes an ACCESS EXCLUSIVE lock on all 22. On one file: 84.75s per
    test-recreate, 74.39s with DELETE, 70.58s once the engine stopped being
    rebuilt per test.

    What this did *not* fix is worth recording, because both were the obvious
    suspect and both were wrong. The per-test DDL was not the dominant cost --
    removing it took the full suite from 16m28s to 13m10s, not to anything near
    SQLite's two minutes. Nor was commit fsync: `synchronous_commit = off` on
    the test database changed a 74.39s file to 73.31s, which is noise. The full
    suite now runs 652 tests against real PostgreSQL in 11m29s, a 30% cut, and
    the remaining gap over SQLite is spread across connection setup and
    per-statement overhead rather than sitting anywhere that can be removed.

    So this is why CI still names a file list rather than running everything
    here: 11m29s per push is a real cost, and the files SQLite genuinely cannot
    speak for are a small subset of the suite.
    """
    global _postgres_schema_ready

    async with engine.begin() as conn:
        if not _postgres_schema_ready:
            # Dropped as well as created: the database may be left over from a
            # run of older code, and a stale column is a worse failure than a
            # slow one because it looks like a bug in the test.
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
            _postgres_schema_ready = True
            return  # freshly created, so already empty

        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(text(f'DELETE FROM "{table.name}"'))


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    if TEST_POSTGRES_URL:
        engine = _postgres_engine()
        await _empty_postgres(engine)
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

    if not TEST_POSTGRES_URL:
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
