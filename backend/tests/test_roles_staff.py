"""The staff role: fulfilment without money.

The shop needs a second pair of hands before it needs a second owner. Staff
can see orders, move them through picking, packing and dispatch, and flag one
for the owner — and cannot refund, delete a sale, open the customer directory,
change a price, or read the activity log.

The tests below are the boundary itself. Every endpoint staff may reach is
asserted reachable, and every endpoint they may not is asserted refused, by
name. A permission split that is only described in a docstring drifts the
first time somebody adds an endpoint; one that is enumerated in a test fails
loudly instead.
"""
import uuid
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product
from app.models.user import ROLE_ADMIN, ROLE_CUSTOMER, ROLE_STAFF, User

_PRODUCT = uuid.uuid4()

ORDER = {
    "user_id": "staff-test@example.com",
    "items": [{"product_id": str(_PRODUCT), "quantity": 1, "unit_price": "1000.00"}],
    "terms_accepted": True,
    "terms_version": "2026-07-22",
}


@pytest_asyncio.fixture(autouse=True)
async def _seed(db_session: AsyncSession) -> None:
    db_session.add(
        Product(
            id=_PRODUCT,
            sku="STAFF-1",
            slug="staff-test-product",
            name="Staff Test Product",
            price=Decimal("1000.00"),
            mrp=Decimal("1000.00"),
            in_stock=True,
            attrs={"stock": 10},
        )
    )
    await db_session.commit()


async def _order(client: AsyncClient) -> str:
    created = await client.post("/api/orders", json=ORDER)
    assert created.status_code == 201, created.text
    return created.json()["id"]


# ---- what staff may do ----

@pytest.mark.asyncio
async def test_staff_can_see_the_order_queue(
    client: AsyncClient, staff_client: AsyncClient
) -> None:
    await _order(client)
    listed = await staff_client.get("/api/orders/all")
    assert listed.status_code == 200
    assert len(listed.json()) == 1


@pytest.mark.asyncio
async def test_staff_can_move_an_order_through_dispatch(
    client: AsyncClient, staff_client: AsyncClient
) -> None:
    """The whole point of the role: pick, pack, hand to the courier."""
    order_id = await _order(client)

    confirmed = await staff_client.patch(f"/api/orders/{order_id}/status?status=confirmed")
    assert confirmed.status_code == 200

    dispatched = await staff_client.patch(
        f"/api/orders/{order_id}/shipping?courier=Delhivery&tracking_number=AWB100"
    )
    assert dispatched.status_code == 200
    assert dispatched.json()["tracking_number"] == "AWB100"

    shipped = await staff_client.patch(f"/api/orders/{order_id}/status?status=shipped")
    assert shipped.status_code == 200


@pytest.mark.asyncio
async def test_staff_can_work_a_batch(client: AsyncClient, staff_client: AsyncClient) -> None:
    ids = [await _order(client), await _order(client)]
    moved = await staff_client.patch(
        "/api/orders/bulk/status", json={"order_ids": ids, "status": "confirmed"}
    )
    assert moved.status_code == 200


@pytest.mark.asyncio
async def test_staff_can_escalate_an_order_to_the_owner(
    client: AsyncClient, staff_client: AsyncClient
) -> None:
    """Flagging is how somebody without the refund button says "this one needs
    you". Withholding it would leave staff with no way to raise a problem."""
    order_id = await _order(client)
    flagged = await staff_client.patch(
        f"/api/orders/{order_id}/flag?flagged=true&reason=address%20looks%20wrong"
    )
    assert flagged.status_code == 200
    assert flagged.json()["flagged"] is True


@pytest.mark.asyncio
async def test_staff_can_answer_customer_messages(staff_client: AsyncClient) -> None:
    assert (await staff_client.get("/api/contact")).status_code == 200


@pytest.mark.asyncio
async def test_staff_can_see_return_requests(staff_client: AsyncClient) -> None:
    """They will be receiving the parcel back. Approving it is the owner's."""
    assert (await staff_client.get("/api/returns")).status_code == 200


# ---- what staff may not do ----

@pytest.mark.asyncio
async def test_staff_cannot_touch_money_on_an_order(
    client: AsyncClient, staff_client: AsyncClient, admin_client: AsyncClient
) -> None:
    order_id = await _order(client)
    await admin_client.patch(f"/api/orders/{order_id}/payment?payment_status=paid")

    assert (
        await staff_client.patch(f"/api/orders/{order_id}/payment?payment_status=refunded")
    ).status_code == 403
    assert (
        await staff_client.post(f"/api/orders/{order_id}/refund", json={"amount": "100.00"})
    ).status_code == 403
    assert (await staff_client.post(f"/api/orders/{order_id}/invoice")).status_code == 403


@pytest.mark.asyncio
async def test_staff_cannot_destroy_a_sale(
    client: AsyncClient, staff_client: AsyncClient
) -> None:
    order_id = await _order(client)
    assert (await staff_client.delete(f"/api/orders/{order_id}")).status_code == 403
    # And the order is still there afterwards, not half-deleted.
    assert (await staff_client.get("/api/orders/all")).status_code == 200


@pytest.mark.asyncio
async def test_staff_cannot_reach_anything_reserved_for_the_owner(
    staff_client: AsyncClient, customer_user: User
) -> None:
    """Enumerated rather than described. Adding an endpoint that staff should
    not have must fail here, not be discovered by a staff member finding it."""
    refused = {
        "customer directory": staff_client.get("/api/customers"),
        "role assignment": staff_client.patch(
            f"/api/customers/{customer_user.id}/role", json={"role": "admin"}
        ),
        "blocking a customer": staff_client.patch(
            f"/api/customers/{customer_user.id}/block", json={"blocked": True}
        ),
        "activity log": staff_client.get("/api/audit"),
        "invoice register": staff_client.get("/api/invoices"),
        "coupons": staff_client.get("/api/coupons"),
        "analytics": staff_client.get("/api/events/summary"),
        "fraud report": staff_client.get("/api/events/fraud-summary"),
        "error logs": staff_client.get("/api/error-logs"),
        "media library": staff_client.get("/api/media"),
        "deleting a customer message": staff_client.delete(f"/api/contact/{uuid.uuid4()}"),
        "approving a return": staff_client.patch(
            f"/api/returns/{uuid.uuid4()}", json={"status": "approved"}
        ),
    }
    for what, call in refused.items():
        assert (await call).status_code == 403, f"staff reached {what}"


@pytest.mark.asyncio
async def test_staff_cannot_change_the_catalogue(staff_client: AsyncClient) -> None:
    """A packer changing a price is the quiet version of a refund."""
    created = await staff_client.post(
        "/api/products",
        json={"sku": "X-1", "slug": "x-1", "name": "X", "price": "1.00", "mrp": "1.00"},
    )
    assert created.status_code == 403
    assert (await staff_client.delete(f"/api/products/{uuid.uuid4()}")).status_code == 403
    assert (await staff_client.put("/api/sections", json={})).status_code == 403


@pytest.mark.asyncio
async def test_a_plain_customer_still_reaches_nothing(
    customer_client: AsyncClient, client: AsyncClient
) -> None:
    """The staff role must not have widened the storefront's own account."""
    await _order(client)
    assert (await customer_client.get("/api/orders/all")).status_code == 403
    assert (await customer_client.get("/api/contact")).status_code == 403
    assert (await customer_client.get("/api/returns")).status_code == 403


# ---- the audit trail names the staff member ----

@pytest.mark.asyncio
async def test_a_staff_action_is_recorded_against_the_staff_member(
    client: AsyncClient, staff_client: AsyncClient, admin_client: AsyncClient
) -> None:
    """Delegation without attribution is how "who marked this shipped" becomes
    unanswerable."""
    order_id = await _order(client)
    await staff_client.patch(f"/api/orders/{order_id}/status?status=shipped")

    entries = (await admin_client.get("/api/audit")).json()
    assert entries[0]["actor_email"] == "staff@example.com"
    assert entries[0]["actor_role"] == "staff"
    assert entries[0]["summary"] == "Marked as shipped"


# ---- blocking cuts access immediately ----

@pytest.mark.asyncio
async def test_blocking_a_staff_account_ends_its_session_at_once(
    staff_client: AsyncClient, admin_client: AsyncClient, staff_user: User
) -> None:
    """`is_blocked` was only checked at login and checkout, which was enough
    while every blocked account was a shopper. A blocked staff member holding
    a live access token would otherwise keep working the back office until it
    expired — exactly the window that matters when an account is compromised."""
    assert (await staff_client.get("/api/orders/all")).status_code == 200

    blocked = await admin_client.patch(
        f"/api/customers/{staff_user.id}/block",
        json={"blocked": True, "reason": "laptop stolen"},
    )
    assert blocked.status_code == 200

    # Same client, same cookie, no re-login.
    refused = await staff_client.get("/api/orders/all")
    assert refused.status_code == 403
    assert "blocked" in refused.json()["detail"].lower()


# ---- assigning roles ----

@pytest.mark.asyncio
async def test_an_admin_can_promote_a_shopper_to_staff(
    admin_client: AsyncClient, customer_user: User
) -> None:
    promoted = await admin_client.patch(
        f"/api/customers/{customer_user.id}/role", json={"role": ROLE_STAFF}
    )
    assert promoted.status_code == 200, promoted.text
    assert promoted.json()["role"] == ROLE_STAFF


@pytest.mark.asyncio
async def test_a_role_change_is_recorded(
    admin_client: AsyncClient, customer_user: User
) -> None:
    await admin_client.patch(
        f"/api/customers/{customer_user.id}/role", json={"role": ROLE_STAFF}
    )
    entry = (await admin_client.get("/api/audit", params={"action": "customer.role"})).json()[0]
    assert entry["changes"]["role"] == {"from": ROLE_CUSTOMER, "to": ROLE_STAFF}
    assert entry["entity_label"] == "customer@example.com"


@pytest.mark.asyncio
async def test_an_unknown_role_is_refused(
    admin_client: AsyncClient, customer_user: User
) -> None:
    """A typo would create an account matching no permission check anywhere,
    which presents as "logged in, every screen empty" rather than as an error."""
    refused = await admin_client.patch(
        f"/api/customers/{customer_user.id}/role", json={"role": "manager"}
    )
    assert refused.status_code == 422
    assert "customer" in refused.json()["detail"]


@pytest.mark.asyncio
async def test_an_admin_cannot_demote_themselves(
    admin_client: AsyncClient, admin_user: User
) -> None:
    """There is no way back from this except the database."""
    refused = await admin_client.patch(
        f"/api/customers/{admin_user.id}/role", json={"role": ROLE_CUSTOMER}
    )
    assert refused.status_code == 422
    assert (await admin_client.get("/api/customers")).status_code == 200


@pytest.mark.asyncio
async def test_setting_the_role_it_already_has_changes_nothing(
    admin_client: AsyncClient, customer_user: User
) -> None:
    """No audit noise, and no pointless session revocation, for a no-op."""
    same = await admin_client.patch(
        f"/api/customers/{customer_user.id}/role", json={"role": ROLE_CUSTOMER}
    )
    assert same.status_code == 200
    assert (
        await admin_client.get("/api/audit", params={"action": "customer.role"})
    ).json() == []


@pytest.mark.asyncio
async def test_a_demoted_admin_loses_access_on_the_next_request(
    db_session: AsyncSession, admin_client: AsyncClient, staff_user: User
) -> None:
    """The access token carries a role claim, but the user is re-read from the
    database every request — so a demotion does not wait for expiry."""
    from app.dependencies.auth import ACCESS_COOKIE
    from app.services.security import create_access_token

    staff_user.role = ROLE_ADMIN
    await db_session.commit()

    # A cookie minted while the account was an admin.
    admin_client.cookies.set(ACCESS_COOKIE, create_access_token(staff_user.id, ROLE_ADMIN))
    assert (await admin_client.get("/api/audit")).status_code == 200

    staff_user.role = ROLE_STAFF
    await db_session.commit()

    assert (await admin_client.get("/api/audit")).status_code == 403
