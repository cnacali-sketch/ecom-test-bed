"""Create the local development database.

The alembic migrations are written against Postgres (JSONB, server defaults),
so they cannot build a SQLite file. The models themselves are portable —
`JSONB().with_variant(JSON(), "sqlite")` is already how the test suite runs
without Postgres — so a plain `create_all` produces a usable dev database.

This is deliberately *not* a substitute for alembic. Production migrates; this
script only bootstraps a throwaway local file.

Usage (from backend/, with .env pointing DATABASE_URL at SQLite):
    .venv/Scripts/python scripts/dev_bootstrap.py
"""
import asyncio
import sys
from pathlib import Path

# Running a file inside scripts/ puts scripts/ on sys.path, not backend/, so
# `import app` fails. Add the package root explicitly rather than depending on
# PYTHONPATH being set by the caller.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Importing the app registers every model on Base.metadata via the routers.
# Without it create_all would emit an empty schema.
import app.main  # noqa: E402,F401
from app.config import get_settings
from app.db import Base, engine


async def main() -> None:
    settings = get_settings()
    if "sqlite" not in settings.database_url:
        sys.exit(
            f"Refusing to run create_all against {settings.database_url.split('://')[0]}. "
            "This script is for the local SQLite database only — real databases use alembic."
        )

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    await engine.dispose()
    print(f"Created {len(Base.metadata.tables)} tables in {settings.database_url}")


if __name__ == "__main__":
    asyncio.run(main())
