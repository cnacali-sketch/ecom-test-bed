"""Which fulfilment and payment moves an order is allowed to make.

Until now the endpoints checked only that the incoming word was one the system
recognised. That accepted `delivered -> pending`, which is nonsense, and
`cancelled -> delivered`, which is worse than nonsense: cancelling releases the
order's stock, so marking it delivered silently re-reserves units that may
already have been sold to somebody else. Neither step looks wrong on screen.

The rules under test are deliberately not maximally strict. Forward moves are
always allowed because an order handed over in person really does jump from
pending to delivered, and a machine that refuses the way the shop actually
works just teaches staff to click through states to record one fact. What is
refused is coming back from a settled state in a single hop, and returning
goods that never left.
"""
import uuid
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.order import Order, OrderItem
from app.models.product import Product

_PRODUCT = uuid.uuid4()


@pytest_asyncio.fixture(autouse=True)
async def _seed(db_session: AsyncSession) -> None:
    db_session.add(
        Product(
            id=_PRODUCT,
            sku="FSM-1",
            slug="state-machine-product",
            name="State Machine Product",
            price=Decimal("500.00"),
            mrp=Decimal("500.00"),
            in_stock=True,
            attrs={"stock": 10},
        )
    )
    await db_session.commit()


async def _order(
    db: AsyncSession,
    *,
    status: str = "pending",
    payment: str = "unpaid",
    stock_released: bool = False,
    quantity: int = 2,
) -> Order:
    """An order already in `status`.

    Written straight to the database because the point of these tests is the
    move *out* of a state, and reaching some of them through the API would
    require making the very transitions under test.
    """
    order = Order(
        id=uuid.uuid4(),
        user_id="fsm@example.com",
        status=status,
        payment_status=payment,
        payment_method="cod",
        total_amount=Decimal("1000.00"),
        shipping_address={"full_name": "Test", "phone": "9999999999"},
        stock_released=stock_released,
    )
    order.items.append(
        OrderItem(
            id=uuid.uuid4(),
            product_id=_PRODUCT,
            unit_price=Decimal("500.00"),
            quantity=quantity,
        )
    )
    db.add(order)
    await db.commit()
    return order


async def _set(client: AsyncClient, order: Order, status: str):
    return await client.patch(f"/api/orders/{order.id}/status?status={status}")


async def _stock(db: AsyncSession) -> int:
    product = await db.get(Product, _PRODUCT)
    await db.refresh(product)
    return product.attrs["stock"]


# --------------------------------------------------------------------------
# The moves that were accepted and should not have been
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_a_delivered_order_cannot_go_back_to_pending(
    admin_client: AsyncClient, db_session
):
    """The headline bug. An order the customer is holding is not awaiting packing."""
    order = await _order(db_session, status="delivered")

    resp = await _set(admin_client, order, "pending")

    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_a_cancelled_order_cannot_be_marked_delivered(
    admin_client: AsyncClient, db_session
):
    """The dangerous one.

    Cancelling released this order's stock. Jumping straight to delivered
    re-reserves it in the same breath, with no step where anyone decides
    whether the units are still there to give.
    """
    order = await _order(db_session, status="cancelled", stock_released=True)

    resp = await _set(admin_client, order, "delivered")

    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_goods_that_never_shipped_cannot_be_returned(
    admin_client: AsyncClient, db_session
):
    """A customer changing their mind before dispatch is a cancellation.

    The distinction is not pedantry: `returned` means stock came back into the
    building, and recording that for a parcel that never left overstates what
    is on the shelf.
    """
    order = await _order(db_session, status="pending")

    assert (await _set(admin_client, order, "returned")).status_code == 409


@pytest.mark.asyncio
async def test_two_steps_back_is_refused(admin_client: AsyncClient, db_session):
    order = await _order(db_session, status="shipped")

    assert (await _set(admin_client, order, "pending")).status_code == 409


# --------------------------------------------------------------------------
# The moves the shop actually makes
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_an_order_handed_over_in_person_can_skip_straight_to_delivered(
    admin_client: AsyncClient, db_session
):
    """Forward is always allowed. Refusing this would only teach whoever packs
    orders to click through three states to record one fact."""
    order = await _order(db_session, status="pending")

    resp = await _set(admin_client, order, "delivered")

    assert resp.status_code == 200
    assert resp.json()["status"] == "delivered"


@pytest.mark.asyncio
async def test_one_step_back_undoes_a_misclick(admin_client: AsyncClient, db_session):
    """Mis-clicks happen; the honest fix is a step back, not a database edit."""
    order = await _order(db_session, status="delivered")

    assert (await _set(admin_client, order, "shipped")).status_code == 200


@pytest.mark.asyncio
async def test_a_cancelled_order_is_reinstated_before_it_can_ship(
    admin_client: AsyncClient, db_session
):
    """Two hops on purpose.

    Reinstating runs the stock check at the moment somebody is deciding to
    revive the order, rather than burying it inside "mark as shipped".
    """
    order = await _order(db_session, status="cancelled", stock_released=True)

    assert (await _set(admin_client, order, "shipped")).status_code == 409
    assert (await _set(admin_client, order, "confirmed")).status_code == 200
    assert (await _set(admin_client, order, "shipped")).status_code == 200


@pytest.mark.asyncio
async def test_re_applying_the_same_status_is_not_an_error(
    admin_client: AsyncClient, db_session
):
    """Bulk actions re-send the same status across a batch. Failing because one
    parcel was already marked shipped would break the endpoint for its own
    purpose."""
    order = await _order(db_session, status="shipped")

    resp = await _set(admin_client, order, "shipped")

    assert resp.status_code == 200
    assert resp.json()["status"] == "shipped"


# --------------------------------------------------------------------------
# How the refusal behaves
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_the_refusal_says_what_can_be_done_instead(
    admin_client: AsyncClient, db_session
):
    """"Invalid transition" leaves whoever hit it guessing."""
    order = await _order(db_session, status="delivered")

    detail = (await _set(admin_client, order, "pending")).json()["detail"]

    assert "delivered" in detail
    assert "shipped" in detail and "returned" in detail
    assert f"#{str(order.id)[:8]}" in detail


@pytest.mark.asyncio
async def test_an_impossible_move_is_refused_for_being_impossible(
    admin_client: AsyncClient, db_session
):
    """Not for want of stock, which is what happens if the guard runs late.

    Reinstating a cancelled order whose units have since sold raises a shortage.
    So with the stock branch running first, `cancelled -> delivered` comes back
    as "not enough stock" -- sending whoever hit it to count inventory over a
    move that should never have been on offer at all.

    Note what this test does *not* claim: that a late guard would corrupt
    stock. It would not. Nothing on this path commits, so a reservation made on
    the way to a refusal is discarded with the session. The damage is to the
    explanation, not to the data.
    """
    order = await _order(db_session, status="cancelled", stock_released=True, quantity=2)
    product = await db_session.get(Product, _PRODUCT)
    product.attrs = {**product.attrs, "stock": 0}  # sold out since the cancellation
    await db_session.commit()

    detail = (await _set(admin_client, order, "delivered")).json()["detail"]

    assert "cannot be marked delivered" in detail
    assert "stock" not in detail.lower()


@pytest.mark.asyncio
async def test_a_refused_move_writes_no_audit_entry(
    admin_client: AsyncClient, db_session
):
    """A log entry for a change that did not happen is worse than none."""
    order = await _order(db_session, status="delivered")

    await _set(admin_client, order, "pending")

    entries = (
        await db_session.execute(select(AuditLog).where(AuditLog.action == "order.status"))
    ).scalars().all()
    assert list(entries) == []


# --------------------------------------------------------------------------
# Bulk
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_one_illegal_order_stops_the_whole_batch(
    admin_client: AsyncClient, db_session
):
    """All-or-nothing, as the bulk endpoint already promises. A half-applied
    batch is worse than a refused one because nothing on screen says which
    half went through."""
    ok_order = await _order(db_session, status="confirmed")
    bad_order = await _order(db_session, status="delivered")
    # Held as plain values: the rollback below expires these instances, and
    # reading an expired attribute afterwards triggers lazy IO outside the
    # async context and raises MissingGreenlet rather than returning the id.
    ok_id, bad_id = ok_order.id, bad_order.id

    # The legal order is listed first deliberately. The endpoint processes in
    # the order given, so without the pre-validation pass this one would be
    # moved before the illegal one was reached -- which is exactly the partial
    # application the batch is supposed to make impossible.
    resp = await admin_client.patch(
        "/api/orders/bulk/status",
        json={"order_ids": [str(ok_id), str(bad_id)], "status": "pending"},
    )

    assert resp.status_code == 409
    assert f"#{str(bad_id)[:8]}" in resp.json()["detail"]

    # Checked through a fresh read rather than the shared session: these tests
    # hand the app the same session they inspect, so an uncommitted change
    # would otherwise be visible here when production would have discarded it.
    await db_session.rollback()
    still = await db_session.get(Order, ok_id)
    await db_session.refresh(still)
    assert still.status == "confirmed", "the legal order moved despite the batch failing"

    entries = (
        await db_session.execute(select(AuditLog).where(AuditLog.action == "order.status"))
    ).scalars().all()
    assert list(entries) == [], "a refused batch still wrote to the activity log"


@pytest.mark.asyncio
async def test_a_batch_reports_the_impossible_move_not_an_inventory_problem(
    admin_client: AsyncClient, db_session
):
    """Why the whole batch is validated before any of it is applied.

    Without the pre-pass, the orders are processed in turn: the first one here
    is a legal reinstatement whose units have since sold, so it raises a stock
    shortage and that is the error the caller sees. The batch then looks like
    an inventory problem, when what is actually wrong is that it contains an
    order nobody can move at all.

    All-or-nothing does not depend on this -- the transaction gives that for
    free either way. What the pre-pass buys is that the error names the reason
    the batch can never succeed, rather than the first obstacle encountered on
    the way to finding out.
    """
    blocked = await _order(db_session, status="cancelled", stock_released=True, quantity=2)
    impossible = await _order(db_session, status="delivered")
    product = await db_session.get(Product, _PRODUCT)
    product.attrs = {**product.attrs, "stock": 0}
    await db_session.commit()

    resp = await admin_client.patch(
        "/api/orders/bulk/status",
        json={"order_ids": [str(blocked.id), str(impossible.id)], "status": "confirmed"},
    )

    assert resp.status_code == 409
    detail = resp.json()["detail"]
    assert "cannot be marked confirmed" in detail
    assert "not enough stock" not in detail


@pytest.mark.asyncio
async def test_a_batch_containing_an_already_shipped_order_still_works(
    admin_client: AsyncClient, db_session
):
    already = await _order(db_session, status="shipped")
    waiting = await _order(db_session, status="confirmed")

    resp = await admin_client.patch(
        "/api/orders/bulk/status",
        json={"order_ids": [str(already.id), str(waiting.id)], "status": "shipped"},
    )

    assert resp.status_code == 200
    assert [o["status"] for o in resp.json()] == ["shipped", "shipped"]


# --------------------------------------------------------------------------
# Payment
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_an_unpaid_order_cannot_be_marked_refunded(
    admin_client: AsyncClient, db_session
):
    """Money that never arrived cannot be sent back.

    This sat one dropdown entry away on every unpaid COD order, and choosing it
    recorded a refund the shop never made -- which then reads as a real loss in
    every total that counts refunds.
    """
    order = await _order(db_session, payment="unpaid")

    resp = await admin_client.patch(f"/api/orders/{order.id}/payment?payment_status=refunded")

    assert resp.status_code == 409
    await db_session.refresh(order)
    assert order.refund_amount == Decimal("0")


@pytest.mark.asyncio
async def test_an_unpaid_order_cannot_be_partially_refunded_either(
    admin_client: AsyncClient, db_session
):
    order = await _order(db_session, payment="unpaid")

    resp = await admin_client.patch(
        f"/api/orders/{order.id}/payment?payment_status=partially_refunded"
    )

    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_the_ordinary_payment_path_still_works(
    admin_client: AsyncClient, db_session
):
    order = await _order(db_session, payment="unpaid")

    paid = await admin_client.patch(f"/api/orders/{order.id}/payment?payment_status=paid")
    refunded = await admin_client.patch(
        f"/api/orders/{order.id}/payment?payment_status=refunded"
    )

    assert paid.status_code == 200
    assert refunded.status_code == 200
    assert refunded.json()["payment_status"] == "refunded"


@pytest.mark.asyncio
async def test_a_refused_payment_move_leaves_the_refund_record_alone(
    admin_client: AsyncClient, db_session
):
    """The handler clears refund fields when moving to unpaid/paid. A refused
    move must not run that clearing on its way out."""
    order = await _order(db_session, payment="refunded")
    order.refund_amount = Decimal("1000.00")
    order.refund_reference = "rfnd_abc123"
    await db_session.commit()

    # refunded -> unpaid is not a legal move; only paid or partially_refunded.
    resp = await admin_client.patch(f"/api/orders/{order.id}/payment?payment_status=unpaid")

    assert resp.status_code == 409
    await db_session.refresh(order)
    assert order.refund_amount == Decimal("1000.00")
    assert order.refund_reference == "rfnd_abc123"


# --------------------------------------------------------------------------
# Serving the machine to the console
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_the_transitions_endpoint_matches_the_rules_it_enforces(
    admin_client: AsyncClient,
):
    """Served, not restated in the frontend.

    Two copies of a transition table drift, and then the console either offers
    a move the server refuses or hides one it would allow. Asserting against
    the same constants the endpoints use is what keeps the served copy honest.
    """
    from app.routers.orders import FULFILMENT_TRANSITIONS, PAYMENT_TRANSITIONS

    body = (await admin_client.get("/api/orders/transitions")).json()

    assert body["fulfilment"] == {
        state: sorted(targets) for state, targets in FULFILMENT_TRANSITIONS.items()
    }
    assert body["payment"] == {
        state: sorted(targets) for state, targets in PAYMENT_TRANSITIONS.items()
    }


@pytest.mark.asyncio
async def test_the_transitions_route_is_not_read_as_an_order_id(
    admin_client: AsyncClient,
):
    """`/{order_id}` would swallow "transitions" and fail UUID parsing with a
    422 that explains nothing -- the trap /bulk/status already documents."""
    resp = await admin_client.get("/api/orders/transitions")

    assert resp.status_code == 200
    assert "fulfilment" in resp.json()


@pytest.mark.asyncio
async def test_staff_can_read_the_transitions_but_the_public_cannot(
    staff_client: AsyncClient, client: AsyncClient
):
    """Staff change fulfilment status, so they need the map; it is not
    something an anonymous caller has any use for."""
    assert (await staff_client.get("/api/orders/transitions")).status_code == 200
    assert (await client.get("/api/orders/transitions")).status_code == 401
