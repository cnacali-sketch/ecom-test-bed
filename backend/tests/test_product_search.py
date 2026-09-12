"""Searching the catalogue from the server.

Search has always run in the browser -- the storefront downloads every product
and substring-matches it. Moving it here is mostly about reuse: a second
storefront should not have to reimplement matching and ranking in its own
JavaScript.

Two of these run on PostgreSQL only. Stemming and relevance ranking are the
whole reason for using a tsvector rather than a LIKE, and SQLite -- which this
suite otherwise runs on -- can express neither. Skipping them quietly would
mean the features nobody can test are exactly the ones that justify the change,
so they are marked and CI runs them against a real database.
"""
import os
import uuid
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product

POSTGRES_URL = os.getenv("TEST_POSTGRES_URL")
needs_postgres = pytest.mark.skipif(
    not POSTGRES_URL,
    reason="Stemming and ts_rank need PostgreSQL; set TEST_POSTGRES_URL. CI does.",
)


def _product(**overrides) -> Product:
    attrs = {"type": "Claw Clip", "material": "Acetate", "tags": ["everyday"]}
    attrs.update(overrides.pop("attrs", {}))
    defaults = dict(
        id=uuid.uuid4(),
        sku=f"SRCH-{uuid.uuid4().hex[:8]}",
        slug=f"slug-{uuid.uuid4().hex[:8]}",
        name="Tortoise Claw Clip",
        price=Decimal("499.00"),
        mrp=Decimal("699.00"),
        in_stock=True,
        description="A sturdy clip.",
        attrs=attrs,
    )
    defaults.update(overrides)
    return Product(**defaults)


@pytest_asyncio.fixture(autouse=True)
async def _catalogue(db_session: AsyncSession):
    db_session.add_all(
        [
            _product(
                name="Tortoise Claw Clip",
                description="A wide steel spring for thick hair.",
                attrs={"type": "Claw Clip", "material": "Acetate", "tags": ["tortoise"]},
            ),
            _product(
                name="Mulberry Silk Scrunchie",
                description="Gentle on hair overnight.",
                attrs={"type": "Scrunchie", "material": "Silk", "tags": ["gift"]},
            ),
            _product(
                name="Gold Hoop Earrings",
                description="Brass core, gold plated. Comes in a silk pouch.",
                attrs={"type": "Earrings", "material": "Brass", "tags": ["jewellery"]},
            ),
        ]
    )
    await db_session.commit()


async def _search(client: AsyncClient, query: str) -> list[str]:
    resp = await client.get(f"/api/products?q={query}")
    assert resp.status_code == 200
    return [p["name"] for p in resp.json()]


# --------------------------------------------------------------------------
# Matching
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_a_product_is_found_by_its_name(client: AsyncClient):
    assert "Mulberry Silk Scrunchie" in await _search(client, "scrunchie")


@pytest.mark.asyncio
async def test_a_product_is_found_by_its_material(client: AsyncClient):
    """Material lives in the attrs blob, which no query could reach before."""
    assert "Gold Hoop Earrings" in await _search(client, "brass")


@pytest.mark.asyncio
async def test_a_product_is_found_by_a_curation_tag(client: AsyncClient):
    assert "Tortoise Claw Clip" in await _search(client, "tortoise")


@pytest.mark.asyncio
async def test_every_word_has_to_match_something(client: AsyncClient):
    """The rule the browser-side matcher used, kept.

    Without it, searching two words returns everything matching either, and a
    more specific search returns more results than a vaguer one.
    """
    assert await _search(client, "silk scrunchie") == ["Mulberry Silk Scrunchie"]


@pytest.mark.asyncio
async def test_words_can_be_typed_in_any_order(client: AsyncClient):
    """The bug this search came from originally: "1 rs" not finding
    "TEST Payment Verification Rs 1"."""
    assert await _search(client, "clip claw") == ["Tortoise Claw Clip"]


@pytest.mark.asyncio
async def test_search_is_case_insensitive(client: AsyncClient):
    assert "Mulberry Silk Scrunchie" in await _search(client, "SILK")


@pytest.mark.asyncio
async def test_a_query_matching_nothing_returns_an_empty_list(client: AsyncClient):
    """Not an error, and not the whole catalogue. Both would be worse: one
    makes a normal search look broken, the other hides that it found nothing."""
    assert await _search(client, "helicopter") == []


@pytest.mark.asyncio
async def test_no_query_lists_the_catalogue(client: AsyncClient):
    """An empty search box shows the shop, not an empty shop."""
    assert len((await client.get("/api/products")).json()) == 3


@pytest.mark.asyncio
async def test_a_single_character_is_not_treated_as_a_search(client: AsyncClient):
    """One letter matches half the catalogue and ranks it arbitrarily, which
    reads as a broken search rather than a broad one.

    Searched for a letter that appears in *no* product on purpose. Using a
    common letter would pass whether or not the guard exists, because
    everything matches it either way -- the test would assert nothing.
    """
    assert len(await _search(client, "z")) == 3


@pytest.mark.asyncio
async def test_search_combines_with_the_stock_filter(client: AsyncClient, db_session):
    """Filters have to compose, or the storefront cannot offer both at once."""
    db_session.add(_product(name="Sold Out Silk Ribbon", in_stock=False,
                            attrs={"material": "Silk", "type": "Ribbon", "tags": []}))
    await db_session.commit()

    resp = await client.get("/api/products?q=silk&in_stock=true")

    names = [p["name"] for p in resp.json()]
    assert "Sold Out Silk Ribbon" not in names
    assert "Mulberry Silk Scrunchie" in names


@pytest.mark.asyncio
async def test_a_quote_in_the_query_does_not_break_the_endpoint(client: AsyncClient):
    """The query reaches the database as a bound parameter. A search box is
    public and unauthenticated, so it is the obvious place to try an injection."""
    resp = await client.get("/api/products?q=%27%3B%20DROP%20TABLE%20products%3B--")

    assert resp.status_code == 200
    assert (await client.get("/api/products")).status_code == 200


# --------------------------------------------------------------------------
# The collection filter, which was quietly wrong
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_a_collection_filter_is_not_cut_short_by_the_page_size(
    client: AsyncClient, db_session
):
    """It used to run in Python *after* the page had been limited to 48 rows.

    So asking for one collection returned only its members that happened to be
    among the 48 newest products, and silently dropped the others. Invisible at
    thirty-three products; wrong the moment there are more.
    """
    for index in range(12):
        db_session.add(
            _product(
                name=f"Filler {index}",
                attrs={"collectionSlugs": ["other"], "type": "Filler", "tags": []},
            )
        )
    db_session.add(
        _product(
            name="Needle In A Haystack",
            attrs={"collectionSlugs": ["jewellery"], "type": "Ring", "tags": []},
        )
    )
    await db_session.commit()

    resp = await client.get("/api/products?collection=jewellery&limit=5")

    assert [p["name"] for p in resp.json()] == ["Needle In A Haystack"]


@pytest.mark.asyncio
async def test_a_collection_filter_does_not_match_a_longer_slug(
    client: AsyncClient, db_session
):
    """"hair" must not match "hair-accessories". An unquoted substring match
    would put every accessory into a collection nobody asked for."""
    db_session.add(
        _product(name="Accessory", attrs={"collectionSlugs": ["hair-accessories"], "tags": []})
    )
    await db_session.commit()

    assert (await client.get("/api/products?collection=hair")).json() == []


# --------------------------------------------------------------------------
# PostgreSQL only: the reasons for using a tsvector at all
# --------------------------------------------------------------------------


@needs_postgres
@pytest.mark.asyncio
async def test_a_plural_finds_the_singular(client: AsyncClient):
    """Stemming. "scrunchies" has to find "Scrunchie", which is the single
    most common way a shopper types a search and the thing a LIKE cannot do."""
    assert "Mulberry Silk Scrunchie" in await _search(client, "scrunchies")


@needs_postgres
@pytest.mark.asyncio
async def test_the_name_outranks_a_passing_mention(client: AsyncClient):
    """A search for "silk" should lead with the silk scrunchie, not with the
    earrings whose description happens to mention a silk pouch. Without
    weighting the two are indistinguishable, and the shop's own best answer
    turns up second."""
    assert (await _search(client, "silk"))[0] == "Mulberry Silk Scrunchie"
