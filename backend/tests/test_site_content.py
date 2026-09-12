"""The content document, and the flat homepage shape projected out of it.

What this phase is actually for: a second storefront should be able to render
this shop without copying `frontend/content/site.config.ts`. That means the API
has to serve the *whole* of the content -- brand, navigation, footer, policy
copy, homepage, SEO -- not a thin layer of overrides on top of a file only one
frontend has.

The risky part is not the new endpoint, it is the old one. `GET /api/sections`
is read on every storefront render and now returns a projection rather than a
table. These tests pin both: that the document is complete, and that the shape
the live site depends on did not move underneath it.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.audit_log import AuditLog
from app.models.site_content import SITE_KEY, SiteContent
from app.services.site_content import (
    HOMEPAGE_PATHS,
    apply_homepage,
    defaults,
    get_path,
    project_homepage,
    set_path,
)

# Everything a storefront needs to render the shop.
EXPECTED_SECTIONS = {
    "announcement",
    "brand",
    "contact",
    "footer",
    "home",
    "nav",
    "policies",
    "seo",
    "trustBadges",
}


# --------------------------------------------------------------------------
# The document itself
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_a_storefront_gets_the_whole_site_in_one_request(client: AsyncClient):
    """The point of the phase.

    If any of these sections were missing, a second frontend would have to get
    it from somewhere else -- which in practice means copying the config file,
    which is the coupling being removed.
    """
    body = (await client.get("/api/content/site")).json()

    assert set(body["document"]) == EXPECTED_SECTIONS
    assert body["document"]["brand"]["name"]
    assert body["document"]["nav"], "a storefront cannot render a header without navigation"
    assert body["document"]["policies"]["privacy"]


@pytest.mark.asyncio
async def test_the_document_is_public(client: AsyncClient):
    """A storefront renders it, and storefronts have no session."""
    assert (await client.get("/api/content/site")).status_code == 200


@pytest.mark.asyncio
async def test_a_fresh_database_serves_real_content_not_an_empty_object(
    client: AsyncClient, db_session
):
    """Seeded on first read.

    Returning `{}` until somebody visited the admin would push a "what if this
    is empty" branch into every consumer, which is the kind of emptiness that
    ends up rendered on a live page.
    """
    assert (await db_session.execute(select(SiteContent))).scalars().first() is None

    body = (await client.get("/api/content/site")).json()

    assert body["version"] == 1
    assert body["document"]["home"]["hero"]["headline"]


@pytest.mark.asyncio
async def test_an_unknown_key_is_a_404_and_creates_nothing(client: AsyncClient, db_session):
    """The path segment reaches a primary key.

    Without the allow-list, any string would seed a row on first read and a
    crawler probing /api/content/wp-admin would fill the table.
    """
    assert (await client.get("/api/content/wp-admin")).status_code == 404

    rows = (await db_session.execute(select(SiteContent))).scalars().all()
    assert [r.key for r in rows] == []


# --------------------------------------------------------------------------
# Writing
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_an_admin_can_replace_the_document(admin_client: AsyncClient):
    current = (await admin_client.get("/api/content/site")).json()
    document = {**current["document"], "brand": {**current["document"]["brand"], "name": "Renamed"}}

    resp = await admin_client.put("/api/content/site", json={"document": document})

    assert resp.status_code == 200
    assert resp.json()["document"]["brand"]["name"] == "Renamed"
    assert resp.json()["version"] == current["version"] + 1


@pytest.mark.asyncio
async def test_writing_is_admin_only(client: AsyncClient, staff_client: AsyncClient):
    """Content is the shop's public face. Staff pack orders."""
    assert (await client.put("/api/content/site", json={"document": {"a": 1}})).status_code == 401
    assert (
        await staff_client.put("/api/content/site", json={"document": {"a": 1}})
    ).status_code == 403


@pytest.mark.asyncio
async def test_a_stale_save_is_refused_rather_than_silently_winning(
    admin_client: AsyncClient,
):
    """Two admins, one page open each.

    Without the version check the second save overwrites the first with a copy
    of the page from before it existed, and nothing anywhere says so.
    """
    first = (await admin_client.get("/api/content/site")).json()
    await admin_client.put(
        "/api/content/site",
        json={"document": {**first["document"], "trustBadges": ["changed"]}},
    )

    resp = await admin_client.put(
        "/api/content/site",
        json={"document": first["document"], "expected_version": first["version"]},
    )

    assert resp.status_code == 409
    assert "changed by somebody else" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_a_save_without_a_version_still_works(admin_client: AsyncClient):
    """The check is opt-in. A caller that does not track versions -- a script,
    a migration -- should not have to invent one."""
    current = (await admin_client.get("/api/content/site")).json()

    resp = await admin_client.put("/api/content/site", json={"document": current["document"]})

    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_an_empty_document_is_refused(admin_client: AsyncClient):
    """It would blank the storefront, and is far likelier to be a bug in the
    caller than an intention."""
    resp = await admin_client.put("/api/content/site", json={"document": {}})

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_an_oversized_document_is_refused(admin_client: AsyncClient):
    """A content document is words and pictures, not storage."""
    resp = await admin_client.put(
        "/api/content/site", json={"document": {"blob": "x" * 600_000}}
    )

    assert resp.status_code == 413


@pytest.mark.asyncio
async def test_a_content_edit_is_audited_without_burying_the_log(
    admin_client: AsyncClient, db_session
):
    """The document is 22 KB. A full diff on every save would push the entries
    that say who refunded what off the first page of the activity log."""
    current = (await admin_client.get("/api/content/site")).json()
    await admin_client.put(
        "/api/content/site",
        json={"document": {**current["document"], "trustBadges": ["one"]}},
    )

    entry = (
        await db_session.execute(select(AuditLog).where(AuditLog.action == "content.update"))
    ).scalars().first()

    assert entry is not None
    assert entry.changes["sections"]["to"] == ["trustBadges"]
    assert len(str(entry.changes)) < 500


# --------------------------------------------------------------------------
# The projection the live storefront depends on
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_the_old_flat_shape_still_comes_back(client: AsyncClient):
    """Every storefront render reads this. Moving the storage underneath it
    must not move the contract on top of it."""
    body = (await client.get("/api/sections")).json()

    assert set(body) == set(HOMEPAGE_PATHS)
    assert body["hero_headline"]
    assert isinstance(body["announcement_messages"], list)


@pytest.mark.asyncio
async def test_editing_the_homepage_writes_into_the_document(admin_client: AsyncClient):
    """The two endpoints are two views of one thing, not two stores."""
    flat = (await admin_client.get("/api/sections")).json()

    await admin_client.put("/api/sections", json={**flat, "hero_headline": "A new headline"})

    document = (await admin_client.get("/api/content/site")).json()["document"]
    assert document["home"]["hero"]["headline"] == "A new headline"


@pytest.mark.asyncio
async def test_clearing_a_field_restores_the_shipped_copy(admin_client: AsyncClient):
    """The behaviour that looks like a change and is not.

    Null used to mean "no override, fall through to the config file". There is
    nothing to fall through to now, so null writes the packaged default back
    instead. Skipping nulls would have been the quiet bug: the field would keep
    its current value and the admin would think clearing it had failed.
    """
    flat = (await admin_client.get("/api/sections")).json()
    await admin_client.put("/api/sections", json={**flat, "hero_headline": "Temporary"})

    cleared = await admin_client.put("/api/sections", json={**flat, "hero_headline": None})

    assert cleared.json()["hero_headline"] == get_path(
        defaults(), ("home", "hero", "headline")
    )
    assert cleared.json()["hero_headline"] != "Temporary"


@pytest.mark.asyncio
async def test_a_homepage_edit_does_not_flatten_the_rest_of_the_document(
    admin_client: AsyncClient,
):
    """The projection touches a couple of dozen paths. Everything else -- nav,
    footer, policies -- has to survive a homepage save untouched."""
    before = (await admin_client.get("/api/content/site")).json()["document"]
    flat = (await admin_client.get("/api/sections")).json()

    await admin_client.put("/api/sections", json={**flat, "hero_headline": "Changed"})

    after = (await admin_client.get("/api/content/site")).json()["document"]
    assert after["nav"] == before["nav"]
    assert after["footer"] == before["footer"]
    assert after["policies"] == before["policies"]


@pytest.mark.asyncio
async def test_a_real_homepage_edit_does_bump_the_version(admin_client: AsyncClient):
    """The two editors share one version counter.

    A homepage save that left the version alone would be invisible to the
    content editor's staleness check -- somebody with the full document open
    would save over the new headline and be told nothing.
    """
    before = (await admin_client.get("/api/content/site")).json()["version"]
    flat = (await admin_client.get("/api/sections")).json()

    await admin_client.put("/api/sections", json={**flat, "hero_headline": "Moved"})

    assert (await admin_client.get("/api/content/site")).json()["version"] == before + 1


@pytest.mark.asyncio
async def test_a_homepage_save_that_changes_nothing_does_not_bump_the_version(
    admin_client: AsyncClient,
):
    """Otherwise an editor left open is told it went stale by a save that
    changed nothing."""
    flat = (await admin_client.get("/api/sections")).json()
    before = (await admin_client.get("/api/content/site")).json()["version"]

    await admin_client.put("/api/sections", json=flat)

    assert (await admin_client.get("/api/content/site")).json()["version"] == before


# --------------------------------------------------------------------------
# The mapping itself
# --------------------------------------------------------------------------


def test_every_mapped_path_exists_in_the_defaults():
    """A path with a typo reads None forever and writes into a branch nobody
    renders -- it fails silently in both directions, which is why it is checked
    against the real document rather than trusted."""
    packaged = defaults()
    missing = [
        field for field, path in HOMEPAGE_PATHS.items() if get_path(packaged, path) is None
    ]
    assert missing == []


def test_defaults_cannot_be_corrupted_by_a_caller():
    """The parsed file is cached for the life of the process, so a caller that
    mutated it would poison every later request, not just its own."""
    first = defaults()
    first["brand"]["name"] = "Mutated"

    assert defaults()["brand"]["name"] != "Mutated"


def test_set_path_creates_missing_branches():
    """A document seeded before a section existed still has to accept a value
    for it."""
    document: dict = {}
    set_path(document, ("home", "hero", "headline"), "Hello")

    assert document == {"home": {"hero": {"headline": "Hello"}}}


def test_get_path_returns_none_rather_than_raising_on_a_missing_branch():
    assert get_path({"home": {}}, ("home", "hero", "headline")) is None
    assert get_path({"home": "not-a-dict"}, ("home", "hero")) is None


def test_apply_homepage_leaves_the_original_document_alone():
    """Callers compare before and after to build the audit diff; mutating in
    place would make the two identical and the log empty."""
    original = defaults()
    apply_homepage(original, {"hero_headline": "Changed"})

    assert get_path(original, ("home", "hero", "headline")) != "Changed"


def test_the_projection_round_trips():
    document = defaults()
    flat = project_homepage(document)

    assert project_homepage(apply_homepage(document, flat)) == flat
