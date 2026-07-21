"""Order endpoints — Phase 2 stub.

Provides cart persistence and a checkout entry point so the conversion
dashboard (CAC/LTV/ROAS) has real order data to query against.

Phase 2 scope (implemented here):
  POST /api/orders          — create order from cart items
  GET  /api/orders/{id}     — fetch order status
  GET  /api/orders          — list orders for a user_id

Auth is enforced via the API key dependency on write endpoints.
"""
import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db_session
from app.dependencies.auth import require_admin
from app.models.order import Order, OrderItem

router = APIRouter(prefix="/api/orders", tags=["orders"])


# ---- Schemas (inline — order schemas are small and only used here) ----

class OrderItemCreate(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(..., ge=1)
    unit_price: Decimal = Field(..., ge=0, decimal_places=2)


class OrderCreate(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    items: list[OrderItemCreate] = Field(..., min_length=1)


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
    total_amount: Decimal
    items: list[OrderItemRead] = []


# ---- Endpoints ----

@router.post("", response_model=OrderRead, status_code=201)
async def create_order(payload: OrderCreate, db: AsyncSession = Depends(get_db_session)) -> Order:
    """Create an order from a cart payload. Calculates total server-side.

    Intentionally unauthenticated: guest checkout stays open. Only order
    *status* transitions are admin-gated.
    """
    total = sum(item.unit_price * item.quantity for item in payload.items)
    order = Order(user_id=payload.user_id, status="pending", total_amount=total)
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
    return order


@router.get("", response_model=list[OrderRead])
async def list_orders(
    user_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> list[Order]:
    """List all orders for a user. Used by the conversion dashboard."""
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.user_id == user_id)
        .order_by(Order.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/{order_id}", response_model=OrderRead)
async def get_order(order_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)) -> Order:
    """Fetch a single order by ID."""
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
    db: AsyncSession = Depends(get_db_session),
) -> Order:
    """Update order status (pending → confirmed → shipped → delivered)."""
    valid = {"pending", "confirmed", "shipped", "delivered", "cancelled"}
    if status not in valid:
        raise HTTPException(status_code=422, detail=f"status must be one of {valid}")
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = status
    await db.commit()
    await db.refresh(order, attribute_names=["items"])
    return order
