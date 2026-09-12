"""Finding products in the database instead of in the browser.

Product search has always run client-side: `frontend/lib/search.ts` downloads
the whole catalogue and substring-matches it. That works at thirty-three
products and stops working in two ways as the shop grows -- the page ships the
entire catalogue to every visitor who opens the search box, and the matching is
naive substring, so "clip" finds "paperclip" and nothing is ranked.

The reason to move it now is not speed. It is that a second storefront would
otherwise have to reimplement all of this in its own JavaScript, which is the
coupling the content document was moved to remove.

**One definition of the vector, used twice.** The expression below builds the
searchable text, and both the GIN index and the query are generated from this
same string. If they drift by so much as a `coalesce`, Postgres silently stops
using the index and falls back to a sequential scan -- which at this size looks
exactly like it working.

**Weights are about what a shopper means.** A search for "silk" should put the
silk scrunchie above a claw clip whose description happens to mention silk.
So the name outranks the material, which outranks the description:

    A  name          what the thing is called
    B  type, material, sku
    C  tags          curation, not description
    D  description   prose, where anything might be mentioned in passing
"""
from __future__ import annotations

from sqlalchemy import Text, func, literal_column
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product

#: The text configuration. Fixed rather than derived from a locale: 'english'
#: gives stemming ("scrunchies" finds "scrunchie") and stop-word removal, and
#: the catalogue is written in English regardless of where it ships.
TEXT_CONFIG = "english"

#: The searchable document, as a SQL expression over one `products` row.
#:
#: Every field is coalesced because a null anywhere makes the whole
#: concatenation null -- one product with no description would otherwise become
#: invisible to search rather than merely unmatched on that field.
#:
#: `attrs->>'tags'` yields the raw JSON array text. to_tsvector discards the
#: brackets and quotes as punctuation, so ["tortoise","grip"] lexes to the two
#: words, which is what is wanted without needing to unnest anything -- and
#: unnesting is not available inside an index expression anyway.
SEARCH_VECTOR_SQL = (
    f"setweight(to_tsvector('{TEXT_CONFIG}', coalesce(products.name, '')), 'A') || "
    f"setweight(to_tsvector('{TEXT_CONFIG}', coalesce(products.attrs->>'type', '')), 'B') || "
    f"setweight(to_tsvector('{TEXT_CONFIG}', coalesce(products.attrs->>'material', '')), 'B') || "
    f"setweight(to_tsvector('{TEXT_CONFIG}', coalesce(products.sku, '')), 'B') || "
    f"setweight(to_tsvector('{TEXT_CONFIG}', coalesce(products.attrs->>'tags', '')), 'C') || "
    f"setweight(to_tsvector('{TEXT_CONFIG}', coalesce(products.description, '')), 'D')"
)

#: The index name, shared by the migration and by anything checking it exists.
SEARCH_INDEX_NAME = "ix_products_search_vector"

#: Shorter than this and a search is mostly noise: a single letter matches
#: half the catalogue and ranks it arbitrarily. Mirrors MIN_QUERY_LENGTH in
#: the frontend's search module so both agree on what counts as a query.
MIN_QUERY_LENGTH = 2


def is_postgres(db: AsyncSession) -> bool:
    return db.get_bind().dialect.name == "postgresql"


def _fallback_clause(query: str):
    """Substring matching, for SQLite.

    The test suite runs on SQLite, which has no tsvector. This is not trying to
    be full-text search -- it is trying to agree with it on which products
    match, so a test written here still means something about production.

    Every term must appear somewhere, which is the same rule the browser-side
    matcher used and the same one `websearch_to_tsquery` applies by default.
    What it cannot reproduce is stemming or ranking, and the tests that cover
    those are marked for PostgreSQL.
    """
    clauses = []
    for term in query.split():
        pattern = f"%{term.lower()}%"
        haystack = func.lower(
            func.coalesce(Product.name, "")
            + " "
            + func.coalesce(Product.sku, "")
            + " "
            + func.coalesce(Product.description, "")
            + " "
            + func.coalesce(func.cast(Product.attrs, Text), "")
        )
        clauses.append(haystack.like(pattern))
    return clauses


def apply_search(statement, db: AsyncSession, query: str):
    """Narrow `statement` to products matching `query`, best first.

    Returns the statement unchanged for a query too short to mean anything --
    an empty search box should list the catalogue, not nothing.
    """
    query = (query or "").strip()
    if len(query) < MIN_QUERY_LENGTH:
        return statement

    if not is_postgres(db):
        for clause in _fallback_clause(query):
            statement = statement.where(clause)
        return statement

    # literal_column, not text(): a TextClause is an opaque fragment with no
    # column semantics, so it has no `bool_op` and the @@ operator cannot be
    # built from it. Typing it as TSVECTOR also lets SQLAlchemy render the
    # comparison without casting.
    vector = literal_column(f"({SEARCH_VECTOR_SQL})", TSVECTOR)
    # websearch_to_tsquery rather than plainto_tsquery: it understands quoted
    # phrases and a leading minus, which is what people already type into a
    # search box, and it never raises on malformed input the way to_tsquery
    # does. Bound as a parameter, so the query text is data.
    tsquery = func.websearch_to_tsquery(TEXT_CONFIG, query)
    return statement.where(vector.bool_op("@@")(tsquery)).order_by(
        func.ts_rank(vector, tsquery).desc()
    )
