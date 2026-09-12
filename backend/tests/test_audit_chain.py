"""The audit log's tamper evidence.

These tests are about a specific threat: somebody with database access editing
the log to hide what they did. The trigger stops the casual version of that and
is tested separately (it needs Postgres). What is tested here is the case the
trigger cannot cover — an attacker who can drop the trigger, edit, and put it
back. The chain is what makes that visible afterwards.

Because SQLite has no trigger, these tests can tamper freely, which is exactly
what makes it the right place to prove the detection works.
"""
import os
import uuid
from pathlib import Path

import pytest
from sqlalchemy import delete, select, update

from app.models.audit_log import AuditLog
from app.services.audit import SYSTEM_RAZORPAY, SystemActor, entry_hash, record


async def _write(db, actor, summary: str) -> AuditLog:
    entry = await record(
        db,
        actor=actor,
        action="order.status",
        entity_type="order",
        summary=summary,
    )
    await db.commit()
    return entry


async def _all(db) -> list[AuditLog]:
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.asc(), AuditLog.id.asc())
    )
    return list(result.scalars().all())


# --------------------------------------------------------------------------
# Building the chain
# --------------------------------------------------------------------------


async def test_the_first_entry_is_a_genesis_row(db_session, admin_user):
    """Exactly one row in the table has nothing before it."""
    entry = await _write(db_session, admin_user, "first thing that ever happened")

    assert entry.prev_id is None
    assert entry.prev_hash is None
    assert len(entry.entry_hash) == 64


async def test_each_entry_links_to_the_one_before_it(db_session, admin_user):
    first = await _write(db_session, admin_user, "first")
    second = await _write(db_session, admin_user, "second")

    assert second.prev_id == first.id
    assert second.prev_hash == first.entry_hash


async def test_entries_written_in_one_transaction_still_chain(db_session, admin_user):
    """The fork case that motivated storing the link rather than deriving it.

    A bulk status update writes several entries before a single commit. If the
    second one read the tip from the database it would not see the first —
    still pending in the session — and both would claim the same predecessor.
    """
    a = await record(
        db_session, actor=admin_user, action="order.status", entity_type="order", summary="a"
    )
    b = await record(
        db_session, actor=admin_user, action="order.status", entity_type="order", summary="b"
    )
    c = await record(
        db_session, actor=admin_user, action="order.status", entity_type="order", summary="c"
    )
    await db_session.commit()

    assert b.prev_id == a.id
    assert c.prev_id == b.id
    assert len({a.entry_hash, b.entry_hash, c.entry_hash}) == 3


async def test_two_identical_actions_hash_differently(db_session, admin_user):
    """Otherwise an attacker could swap one entry for another verbatim copy."""
    first = await _write(db_session, admin_user, "same wording")
    second = await _write(db_session, admin_user, "same wording")

    assert first.entry_hash != second.entry_hash


async def test_changing_any_field_changes_the_hash(db_session, admin_user):
    entry = await _write(db_session, admin_user, "refunded 200.00")
    original = entry.entry_hash

    entry.summary = "refunded 20.00"
    assert entry_hash(entry, entry.prev_hash) != original


# --------------------------------------------------------------------------
# A non-human actor
# --------------------------------------------------------------------------


async def test_a_webhook_is_not_attributed_to_a_person(db_session):
    """The dangerous default: blaming whoever logged in most recently.

    Razorpay marks an order paid with nobody signed in. An entry naming a real
    admin for that would be a confident lie in the one record meant to settle
    arguments.
    """
    entry = await _write(db_session, SYSTEM_RAZORPAY, "Payment captured")

    assert entry.actor_id is None
    assert entry.actor_role == "system"
    assert entry.actor_email == "razorpay@webhook"


async def test_the_system_actor_role_fits_the_column(db_session):
    """actor_role is String(16); a longer role would truncate or error."""
    assert len(SystemActor(email="x@y").role) <= 16


# --------------------------------------------------------------------------
# Verification
# --------------------------------------------------------------------------


async def test_an_untouched_chain_verifies(admin_client, db_session, admin_user):
    for n in range(4):
        await _write(db_session, admin_user, f"entry {n}")

    res = await admin_client.get("/api/audit/verify")

    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["checked"] == 4
    assert body["first_broken_id"] is None


async def test_an_empty_log_verifies_rather_than_erroring(admin_client):
    res = await admin_client.get("/api/audit/verify")

    assert res.status_code == 200
    assert res.json() == {
        "ok": True,
        "checked": 0,
        "first_broken_id": None,
        "unverifiable": 0,
        "detail": "The log is empty.",
    }


async def test_an_edited_entry_is_caught(admin_client, db_session, admin_user):
    """The whole point of the mechanism."""
    await _write(db_session, admin_user, "Refunded 4999.00 to the customer")
    target = (await _all(db_session))[0]

    # Straight past the ORM, as somebody with a psql prompt would.
    await db_session.execute(
        update(AuditLog).where(AuditLog.id == target.id).values(summary="Adjusted a note")
    )
    await db_session.commit()

    body = (await admin_client.get("/api/audit/verify")).json()

    assert body["ok"] is False
    assert body["first_broken_id"] == str(target.id)
    assert "altered" in body["detail"]


async def test_an_edit_to_the_money_in_changes_is_caught(admin_client, db_session, admin_user):
    """`changes` is where the actual numbers live, so it must be hashed too."""
    await record(
        db_session,
        actor=admin_user,
        action="order.refund",
        entity_type="order",
        summary="Refunded",
        changes={"refund_amount": {"from": "0.00", "to": "4999.00"}},
    )
    await db_session.commit()
    target = (await _all(db_session))[0]

    await db_session.execute(
        update(AuditLog)
        .where(AuditLog.id == target.id)
        .values(changes={"refund_amount": {"from": "0.00", "to": "49.00"}})
    )
    await db_session.commit()

    assert (await admin_client.get("/api/audit/verify")).json()["ok"] is False


async def test_a_deleted_middle_entry_is_caught(admin_client, db_session, admin_user):
    """A rehash alone would miss this — every surviving row is still intact.

    Removing the evidence entirely is the more obvious way to cover tracks than
    editing it, and it is only visible because each row records which row it
    was appended after.
    """
    for n in range(3):
        await _write(db_session, admin_user, f"entry {n}")
    middle = (await _all(db_session))[1]

    await db_session.execute(delete(AuditLog).where(AuditLog.id == middle.id))
    await db_session.commit()

    body = (await admin_client.get("/api/audit/verify")).json()

    assert body["ok"] is False
    assert "no longer in the table" in body["detail"]


async def test_an_edit_with_a_recomputed_hash_is_still_caught(
    admin_client, db_session, admin_user
):
    """The attacker who knows how the hash is computed.

    Editing a row and recomputing *that row's* hash defeats the rehash check —
    the row is internally consistent again. What it cannot quietly fix is the
    next row, which still carries the old hash as its `prev_hash`. Catching
    this is the entire reason entries store a link and not just a checksum.

    The honest limit, stated so nobody mistakes this for more than it is:
    somebody who rewrites *every* subsequent hash produces a chain that
    verifies. Detecting that needs an anchor outside this database — an
    off-site copy, or a periodically published digest.
    """
    await _write(db_session, admin_user, "Refunded 4999.00")
    await _write(db_session, admin_user, "next thing")
    first = (await _all(db_session))[0]

    first.summary = "Refunded 49.00"
    forged = entry_hash(first, first.prev_hash)
    await db_session.execute(
        update(AuditLog)
        .where(AuditLog.id == first.id)
        .values(summary="Refunded 49.00", entry_hash=forged)
    )
    await db_session.commit()

    body = (await admin_client.get("/api/audit/verify")).json()

    assert body["ok"] is False
    assert "link" in body["detail"]


async def test_an_entry_written_before_hashing_is_unverifiable_not_broken(
    admin_client, db_session, admin_user
):
    """"We cannot prove this is untouched" is not "this was tampered with".

    Conflating them would make the first ever verification cry wolf on rows
    that predate the mechanism, and an alarm that is wrong the first time is
    an alarm nobody reads the second time.
    """
    await _write(db_session, admin_user, "written before the chain existed")
    legacy = (await _all(db_session))[0]
    await db_session.execute(
        update(AuditLog).where(AuditLog.id == legacy.id).values(entry_hash="")
    )
    await db_session.commit()

    body = (await admin_client.get("/api/audit/verify")).json()

    assert body["ok"] is True
    assert body["unverifiable"] == 1


async def test_verification_is_admin_only(staff_client, customer_client, client):
    """Staff pack orders; whether the log has been tampered with is not theirs."""
    assert (await staff_client.get("/api/audit/verify")).status_code == 403
    assert (await customer_client.get("/api/audit/verify")).status_code == 403
    assert (await client.get("/api/audit/verify")).status_code == 401


# --------------------------------------------------------------------------
# Filters
# --------------------------------------------------------------------------


async def test_the_feed_can_be_filtered_by_actor_email(admin_client, db_session, admin_user):
    """Somebody investigating has an email to hand, not a UUID."""
    await _write(db_session, admin_user, "by the admin")
    await _write(db_session, SystemActor(email="priya@savvyinteal.com", role="staff"), "by priya")

    res = await admin_client.get("/api/audit?actor=PRIYA@savvyinteal.com")

    assert res.status_code == 200
    assert [e["summary"] for e in res.json()] == ["by priya"]


async def test_the_actor_filter_is_a_partial_match(admin_client, db_session, admin_user):
    await _write(db_session, SystemActor(email="priya@savvyinteal.com", role="staff"), "hers")

    assert len((await admin_client.get("/api/audit?actor=priya")).json()) == 1


async def test_a_date_window_includes_its_last_day(admin_client, db_session, admin_user):
    """The half-open window trap: `<= end` stops at midnight and drops a day."""
    entry = await _write(db_session, admin_user, "today's action")
    day = entry.created_at.date().isoformat()

    res = await admin_client.get(f"/api/audit?start={day}&end={day}")

    assert [e["summary"] for e in res.json()] == ["today's action"]


async def test_a_window_that_ends_before_the_entry_returns_nothing(
    admin_client, db_session, admin_user
):
    entry = await _write(db_session, admin_user, "today's action")
    day = entry.created_at.date()
    before = day.replace(day=1) if day.day > 1 else day

    res = await admin_client.get(f"/api/audit?start=2020-01-01&end=2020-01-02")

    assert res.json() == []
    assert before is not None  # keeps the computed date meaningful to a reader


# --------------------------------------------------------------------------
# The database trigger (PostgreSQL only)
# --------------------------------------------------------------------------

POSTGRES_URL = os.getenv("TEST_POSTGRES_URL")


@pytest.mark.skipif(
    not POSTGRES_URL,
    reason=(
        "The append-only trigger is PostgreSQL DDL with no SQLite equivalent. "
        "Set TEST_POSTGRES_URL to run it; CI does."
    ),
)
async def test_the_trigger_refuses_to_let_the_log_be_rewritten() -> None:
    """The other half of the defence, exercised against a real Postgres.

    The DDL is imported from the migration rather than restated here. A copy
    would keep passing after somebody edited the migration, which is precisely
    the change that would silently disable the protection in production.

    Everything happens inside a throwaway schema. The migration's statement
    names `audit_logs` literally, so running it against the default search path
    would mean this test creating and dropping a table with the same name as
    the real one — and a mistyped TEST_POSTGRES_URL would then destroy the
    audit log it exists to protect. A private schema keeps the DDL verbatim
    and puts it somewhere it cannot reach anything real.
    """
    import importlib.util

    from sqlalchemy import text
    from sqlalchemy.exc import DBAPIError
    from sqlalchemy.ext.asyncio import create_async_engine

    migration_path = (
        Path(__file__).resolve().parents[1]
        / "alembic/versions/c3e5a7b9d1f4_seal_the_audit_log.py"
    )
    spec = importlib.util.spec_from_file_location("seal_migration", migration_path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)

    schema = "audit_trigger_test"
    engine = create_async_engine(POSTGRES_URL)
    try:
        async with engine.begin() as conn:
            await conn.execute(text(f"DROP SCHEMA IF EXISTS {schema} CASCADE"))
            await conn.execute(text(f"CREATE SCHEMA {schema}"))
            await conn.execute(text(f"SET search_path TO {schema}"))
            await conn.execute(
                text(
                    "CREATE TABLE audit_logs ("
                    "id uuid PRIMARY KEY, summary varchar(300) NOT NULL, "
                    "entry_hash varchar(64) NOT NULL DEFAULT '')"
                )
            )
            # Verbatim, straight out of the migration that ships -- and
            # executed one statement per call, exactly as Alembic does. That
            # detail is the test: asyncpg refuses more than one command in a
            # prepared statement, so a migration that bundles the function and
            # the trigger into a single script runs fine under psql and fails
            # on deploy. This test reproduces the driver, not just the SQL.
            await conn.execute(text(migration._CREATE_FUNCTION))
            await conn.execute(text(migration._CREATE_TRIGGER))

        async with engine.begin() as conn:
            await conn.execute(text(f"SET search_path TO {schema}"))
            await conn.execute(
                text(
                    "INSERT INTO audit_logs (id, summary) VALUES "
                    "('11111111-1111-1111-1111-111111111111', 'refunded an order')"
                )
            )

        with pytest.raises(DBAPIError, match="append-only"):
            async with engine.begin() as conn:
                await conn.execute(text(f"SET search_path TO {schema}"))
                await conn.execute(text("UPDATE audit_logs SET summary = 'nothing happened'"))

        with pytest.raises(DBAPIError, match="append-only"):
            async with engine.begin() as conn:
                await conn.execute(text(f"SET search_path TO {schema}"))
                await conn.execute(text("DELETE FROM audit_logs"))

        async with engine.begin() as conn:
            await conn.execute(text(f"SET search_path TO {schema}"))
            surviving = await conn.scalar(text("SELECT summary FROM audit_logs"))
            # Appending must still work; an immutable log that cannot be
            # written to is just a broken log.
            await conn.execute(
                text(
                    "INSERT INTO audit_logs (id, summary) VALUES "
                    "('22222222-2222-2222-2222-222222222222', 'second entry')"
                )
            )
            total = await conn.scalar(text("SELECT count(*) FROM audit_logs"))

        assert surviving == "refunded an order"
        assert total == 2
    finally:
        async with engine.begin() as conn:
            await conn.execute(text(f"DROP SCHEMA IF EXISTS {schema} CASCADE"))
        await engine.dispose()
