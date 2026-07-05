"""Async SQLAlchemy engine/session setup.

The engine is created lazily and is never connected to during import or
unit tests of pure-logic modules -- creating an `AsyncEngine` object does
not open a network connection until a session actually executes a query.
This lets the app boot and be tested on machines without Postgres running.
"""
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""


def create_engine() -> AsyncEngine:
    """Create (but do not connect) the async SQLAlchemy engine."""
    settings = get_settings()
    # ponytail: echo=debug only — SQL logging in prod is a perf hit and a log-injection risk
    return create_async_engine(settings.database_url, echo=settings.debug, future=True)


engine: AsyncEngine = create_engine()
async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding an AsyncSession, closed after the request."""
    async with async_session_factory() as session:
        yield session
