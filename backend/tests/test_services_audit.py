"""The diffing and coercion behind the audit log.

Pure functions, no database. These are the two places the log can lie without
anyone noticing: a value that cannot survive the JSON column (money, ids,
timestamps), and a "change" recorded for a field that did not actually move.
"""
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.user import User
from app.services.audit import diff, jsonable, order_label, record


# ---- jsonable ----

def test_money_is_stored_as_a_string_not_a_float() -> None:
    """1499.50 as a float is a rounding bug inside a record about money."""
    assert jsonable(Decimal("1499.50")) == "1499.50"
    assert isinstance(jsonable(Decimal("1499.50")), str)


def test_ids_and_timestamps_survive_coercion() -> None:
    order_id = uuid.uuid4()
    when = datetime(2026, 9, 11, 14, 30, tzinfo=timezone.utc)
    assert jsonable(order_id) == str(order_id)
    assert jsonable(when) == "2026-09-11T14:30:00+00:00"


def test_nested_structures_are_coerced_all_the_way_down() -> None:
    """An address blob and a line-item list both arrive as nested containers."""
    value = {"lines": [{"price": Decimal("10.00")}], "id": uuid.UUID(int=7)}
    assert jsonable(value) == {
        "lines": [{"price": "10.00"}],
        "id": "00000000-0000-0000-0000-000000000007",
    }


def test_plain_values_pass_through_untouched() -> None:
    assert jsonable(None) is None
    assert jsonable(True) is True
    assert jsonable(7) == 7
    assert jsonable("shipped") == "shipped"


# ---- diff ----

def test_only_changed_fields_are_recorded() -> None:
    before = {"status": "pending", "courier": "Delhivery"}
    after = {"status": "shipped", "courier": "Delhivery"}
    assert diff(before, after) == {"status": {"from": "pending", "to": "shipped"}}


def test_a_field_appearing_for_the_first_time_counts_as_a_change() -> None:
    """A tracking number set on an order that had none is exactly the kind of
    edit support needs to see, so a missing `before` must not hide it."""
    assert diff({}, {"tracking_number": "AWB123"}) == {
        "tracking_number": {"from": None, "to": "AWB123"}
    }


def test_trailing_zeros_on_money_are_not_a_change() -> None:
    """Decimal("0.00") and Decimal("0") are the same amount. Comparing them as
    text would log every payment edit as also changing the refund to zero."""
    assert diff({"refund_amount": Decimal("0.00")}, {"refund_amount": Decimal("0")}) == {}


def test_a_real_money_movement_is_still_recorded() -> None:
    changed = diff({"refund_amount": Decimal("0.00")}, {"refund_amount": Decimal("200.00")})
    assert changed == {"refund_amount": {"from": "0.00", "to": "200.00"}}


def test_the_stored_diff_never_shows_an_identical_pair() -> None:
    """Whatever survives the filter must read as a change once written, or the
    log shows entries whose `from` and `to` are the same string."""
    before = {"address": {"city": "Bengaluru"}, "total": Decimal("449.00")}
    after = {"address": {"city": "Bengaluru"}, "total": Decimal("449.00")}
    for field in diff(before, after).values():
        assert field["from"] != field["to"]


# ---- labels ----

def test_an_order_is_labelled_by_its_short_id() -> None:
    """The same eight characters the admin screens show, so an entry about a
    deleted order can still be matched to what the reader remembers seeing."""
    order_id = uuid.UUID("3fa85f64-5717-4562-b3fc-2c963f66afa6")
    assert order_label(order_id) == "#3fa85f64"


# ---- the transaction property ----

@pytest.mark.asyncio
async def test_record_does_not_commit_so_a_rollback_takes_it_too(
    db_session: AsyncSession, admin_user: User
) -> None:
    """This is the whole design. `record` adds to the caller's session, so the
    entry lives or dies with the change it describes. If it committed on its
    own, every refused refund and rejected status change would leave a log
    entry saying it happened."""
    await record(
        db_session,
        actor=admin_user,
        action="order.refund",
        entity_type="order",
        summary="Refunded ₹200.00",
    )
    await db_session.rollback()

    rows = (await db_session.execute(select(AuditLog))).scalars().all()
    assert rows == []


@pytest.mark.asyncio
async def test_record_lands_when_the_caller_commits(
    db_session: AsyncSession, admin_user: User
) -> None:
    """The other half: a caller that does commit must not need a second step."""
    await record(
        db_session,
        actor=admin_user,
        action="order.refund",
        entity_type="order",
        summary="Refunded ₹200.00",
    )
    await db_session.commit()

    rows = (await db_session.execute(select(AuditLog))).scalars().all()
    assert [r.summary for r in rows] == ["Refunded ₹200.00"]


@pytest.mark.asyncio
async def test_the_actor_role_is_snapshotted_not_looked_up_later(
    db_session: AsyncSession, admin_user: User
) -> None:
    """A staff member promoted to admin next month must not retroactively
    appear as an admin on entries they wrote as staff."""
    admin_user.role = "staff"
    entry = await record(
        db_session,
        actor=admin_user,
        action="order.status",
        entity_type="order",
        summary="Marked as packed",
    )
    await db_session.commit()

    admin_user.role = "admin"
    await db_session.commit()
    await db_session.refresh(entry)

    assert entry.actor_role == "staff"
