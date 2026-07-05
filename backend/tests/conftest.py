"""Shared pytest fixtures.

Provides an in-memory SQLite async session (overriding the Postgres
dependency) and a `TestClient` wired to that override, so the full test
suite runs without any live Postgres/Redis/RabbitMQ connection.
"""
from collections.abc import AsyncGenerator, Iterator

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db_session
from app.main import app


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield an AsyncSession backed by a fresh in-memory SQLite database."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    await engine.dispose()


@pytest.fixture
def client(db_session: AsyncSession) -> Iterator[TestClient]:
    """Return a TestClient with the DB dependency overridden to use SQLite in-memory."""

    async def _override_get_db_session() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db_session] = _override_get_db_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
