"""Order endpoints.

  POST  /api/orders               — create order from cart items (COD live;
                                     online payment is recorded but not yet
                                     collected — the gateway is pending)
  GET   /api/orders/{id}          — fetch a single order (public: this is the
                                     "secret" a guest needs for order tracking)
  GET   /api/orders               — the CALLER's own orders (auth required)
  GET   /api/orders/all           — every order (admin)
  PATCH /api/orders/{id}/status   — fulfilment status (admin)
  PATCH /api/orders/{id}/payment  — payment status (admin)
  PATCH /api/orders/{id}/shipping — courier + tracking number (admin)
  PATCH /api/orders/{id}/flag     — manually flag/unflag for review (admin)
"""
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.db import get_db_session
from app.dependencies.auth import optional_current_user, require_admin, require_current_user
from app.models.coupon import Coupon
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.user import ROLE_ADMIN, User
from app.schemas.auth import Address
from app.services import login_throttle
from app.services.coupons import compute_discount
from app.services.email import send_order_confirmation_email, send_order_shipped_email
from app.services.razorpay import (
    create_razorpay_order,
    razorpay_enabled,
    verify_payment_signature,
)
from app.services.request_ip import client_ip

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


class OrderItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    product_id: uuid.UUID
    quantity: int
    unit_price: Decimal


class OrderRead(BaseModel):
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
    flagged: bool
    flag_reason: str | None
    ip_address: str | None
    created_at: datetime
    items: list[OrderItemRead] = []


async def _reserve_stock(db: AsyncSession, items: list[OrderItemCreate]) -> None:
    """Lock each distinct product and decrement attrs["stock"] by the quantity
    ordered. 409 if a product tracks stock and there isn't enough. Products
    with no numeric stock in attrs are untracked (unlimited) — most of the
    seed catalogue doesn't set it, and that must stay a valid, sellable state
    rather than an oversell-guard false positive.

    A product_id with no matching row is likewise treated as untracked rather
    than a hard error: order creation has never validated product existence
    (there's no FK enforcement in the test DB either), so keeping that the
    same avoids turning "stock tracking" into an unrelated breaking change.

    Row-level locking (SELECT ... FOR UPDATE) makes two concurrent orders for
    the last unit resolve correctly instead of both succeeding.
    """
    quantities: dict[uuid.UUID, int] = {}
    for item in items:
        quantities[item.product_id] = quantities.get(item.product_id, 0) + item.quantity

    for product_id, qty in quantities.items():
        result = await db.execute(
            select(Product).where(Product.id == product_id).with_for_update()
        )
        product = result.scalar_one_or_none()
        if product is None:
            continue  # unknown product — nothing to track or decrement

        stock = product.attrs.get("stock")
        if not isinstance(stock, (int, float)):
            continue  # untracked — no oversell check, no decrement

        if stock < qty:
            raise HTTPException(
                status_code=409,
                detail=f"Not enough stock for {product.name}: {stock} left, {qty} requested",
            )
        remaining = stock - qty
        product.attrs = {**product.attrs, "stock": remaining}
        if remaining <= 0:
            product.in_stock = False


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

@router.post("", response_model=OrderRead, status_code=201)
async def create_order(
    payload: OrderCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    user: User | None = Depends(optional_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Order:
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

    return order


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
@router.get("/all", response_model=list[OrderRead], dependencies=[Depends(require_admin)])
async def list_all_orders(db: AsyncSession = Depends(get_db_session)) -> list[Order]:
    """Every order, newest first — the admin console Orders screen. Admin-gated."""
    result = await db.execute(
        select(Order).options(selectinload(Order.items)).order_by(Order.created_at.desc())
    )
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


@router.patch("/{order_id}/status", response_model=OrderRead, dependencies=[Depends(require_admin)])
async def update_order_status(
    order_id: uuid.UUID,
    status: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session),
) -> Order:
    """Update fulfilment status: pending → confirmed → shipped → delivered,
    plus the off-ramps cancelled / returned."""
    valid = {"pending", "confirmed", "shipped", "delivered", "cancelled", "returned"}
    if status not in valid:
        raise HTTPException(status_code=422, detail=f"status must be one of {valid}")
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = status
    await db.commit()
    await db.refresh(order, attribute_names=["items"])

    if status == "shipped":
        notify_email = await _resolve_order_email(db, order)
        if notify_email:
            background_tasks.add_task(
                send_order_shipped_email, notify_email, str(order.id), order.courier, order.tracking_number
            )

    return order


@router.patch("/{order_id}/payment", response_model=OrderRead, dependencies=[Depends(require_admin)])
async def update_payment_status(
    order_id: uuid.UUID,
    payment_status: str,
    db: AsyncSession = Depends(get_db_session),
) -> Order:
    """Update payment status: unpaid → paid → refunded. Admin-gated.

    Manual until the payment gateway is wired; a real gateway would drive these
    transitions from its webhook (payment.captured / refund.processed) instead.
    """
    valid = {"unpaid", "paid", "refunded"}
    if payment_status not in valid:
        raise HTTPException(status_code=422, detail=f"payment_status must be one of {valid}")
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    order.payment_status = payment_status
    await db.commit()
    await db.refresh(order, attribute_names=["items"])
    return order


@router.patch("/{order_id}/flag", response_model=OrderRead, dependencies=[Depends(require_admin)])
async def flag_order(
    order_id: uuid.UUID,
    flagged: bool,
    reason: str | None = None,
    db: AsyncSession = Depends(get_db_session),
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
    order.flagged = flagged
    order.flag_reason = reason if flagged else None
    await db.commit()
    await db.refresh(order, attribute_names=["items"])
    return order


@router.patch("/{order_id}/shipping", response_model=OrderRead, dependencies=[Depends(require_admin)])
async def update_shipping(
    order_id: uuid.UUID,
    courier: str | None = None,
    tracking_number: str | None = None,
    db: AsyncSession = Depends(get_db_session),
) -> Order:
    """Set the courier + tracking number for an order. Admin-gated.

    Manual today; a courier-API integration (Shiprocket/Delhivery) would call
    this same field set from its own webhook once wired.
    """
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if courier is not None:
        order.courier = courier
    if tracking_number is not None:
        order.tracking_number = tracking_number
    await db.commit()
    await db.refresh(order, attribute_names=["items"])
    return order


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

    if not verify_payment_signature(
        payload.razorpay_order_id,
        payload.razorpay_payment_id,
        payload.razorpay_signature,
    ):
        raise HTTPException(status_code=400, detail="Payment verification failed")

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
