"""Order endpoints.

  POST  /api/orders               — create order from cart items (COD live;
                                     online payment is recorded but not yet
                                     collected — the gateway is pending)
  GET   /api/orders/{id}          — fetch a single order (public: this is the
                                     "secret" a guest needs for order tracking)
  GET   /api/orders               — the CALLER's own orders (auth required)
  GET   /api/orders/all           — every order (staff)
  PATCH /api/orders/{id}/status   — fulfilment status (staff)
  PATCH /api/orders/bulk/status   — several at once (staff)
  PATCH /api/orders/{id}/shipping — courier + tracking number (staff)
  PATCH /api/orders/{id}/flag     — manually flag/unflag for review (staff)
  PATCH /api/orders/{id}/payment  — payment status (admin)
  POST  /api/orders/{id}/refund   — record a refund (admin)
  DELETE /api/orders/{id}         — delete an order, restocking it (admin)

Staff may move an order through fulfilment; only an admin may move money
or destroy the record of a sale.
"""
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, computed_field
from sqlalchemy import Text, and_, cast, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.db import get_db_session
from app.dependencies.auth import (
    optional_current_user,
    require_admin,
    require_current_user,
    require_staff,
)
from app.models.coupon import Coupon
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.user import ROLE_ADMIN, User
from app.schemas.auth import Address
from app.services import audit, login_throttle, stock
from app.services.coupons import compute_discount
from app.services.email import send_order_confirmation_email, send_order_shipped_email
from app.services.razorpay import (
    create_razorpay_order,
    razorpay_enabled,
    verify_payment_signature,
)
from app.services.request_ip import client_ip
from app.services.user_agent import describe as describe_user_agent

router = APIRouter(prefix="/api/orders", tags=["orders"])

# Guest checkout is unauthenticated and COD needs no payment confirmation, so
# without a cap a scripted loop can order every unit of stock for free — a
# direct DoS against real inventory right as paid ad traffic starts arriving.
# Same 5-minute window as every other login_throttle caller; per-IP so it
# doesn't collectively punish shoppers behind a shared IP for one bad actor's
# window, just cap how fast any single one can fire.
ORDER_MAX_PER_IP = 20
_TOO_MANY_ORDERS = HTTPException(status_code=429, detail="Too many orders from this address. Try again shortly.")


# ---- Schemas (inline — order schemas are small and only used here) ----

class OrderItemCreate(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(..., ge=1)
    unit_price: Decimal = Field(..., ge=0, decimal_places=2)


PAYMENT_METHODS = {"cod", "prepaid"}

# "partially_refunded" exists because the alternative was lying. With only
# paid/refunded, giving back part of an order forced a choice between the books
# saying the whole order came back and saying none of it did.
PAYMENT_STATUSES = {"unpaid", "paid", "partially_refunded", "refunded"}


class OrderCreate(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    items: list[OrderItemCreate] = Field(..., min_length=1)
    # Optional so the existing test suite / API callers that predate checkout
    # don't have to send it; a real storefront checkout always will.
    shipping_address: Address | None = None
    payment_method: str = "cod"
    # T&C consent. Defaults to False/None rather than required so admin phone
    # orders (no checkbox exists for those) aren't forced to fake a value —
    # create_order enforces this only for the non-admin checkout path.
    terms_accepted: bool = False
    terms_version: str | None = Field(default=None, max_length=32)
    coupon_code: str | None = Field(default=None, max_length=32)


class OrderProductRead(BaseModel):
    """Just enough of the product to read the line item.

    An order item stores product_id, quantity and the price paid — nothing a
    human can read. The admin Orders screen was showing "1" for every order
    with no way to find out what "1" was, and the customer's own order history
    had the same gap.
    """

    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    sku: str
    slug: str
    images: list[str] = []


class OrderItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    product_id: uuid.UUID
    quantity: int
    unit_price: Decimal
    # Eager-loaded via lazy="selectin" on OrderItem.product, so no endpoint
    # returning this schema has to remember to load it. Optional because a
    # product row deleted after the order was placed must not 500 the order.
    product: OrderProductRead | None = None


class OrderRead(BaseModel):
    """Customer/guest-facing order view. Deliberately omits `flag_reason` and
    `ip_address` — those are internal fraud-review fields, and this schema is
    also what the public, unauthenticated GET /{order_id} tracker returns (the
    order id is the only credential). Leaking `flag_reason` back to the same
    customer who triggered it tells them exactly what tripped the check, and
    `ip_address` is a raw identifier of theirs they never consented to see
    echoed back. Admin views use OrderAdminRead instead, which adds both."""

    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    user_id: str
    status: str
    payment_status: str
    payment_method: str
    shipping_address: dict
    courier: str | None
    tracking_number: str | None
    terms_version: str | None
    terms_accepted_at: datetime | None
    coupon_code: str | None
    discount_amount: Decimal
    total_amount: Decimal
    deposit_amount: Decimal
    deposit_paid: bool
    # How much has come back, and when. Safe for the customer to see — it is
    # their own money — unlike the internal reference that identifies the
    # refund at the payment provider.
    refund_amount: Decimal = Decimal("0")
    refunded_at: datetime | None = None
    flagged: bool
    created_at: datetime
    items: list[OrderItemRead] = []


class OrderAdminRead(OrderRead):
    """Admin-only order view — adds the fraud-review fields OrderRead omits."""

    flag_reason: str | None
    ip_address: str | None
    user_agent: str | None = None
    # Accounting records, not the customer's. The payment id is how a bank
    # settlement is tied back to this order, and the refund reference is our
    # own trace of where the money went — neither belongs in the public
    # tracker, which the order id alone unlocks.
    razorpay_payment_id: str | None = None
    refund_reference: str | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def device(self) -> str:
        """"Android · Chrome (Mobile)" — derived, never stored.

        Kept out of OrderRead with the other internal fields: it is derived
        from the shopper's own User-Agent and belongs in the admin view, not
        in the public order tracker.
        """
        return describe_user_agent(self.user_agent)


async def _reserve_stock(db: AsyncSession, items: list[OrderItemCreate]) -> None:
    """Take the ordered units out of stock, refusing the order if any product
    cannot cover its line.

    The mechanics live in services/stock.py so that reserving and releasing
    are one implementation rather than two that can drift — which is exactly
    how cancelling an order came to lose stock silently. This function is the
    checkout-specific part: what a shortage means (409, with the product named)
    and nothing else.

    Untracked products — no numeric attrs["stock"], which is most of the seed
    catalogue — are unlimited and neither checked nor decremented. A product_id
    with no matching row is treated the same way: order creation has never
    validated product existence, and turning that into a hard error here would
    be an unrelated breaking change.
    """
    short = await stock.shortfalls(db, items)
    if short:
        name, available, wanted = short[0]
        raise HTTPException(
            status_code=409,
            detail=f"Not enough stock for {name}: {available} left, {wanted} requested",
        )
    await stock.reserve(db, items)


async def _authoritative_pricing(
    db: AsyncSession, items: list[OrderItemCreate]
) -> tuple[dict[uuid.UUID, Decimal], str | None]:
    """Server-side price authority. Client unit_price is NEVER trusted for the
    total: for every item whose product EXISTS, real Product.price is used. A
    mismatch is a tampering attempt — the order is still accepted at the
    correct price (no money lost) but flagged for admin review, COD included.

    Also the existence check: order_items.product_id is a real FK to
    products.id, so a client-supplied id that doesn't exist can't actually be
    inserted — Postgres enforces this even though SQLite (the test DB) does
    not, which is exactly the gap a load test surfaced (unhandled 500 instead
    of this clean 422). Rejecting it here also closes off using fake ids to
    plant arbitrary-priced phantom line items in order history.
    """
    product_ids = {i.product_id for i in items}
    result = await db.execute(select(Product).where(Product.id.in_(product_ids)))
    products = {p.id: p for p in result.scalars().all()}

    missing = product_ids - products.keys()
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown product id(s): {', '.join(str(m) for m in missing)}",
        )

    prices: dict[uuid.UUID, Decimal] = {}
    mismatches: list[str] = []
    for item in items:
        product = products[item.product_id]
        prices[item.product_id] = product.price
        if item.unit_price != product.price:
            mismatches.append(f"{product.name}: sent {item.unit_price}, actual {product.price}")
    flag_reason = ("Price tampering — " + "; ".join(mismatches))[:500] if mismatches else None
    return prices, flag_reason


async def _redeem_coupon(db: AsyncSession, code: str, subtotal: Decimal) -> tuple[str, Decimal]:
    """Validate and redeem a coupon against `subtotal`, row-locked so two
    concurrent orders can't both squeak in under a usage_limit's last slot.

    Re-validates server-side even though the frontend already called
    /api/coupons/validate — that call never increments times_used and a
    client can't be trusted to echo back an honest discount amount.
    """
    result = await db.execute(select(Coupon).where(Coupon.code == code.strip().upper()).with_for_update())
    coupon = result.scalar_one_or_none()
    if coupon is None:
        raise HTTPException(status_code=422, detail="Invalid coupon code")
    discount = compute_discount(coupon, subtotal)
    coupon.times_used += 1
    return coupon.code, discount


async def _resolve_order_email(db: AsyncSession, order: Order) -> str | None:
    """Where to send an order notification.

    `order.user_id` is either a real account's UUID (logged-in customer or an
    admin-created order naming one) or a free-form guest identifier — the
    checkout form's contract is that guests enter their email there. Try the
    UUID lookup first; fall back to treating the string itself as an email.
    """
    try:
        account_id = uuid.UUID(order.user_id)
    except ValueError:
        return order.user_id if "@" in order.user_id else None

    result = await db.execute(select(User).where(User.id == account_id))
    account = result.scalar_one_or_none()
    return account.email if account else None


# ---- Endpoints ----

@router.post("", response_model=None, status_code=201)
async def create_order(
    payload: OrderCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    user: User | None = Depends(optional_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> OrderRead | OrderAdminRead:
    """Create an order from a cart payload. Calculates total server-side,
    reserves stock, and snapshots the shipping address.

    Guest checkout stays open (unauthenticated: `user_id` is whatever the
    client sent). If the caller is signed in as a plain customer, their real
    account id overrides `user_id` — otherwise a logged-in shopper could write
    an order into someone else's history just by naming their id in the
    payload. An admin's own payload `user_id` is honored as-is: admins place
    orders on behalf of customers (phone orders, manual entry), so forcing
    their id onto every order they create would be wrong, not safer.

    Guest/customer checkout must accept the T&C (422 otherwise); admin-created
    orders skip this the same way they skip the user_id override — there's no
    checkbox behind a phone order placed on a customer's behalf.
    """
    is_admin_caller = bool(user and user.role == ROLE_ADMIN)

    if user and user.is_blocked:
        raise HTTPException(status_code=403, detail="This account has been suspended. Contact support.")

    if not is_admin_caller:
        # Admin phone/manual orders skip the throttle same as they skip T&C —
        # an admin isn't the abuse case this guards against.
        throttle_key = login_throttle.client_key(request, "order")
        if login_throttle.is_locked(throttle_key, ORDER_MAX_PER_IP):
            raise _TOO_MANY_ORDERS
        login_throttle.record_failure(throttle_key)

    if payload.payment_method not in PAYMENT_METHODS:
        raise HTTPException(
            status_code=422, detail=f"payment_method must be one of {PAYMENT_METHODS}"
        )

    if not is_admin_caller and (not payload.terms_accepted or not payload.terms_version):
        # Require BOTH the acceptance flag and the version it was accepted at —
        # a consent record with a null version defeats the audit trail this
        # gate exists to create.
        raise HTTPException(
            status_code=422,
            detail="You must accept the Terms & Conditions to place an order.",
        )

    # Validate + price BEFORE touching stock — an order referencing an unknown
    # product is rejected outright, so there's nothing to roll back.
    prices, flag_reason = await _authoritative_pricing(db, payload.items)

    await _reserve_stock(db, payload.items)

    effective_user_id = str(user.id) if user and user.role != ROLE_ADMIN else payload.user_id

    subtotal = sum(prices[item.product_id] * item.quantity for item in payload.items)
    coupon_code, discount_amount = (
        await _redeem_coupon(db, payload.coupon_code, subtotal)
        if payload.coupon_code
        else (None, Decimal("0"))
    )
    order_total = subtotal - discount_amount

    settings = get_settings()
    cod_deposit = Decimal(settings.cod_deposit_amount)

    # COD orders placed through the STOREFRONT (guest/customer) require a
    # non-refundable confirmation deposit paid online (Razorpay) at checkout;
    # the balance (total - deposit) is paid on delivery. Orders under the
    # deposit amount can't use COD — they must pay in full online instead.
    # Admin-created (phone/manual) orders skip this — there's no checkout or
    # Razorpay modal behind them.
    deposit_amount = Decimal("0")
    if payload.payment_method == "cod" and not is_admin_caller:
        if order_total < cod_deposit:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"This order totals {order_total} which is below the ₹{cod_deposit} COD "
                    f"confirmation deposit. Cash on Delivery isn't available — please pay online instead."
                ),
            )
        deposit_amount = cod_deposit

    order = Order(
        user_id=effective_user_id,
        status="pending",
        payment_method=payload.payment_method,
        shipping_address=payload.shipping_address.model_dump() if payload.shipping_address else {},
        terms_version=payload.terms_version if payload.terms_accepted else None,
        terms_accepted_at=datetime.now(timezone.utc) if payload.terms_accepted else None,
        coupon_code=coupon_code,
        discount_amount=discount_amount,
        total_amount=order_total,
        deposit_amount=deposit_amount,
        flagged=flag_reason is not None,
        flag_reason=flag_reason,
        ip_address=client_ip(request)[:64] or None,
        # Truncated, not validated: a User-Agent is client-supplied and can be
        # any length or content. It is only ever displayed as a derived label
        # in the admin, never parsed for a decision.
        user_agent=(request.headers.get("user-agent") or "")[:256] or None,
    )
    for item in payload.items:
        order.items.append(
            OrderItem(
                product_id=item.product_id,
                quantity=item.quantity,
                unit_price=prices[item.product_id],
            )
        )
    db.add(order)
    await db.commit()
    await db.refresh(order, attribute_names=["items"])

    # Storefront orders (guest/customer) confirm via online payment — prepaid
    # pays in full, COD pays its deposit — so the confirmation email is sent
    # from the razorpay/verify endpoint once payment clears. Admin-created
    # (phone/manual) orders collect nothing online, so confirm them here.
    notify_email = await _resolve_order_email(db, order)
    if is_admin_caller and notify_email:
        background_tasks.add_task(send_order_confirmation_email, notify_email, str(order.id))

    # This endpoint is dual-purpose: guest/customer checkout AND admin
    # phone/manual order entry. An admin placing a phone order legitimately
    # wants the price-tampering flag surfaced immediately in the response
    # (there's no other UI moment for it); a guest/customer must never see
    # it (see OrderRead's docstring). response_model=None below so the
    # returned schema instance's own fields decide the JSON shape instead of
    # a single static response_model filtering both cases identically.
    schema = OrderAdminRead if is_admin_caller else OrderRead
    return schema.model_validate(order)


@router.get("", response_model=list[OrderRead])
async def list_orders(
    user_id: str,
    current_user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[Order]:
    """List orders for a user — the caller's own order history.

    Auth required: `user_id` must match the signed-in account (or the caller
    must be an admin). Without this check, anyone could read anyone else's
    order history just by guessing/knowing their id.
    """
    if user_id != str(current_user.id) and current_user.role != ROLE_ADMIN:
        raise HTTPException(status_code=403, detail="Cannot view another account's orders")

    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.user_id == user_id)
        .order_by(Order.created_at.desc())
    )
    return list(result.scalars().all())


# Registered before GET /{order_id} so "/all" matches this literal route
# rather than being parsed as an order id.
@router.get("/all", response_model=list[OrderAdminRead], dependencies=[Depends(require_staff)])
async def list_all_orders(
    q: str | None = None,
    status: str | None = None,
    abandoned: bool = False,
    db: AsyncSession = Depends(get_db_session),
) -> list[Order]:
    """Every order, newest first — the admin console Orders screen. Admin-gated.

    `q` searches the fields a support conversation actually starts from. A
    customer escalating never opens with an internal id — they quote the
    courier's AWB from a tracking SMS, or the phone number they ordered with,
    or just their email. Each of those has to find the order:

      * order id, whole or partial (the console shows the first 8 characters)
      * tracking number / AWB, and courier name
      * customer email — both a guest checkout, where the email IS the
        user_id, and a registered account, looked up through the users table
      * anything in the shipping address snapshot: name, phone, street, city,
        pincode

    Matching is case-insensitive and substring-based. Deliberately server-side:
    filtering in the browser would only ever search the page already loaded.
    """
    statement = select(Order).options(selectinload(Order.items))

    # Narrows to checkouts the customer started paying for and left. See
    # abandoned_payment_clause for why this is not just "pending".
    if abandoned:
        statement = statement.where(abandoned_payment_clause())

    # The morning question — "what still needs shipping?" — could not be asked
    # at all before this. Several statuses can be passed comma-separated, so
    # one request covers an "open orders" view (pending,confirmed).
    if status:
        wanted = [s.strip() for s in status.split(",") if s.strip()]
        unknown = [s for s in wanted if s not in FULFILMENT_STATUSES]
        if unknown:
            raise HTTPException(
                status_code=422,
                detail=f"unknown status: {', '.join(unknown)}. Must be one of {FULFILMENT_STATUSES}",
            )
        if wanted:
            statement = statement.where(Order.status.in_(wanted))

    term = (q or "").strip()
    if term:
        like = f"%{term}%"
        # A UUID renders with dashes on Postgres and as bare hex on SQLite, and
        # someone pasting an id may include them or not. Matching both spellings
        # means the same search works either way.
        like_nodash = f"%{term.replace('-', '')}%"

        # Resolved as its own query rather than a subquery on purpose. An
        # order stores the account's UUID as a string, and the two databases
        # render a UUID column differently — dashed on Postgres, bare hex on
        # SQLite — so an in-SQL comparison silently matches nothing on one of
        # them. Reading the ids out and formatting them in Python is the same
        # spelling everywhere.
        matching_accounts = await db.execute(select(User.id).where(User.email.ilike(like)))
        account_ids = [str(row) for row in matching_accounts.scalars().all()]

        clauses = [
            cast(Order.id, Text).ilike(like),
            cast(Order.id, Text).ilike(like_nodash),
            Order.user_id.ilike(like),
            Order.tracking_number.ilike(like),
            Order.courier.ilike(like),
            # The address is a JSON snapshot, so there are no columns to
            # target — cast the whole blob to text and search it. Covers
            # phone, pincode and street, which is what support asks for.
            cast(Order.shipping_address, Text).ilike(like),
        ]
        if account_ids:
            clauses.append(Order.user_id.in_(account_ids))
        statement = statement.where(or_(*clauses))

    result = await db.execute(statement.order_by(Order.created_at.desc()))
    return list(result.scalars().all())


@router.get("/{order_id}", response_model=OrderRead)
async def get_order(order_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)) -> Order:
    """Fetch a single order by id — deliberately public.

    This is the storefront's guest "Track Order" lookup: the order id itself
    (a UUID, unguessable) is the credential, so no login is required to check
    on a purchase made without an account.
    """
    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


FULFILMENT_STATUSES = {
    "pending", "confirmed", "shipped", "delivered", "cancelled", "returned",
}
# The two that end an order and give its stock back. Everything else means the
# order is still live and still holding its units.
ENDED_STATUSES = {"cancelled", "returned"}

# A prepaid checkout either completes within minutes or not at all — the
# Razorpay modal is open on the page the customer is looking at, and there
# is no later step that could finish it. Two hours is well past any
# realistic retry, and short enough that the list is actionable the same
# day. Deliberately not the 24h the console uses for unattended orders:
# those two numbers answer different questions.
ABANDONED_PAYMENT_AFTER = timedelta(hours=2)


def abandoned_payment_clause():
    """Orders where the customer walked away from the payment page.

    Worth naming once rather than spelling out at each call site, because
    the distinction it draws is the whole point: an unpaid *prepaid* order
    is a sale that did not happen and there is nothing to pack, whereas an
    unpaid *COD* order is a sale that did happen and is waiting on someone
    to pack it. Both sit at pending/unpaid and look identical in a list.
    Acting on one as though it were the other is either shipping goods
    nobody paid for, or ignoring an order that was placed."""
    cutoff = datetime.now(timezone.utc) - ABANDONED_PAYMENT_AFTER
    return and_(
        Order.payment_method == "prepaid",
        Order.payment_status == "unpaid",
        Order.status == "pending",
        Order.created_at < cutoff,
    )


def _money_state(order: Order) -> dict:
    """The fields an audit entry about money needs to compare.

    Pulled into one place so the before- and after-snapshots cannot drift:
    a field added to one and forgotten in the other silently stops being
    audited, which is the failure mode nobody notices until it matters.
    """
    return {
        "payment_status": order.payment_status,
        "refund_amount": order.refund_amount,
        "refund_reference": order.refund_reference,
    }


async def _apply_status(db: AsyncSession, order: Order, status: str) -> None:
    """Move one order to `status`, keeping its stock reservation honest.

    Shared by the single and bulk endpoints on purpose: a bulk "mark cancelled"
    that skipped this would reintroduce exactly the bug Phase 1 fixed, only
    twenty orders at a time. Does not commit — the caller decides the
    transaction boundary, which is what makes a bulk update all-or-nothing.
    """
    if status in ENDED_STATUSES and not order.stock_released:
        await stock.release(db, order.items)
        order.stock_released = True
    elif status not in ENDED_STATUSES and order.stock_released:
        # The units freed by a cancellation may have been sold since, so this
        # can legitimately fail. Refuse rather than push stock negative.
        short = await stock.shortfalls(db, order.items)
        if short:
            name, available, wanted = short[0]
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Cannot reinstate this order: not enough stock for {name} "
                    f"({available} left, {wanted} needed). It was released when the "
                    "order was cancelled and has since been sold."
                ),
            )
        await stock.reserve(db, order.items)
        order.stock_released = False

    order.status = status


async def _notify_if_shipped(
    db: AsyncSession, order: Order, status: str, background_tasks: BackgroundTasks
) -> None:
    if status != "shipped":
        return
    notify_email = await _resolve_order_email(db, order)
    if notify_email:
        background_tasks.add_task(
            send_order_shipped_email,
            notify_email,
            str(order.id),
            order.courier,
            order.tracking_number,
        )


class BulkStatusUpdate(BaseModel):
    order_ids: list[uuid.UUID] = Field(..., min_length=1, max_length=200)
    status: str


# Declared BEFORE /{order_id}/status: FastAPI matches in declaration order, and
# the parameterised route would otherwise swallow "bulk" as an order id and
# fail UUID parsing with a 422 that says nothing useful.
@router.patch("/bulk/status", response_model=list[OrderAdminRead])
async def bulk_update_status(
    payload: BulkStatusUpdate,
    background_tasks: BackgroundTasks,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    actor: User = Depends(require_staff),
) -> list[Order]:
    """Move several orders to the same fulfilment status at once. Admin-gated.

    Exists because a pickup is a batch: twenty packed parcels previously meant
    twenty dropdowns, and the cost of a good sales day scaled with it.

    All-or-nothing. One commit covers every order, so if reinstating one of
    them would oversell, none of them move — a half-applied bulk update is
    worse than a refused one, because nothing on screen says which half.
    """
    if payload.status not in FULFILMENT_STATUSES:
        raise HTTPException(
            status_code=422, detail=f"status must be one of {FULFILMENT_STATUSES}"
        )

    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id.in_(payload.order_ids))
    )
    orders = list(result.scalars().all())
    if len(orders) != len(set(payload.order_ids)):
        found = {o.id for o in orders}
        missing = [str(i) for i in set(payload.order_ids) - found]
        raise HTTPException(
            status_code=404,
            detail=f"{len(missing)} of these orders no longer exist: {', '.join(missing[:5])}",
        )

    for order in orders:
        was = order.status
        await _apply_status(db, order, payload.status)
        await audit.record(
            db,
            actor=actor,
            request=request,
            action="order.status",
            entity_type="order",
            entity_id=order.id,
            entity_label=audit.order_label(order.id),
            summary=f"Marked as {payload.status} (one of {len(orders)} in a batch)",
            changes={"status": {"from": was, "to": payload.status}},
        )

    await db.commit()
    for order in orders:
        await db.refresh(order, attribute_names=["items"])
        await _notify_if_shipped(db, order, payload.status, background_tasks)
    return orders


@router.patch("/{order_id}/status", response_model=OrderAdminRead)
async def update_order_status(
    order_id: uuid.UUID,
    status: str,
    background_tasks: BackgroundTasks,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    actor: User = Depends(require_staff),
) -> Order:
    """Update fulfilment status: pending → confirmed → shipped → delivered,
    plus the off-ramps cancelled / returned."""
    if status not in FULFILMENT_STATUSES:
        raise HTTPException(
            status_code=422, detail=f"status must be one of {FULFILMENT_STATUSES}"
        )
    # Items are eager-loaded because releasing or re-reserving stock reads
    # them; a lazy load here would raise MissingGreenlet under asyncio rather
    # than quietly issuing a query.
    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    was = order.status
    await _apply_status(db, order, status)
    await audit.record(
        db,
        actor=actor,
        request=request,
        action="order.status",
        entity_type="order",
        entity_id=order.id,
        entity_label=audit.order_label(order.id),
        summary=f"Marked as {status}",
        changes={"status": {"from": was, "to": status}},
    )
    await db.commit()
    await db.refresh(order, attribute_names=["items"])
    await _notify_if_shipped(db, order, status, background_tasks)
    return order


@router.patch("/{order_id}/payment", response_model=OrderAdminRead)
async def update_payment_status(
    order_id: uuid.UUID,
    payment_status: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    actor: User = Depends(require_admin),
) -> Order:
    """Update payment status: unpaid → paid → refunded. Admin-gated.

    Manual until the payment gateway is wired; a real gateway would drive these
    transitions from its webhook (payment.captured / refund.processed) instead.
    """
    if payment_status not in PAYMENT_STATUSES:
        raise HTTPException(
            status_code=422, detail=f"payment_status must be one of {PAYMENT_STATUSES}"
        )
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    # Choosing "refunded" from the dropdown is a statement that the whole order
    # came back, so record that as an amount too. Without this the status said
    # refunded while refund_amount stayed zero, and the books disagreed with
    # the screen — the exact ambiguity this phase exists to remove. A refund
    # already recorded through /refund is left alone.
    before = _money_state(order)

    if payment_status == "refunded" and order.refund_amount <= 0:
        order.refund_amount = order.total_amount
        order.refunded_at = datetime.now(timezone.utc)
    # Moving back off a refunded state clears the record rather than leaving a
    # refund attached to an order that is no longer refunded.
    if payment_status in {"unpaid", "paid"}:
        order.refund_amount = Decimal("0")
        order.refunded_at = None
        order.refund_reference = None

    order.payment_status = payment_status
    await audit.record(
        db,
        actor=actor,
        request=request,
        action="order.payment",
        entity_type="order",
        entity_id=order.id,
        entity_label=audit.order_label(order.id),
        summary=f"Payment marked {payment_status}",
        changes=audit.diff(before, _money_state(order)),
    )
    await db.commit()
    await db.refresh(order, attribute_names=["items"])
    return order


@router.patch("/{order_id}/flag", response_model=OrderAdminRead)
async def flag_order(
    order_id: uuid.UUID,
    flagged: bool,
    request: Request,
    reason: str | None = None,
    db: AsyncSession = Depends(get_db_session),
    actor: User = Depends(require_staff),
) -> Order:
    """Manually flag or clear an order for review. Admin-gated.

    Separate from the automatic price-tampering flag set at order creation
    (see `_authoritative_pricing`) — this is the human-initiated version, for
    an order that looks off for reasons no automated check catches (a
    suspicious address pattern, a coupon-abuse hit from the Fraud screen,
    a support call). Both share the same `flagged`/`flag_reason` columns."""
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    was = {"flagged": order.flagged, "flag_reason": order.flag_reason}
    order.flagged = flagged
    order.flag_reason = reason if flagged else None
    await audit.record(
        db,
        actor=actor,
        request=request,
        action="order.flag",
        entity_type="order",
        entity_id=order.id,
        entity_label=audit.order_label(order.id),
        summary=(
            f"Flagged for review: {reason}" if flagged and reason
            else "Flagged for review" if flagged
            else "Cleared the review flag"
        ),
        changes=audit.diff(was, {"flagged": order.flagged, "flag_reason": order.flag_reason}),
    )
    await db.commit()
    await db.refresh(order, attribute_names=["items"])
    return order


@router.patch("/{order_id}/shipping", response_model=OrderAdminRead)
async def update_shipping(
    order_id: uuid.UUID,
    request: Request,
    courier: str | None = None,
    tracking_number: str | None = None,
    db: AsyncSession = Depends(get_db_session),
    actor: User = Depends(require_staff),
) -> Order:
    """Set the courier + tracking number for an order. Admin-gated.

    Manual today; a courier-API integration (Shiprocket/Delhivery) would call
    this same field set from its own webhook once wired.
    """
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    was = {"courier": order.courier, "tracking_number": order.tracking_number}
    if courier is not None:
        order.courier = courier
    if tracking_number is not None:
        order.tracking_number = tracking_number
    now = {"courier": order.courier, "tracking_number": order.tracking_number}
    await audit.record(
        db,
        actor=actor,
        request=request,
        action="order.shipping",
        entity_type="order",
        entity_id=order.id,
        entity_label=audit.order_label(order.id),
        summary=f"Dispatch details set: {order.courier or 'no courier'} "
        f"{order.tracking_number or '(no tracking number)'}",
        changes=audit.diff(was, now),
    )
    await db.commit()
    await db.refresh(order, attribute_names=["items"])
    return order


class RefundCreate(BaseModel):
    """One refund against an order. Partial by default — `amount` is what is
    going back now, not the order total."""

    amount: Decimal = Field(..., gt=0, decimal_places=2)
    # Whatever identifies the refund at the other end: a Razorpay refund id, a
    # UPI reference, or a note like "cash returned at the door" for COD.
    reference: str | None = Field(default=None, max_length=128)


@router.post("/{order_id}/refund", response_model=OrderAdminRead)
async def refund_order(
    order_id: uuid.UUID,
    payload: RefundCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    actor: User = Depends(require_admin),
) -> Order:
    """Record money going back to the customer. Admin-gated.

    Records the refund; it does not call Razorpay. The money is moved in the
    Razorpay dashboard (or handed back in cash for COD) and this is the ledger
    entry — which is what was missing, since a refund previously existed only
    as the word "refunded" with no amount, date or reference.

    Refunds accumulate, so a ₹200 and then a ₹249 refund on a ₹449 order add up
    to a fully refunded order. Each one is checked against what is left rather
    than the total, so a series of partials cannot exceed the order between
    them.
    """
    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.id == order_id).with_for_update()
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    # A COD order where the cash was never collected has nothing to give back.
    # Recording a refund against it would invent an outgoing payment.
    # "refunded" is allowed through deliberately: an already-refunded order has
    # nothing left, but that is a fact about the amount, not about whether it
    # was paid. Letting it fall to the remaining-balance check below produces
    # the accurate message ("exceeds the 0 still refundable") instead of the
    # misleading "this order is not paid".
    if order.payment_status not in {"paid", "partially_refunded", "refunded"}:
        raise HTTPException(
            status_code=409,
            detail=(
                "This order is not paid, so there is nothing to refund. Mark it paid "
                "first if the money was collected outside the system."
            ),
        )

    before = _money_state(order)
    already = order.refund_amount or Decimal("0")
    remaining = order.total_amount - already
    if payload.amount > remaining:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Refund of {payload.amount} exceeds the {remaining} still refundable "
                f"on this order (total {order.total_amount}, already refunded {already})."
            ),
        )

    order.refund_amount = already + payload.amount
    order.refunded_at = datetime.now(timezone.utc)
    if payload.reference:
        order.refund_reference = payload.reference
    order.payment_status = (
        "refunded" if order.refund_amount >= order.total_amount else "partially_refunded"
    )

    await audit.record(
        db,
        actor=actor,
        request=request,
        action="order.refund",
        entity_type="order",
        entity_id=order.id,
        entity_label=audit.order_label(order.id),
        summary=(
            f"Refunded ₹{payload.amount} of ₹{order.total_amount}"
            + (f" — {payload.reference}" if payload.reference else "")
        ),
        changes=audit.diff(before, _money_state(order)),
    )
    await db.commit()
    await db.refresh(order, attribute_names=["items"])
    return order


@router.delete("/{order_id}", status_code=204)
async def delete_order(
    order_id: uuid.UUID,
    request: Request,
    restock: bool = True,
    db: AsyncSession = Depends(get_db_session),
    actor: User = Depends(require_admin),
) -> None:
    """Permanently delete an order. Admin-gated.

    Exists because the live catalogue accumulates test orders that would
    otherwise sit in the console forever, skewing every count on the
    dashboard.

    Two guards, both deliberate:

    * A paid order cannot be deleted. Money changed hands, so the row is a
      financial record — refund it and mark it refunded instead. 409 rather
      than a silent no-op so the console can say why.
    * Deleting returns the stock the order reserved, unless `restock=false`.
      _reserve_stock decrements attrs["stock"] at creation; dropping the order
      without putting those units back leaks inventory quietly, and for test
      orders that is exactly the stock the shop then cannot sell. Untracked
      products (no numeric stock in attrs) are skipped, matching how
      _reserve_stock treats them.

    Items cascade with the order (Order.items is cascade="all, delete-orphan").
    """
    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.payment_status == "paid":
        raise HTTPException(
            status_code=409,
            detail="This order is marked paid. Refund it and set payment to refunded "
            "before deleting, so the payment record is not lost.",
        )

    # Guarded on stock_released, not just the `restock` flag: an order that was
    # already cancelled or had its return approved has given its units back
    # once already, and deleting it must not hand them out a second time.
    restocked = restock and not order.stock_released
    if restocked:
        await stock.release(db, order.items)

    # Recorded before the delete, while the order can still be read. This is
    # the one action where the audit entry is the only surviving evidence,
    # so it carries the totals rather than just the id.
    await audit.record(
        db,
        actor=actor,
        request=request,
        action="order.delete",
        entity_type="order",
        entity_id=order.id,
        entity_label=audit.order_label(order.id),
        summary=f"Deleted the order (₹{order.total_amount}, {order.payment_status})",
        changes={
            "total_amount": {"from": order.total_amount, "to": None},
            "status": {"from": order.status, "to": None},
            "payment_status": {"from": order.payment_status, "to": None},
            "restocked": {"from": None, "to": restocked},
        },
    )

    await db.delete(order)
    await db.commit()


# ---- Razorpay online payment (prepaid orders) ----
# Guests check out unauthenticated, so the order id (an unguessable UUID) is the
# credential — the same model as the public GET /{order_id} tracker.

class RazorpayVerifyRequest(BaseModel):
    """Client confirms a captured Razorpay payment with its signature."""

    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@router.post("/{order_id}/razorpay/init")
async def init_razorpay_payment(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Create a Razorpay payment order for an unpaid prepaid order.

    The Key Secret stays server-side here. The returned `key_id` is public and
    is what the checkout SDK needs to open the modal.
    """
    if not razorpay_enabled():
        raise HTTPException(status_code=503, detail="Online payment isn't configured yet")

    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.payment_method not in {"prepaid", "cod"}:
        raise HTTPException(status_code=400, detail="This order isn't an online/deposit order")

    # What we collect now: prepaid pays the full total; COD pays its
    # confirmation deposit (the balance is collected on delivery).
    if order.payment_method == "cod":
        if order.deposit_paid:
            raise HTTPException(status_code=400, detail="This order's deposit is already collected")
        if not order.deposit_amount or order.deposit_amount <= 0:
            raise HTTPException(status_code=400, detail="No COD deposit is due on this order")
        charge = order.deposit_amount
    else:  # prepaid
        if order.payment_status == "paid":
            raise HTTPException(status_code=400, detail="This order is already paid")
        charge = order.total_amount

    try:
        rzp = create_razorpay_order(
            charge, f"order_{order.id}", {"order_id": str(order.id)}
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    # Bind this order to the Razorpay order id we just minted. /verify checks
    # the client-supplied razorpay_order_id against this exact value before
    # trusting any signature — a signature proves a payment happened, never
    # which internal order it was for, so without this the same valid
    # signature could be replayed against a different order's /verify.
    order.razorpay_order_id = rzp["id"]
    await db.commit()

    return {
        "ok": True,
        "razorpay_order_id": rzp["id"],
        "amount": rzp["amount"],
        "currency": rzp["currency"],
        "key_id": get_settings().razorpay_key_id,
    }


@router.post("/{order_id}/razorpay/verify", response_model=OrderRead)
async def verify_razorpay_payment(
    order_id: uuid.UUID,
    payload: RazorpayVerifyRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session),
) -> Order:
    """Verify a captured payment's signature and mark the order paid.

    The signature proves Razorpay actually captured the money for THIS order —
    the client can't self-report a successful payment.
    """
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.payment_method not in {"prepaid", "cod"}:
        raise HTTPException(status_code=400, detail="This order isn't an online/deposit order")

    # Idempotent: a retried verify is fine.
    if order.payment_method == "prepaid" and order.payment_status == "paid":
        return order
    if order.payment_method == "cod" and order.deposit_paid:
        return order

    # The signature alone only proves SOME payment was captured — it says
    # nothing about which internal order it was for. Require the client's
    # razorpay_order_id to match the one THIS order was issued at /init;
    # otherwise a signature paid for order A (e.g. a genuine ₹1 purchase)
    # could be replayed against order B's /verify to mark it paid for free.
    if not order.razorpay_order_id or payload.razorpay_order_id != order.razorpay_order_id:
        raise HTTPException(status_code=400, detail="Payment verification failed")

    if not verify_payment_signature(
        payload.razorpay_order_id,
        payload.razorpay_payment_id,
        payload.razorpay_signature,
    ):
        raise HTTPException(status_code=400, detail="Payment verification failed")

    # Keep the reference to the payment that was just proved. Without it a bank
    # settlement cannot be tied back to this order, and Razorpay's refund API
    # -- which takes a payment id, not an order id -- cannot be called from our
    # own records.
    order.razorpay_payment_id = payload.razorpay_payment_id

    if order.payment_method == "cod":
        # Deposit collected; the balance is still owed on delivery.
        order.deposit_paid = True
    else:
        order.payment_status = "paid"
    await db.commit()
    await db.refresh(order, attribute_names=["items"])

    notify_email = await _resolve_order_email(db, order)
    if notify_email:
        background_tasks.add_task(send_order_confirmation_email, notify_email, str(order.id))

    return order
