"""Index the catalogue so search can run in the database.

Product search has run in the browser: the storefront downloads every product
and substring-matches it. This adds the index that lets `GET /api/products?q=`
do the work instead.

**A functional index, not a generated column.** Storing a `tsvector` column
would be marginally faster to query and would also mean adding a Postgres-only
type to a model that has to keep working on SQLite, where the test suite runs.
An index over the expression needs no column, no model change, and nothing for
`alembic autogenerate` to later propose dropping -- which is exactly how a
missing model registration nearly dropped a live table earlier in this project.

**The expression is imported, not restated.** The index and the query have to
be character-for-character identical or Postgres quietly ignores the index and
sequential-scans instead. At thirty-three products that is indistinguishable
from working, so the mistake would not surface until it mattered. Both sides
are generated from `SEARCH_VECTOR_SQL`.

PostgreSQL only. SQLite has no full-text vector of this kind; the router falls
back to substring matching there, which is what the tests exercise.

Revision ID: f6b8d0e2a4c7
Revises: e5a7c9d1f3b6
Create Date: 2026-09-13
"""
from alembic import op

revision = "f6b8d0e2a4c7"
down_revision = "e5a7c9d1f3b6"
branch_labels = None
depends_on = None

from app.services.search import SEARCH_INDEX_NAME, SEARCH_VECTOR_SQL  # noqa: E402


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    # One statement per execute: asyncpg refuses more than one command in a
    # prepared statement, which is how a migration that passed a manual psql
    # check still failed on deploy earlier in this project.
    op.execute(
        f"CREATE INDEX {SEARCH_INDEX_NAME} ON products USING GIN (({SEARCH_VECTOR_SQL}))"
    )


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute(f"DROP INDEX IF EXISTS {SEARCH_INDEX_NAME}")
