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
"""
import uuid
from decimal import Decimal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db_session
from app.dependencies.auth import optional_current_user, require_admin, require_current_user
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.user import ROLE_ADMIN, User
from app.schemas.auth import Address
from app.services.email import send_order_confirmation_email, send_order_shipped_email

router = APIRouter(prefix="/api/orders", tags=["orders"])


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
    total_amount: Decimal
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
    """
    if payload.payment_method not in PAYMENT_METHODS:
        raise HTTPException(
            status_code=422, detail=f"payment_method must be one of {PAYMENT_METHODS}"
        )

    await _reserve_stock(db, payload.items)

    effective_user_id = str(user.id) if user and user.role != ROLE_ADMIN else payload.user_id

    total = sum(item.unit_price * item.quantity for item in payload.items)
    order = Order(
        user_id=effective_user_id,
        status="pending",
        payment_method=payload.payment_method,
        shipping_address=payload.shipping_address.model_dump() if payload.shipping_address else {},
        total_amount=total,
    )
    for item in payload.items:
        order.items.append(
            OrderItem(
                product_id=item.product_id,
                quantity=item.quantity,
                unit_price=item.unit_price,
            )
        )
    db.add(order)
    await db.commit()
    await db.refresh(order, attribute_names=["items"])

    notify_email = await _resolve_order_email(db, order)
    if notify_email:
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
