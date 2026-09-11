"""Return-request endpoints.

  POST  /api/returns      — request a return on a delivered order (public:
                             order_id is the credential, same trust model as
                             the public order-tracking lookup — a guest
                             checkout has no account to gate this behind)
  GET   /api/returns       — every return request (admin)
  PATCH /api/returns/{id}  — approve/reject (admin); approving refunds the
                             order and restocks each item
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db_session
from app.dependencies.auth import require_admin
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.return_request import RETURN_STATUSES, ReturnRequest
from app.services import stock

router = APIRouter(prefix="/api/returns", tags=["returns"])


class ReturnRequestCreate(BaseModel):
    order_id: uuid.UUID
    reason: str = Field(..., min_length=1, max_length=500)
    pickup_requested: bool = False


class ReturnRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    order_id: uuid.UUID
    reason: str
    status: str
    pickup_requested: bool
    created_at: datetime
    resolved_at: datetime | None


@router.post("", response_model=ReturnRequestRead, status_code=201)
async def create_return_request(
    payload: ReturnRequestCreate, db: AsyncSession = Depends(get_db_session)
) -> ReturnRequest:
    """Request a return on an order. Deliberately public — the order id
    itself is the credential, same trust model as GET /api/orders/{id}: a
    guest checkout has no account to gate this behind."""
    result = await db.execute(select(Order).where(Order.id == payload.order_id))
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != "delivered":
        raise HTTPException(status_code=422, detail="Only delivered orders can be returned")

    existing = await db.execute(
        select(ReturnRequest).where(ReturnRequest.order_id == order.id, ReturnRequest.status == "pending")
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="A return request is already pending for this order")

    request = ReturnRequest(
        order_id=order.id, reason=payload.reason, pickup_requested=payload.pickup_requested
    )
    db.add(request)
    await db.commit()
    await db.refresh(request)
    return request


@router.get("", response_model=list[ReturnRequestRead], dependencies=[Depends(require_admin)])
async def list_return_requests(db: AsyncSession = Depends(get_db_session)) -> list[ReturnRequest]:
    result = await db.execute(select(ReturnRequest).order_by(ReturnRequest.created_at.desc()))
    return list(result.scalars().all())


@router.patch("/{request_id}", response_model=ReturnRequestRead, dependencies=[Depends(require_admin)])
async def update_return_request(
    request_id: uuid.UUID,
    status: str,
    db: AsyncSession = Depends(get_db_session),
) -> ReturnRequest:
    """Approve or reject a return request. Admin-gated. Approving refunds the
    order (payment_status -> refunded, status -> returned) and restocks each
    item; rejecting has no side effects on the order."""
    if status not in RETURN_STATUSES or status == "pending":
        raise HTTPException(status_code=422, detail="status must be 'approved' or 'rejected'")

    # Row-lock the request so two concurrent approve/reject calls can't both
    # pass the pending-check and double-restock — mirrors the coupon/stock
    # locking already used across this feature set.
    result = await db.execute(
        select(ReturnRequest).where(ReturnRequest.id == request_id).with_for_update()
    )
    request = result.scalar_one_or_none()
    if request is None:
        raise HTTPException(status_code=404, detail="Return request not found")
    if request.status != "pending":
        raise HTTPException(status_code=409, detail="This return request was already resolved")

    request.status = status
    request.resolved_at = datetime.now(timezone.utc)

    if status == "approved":
        order_result = await db.execute(
            select(Order).options(selectinload(Order.items)).where(Order.id == request.order_id)
        )
        order = order_result.scalar_one_or_none()
        if order is not None:
            # Only a genuinely-paid order can be refunded. A COD order still
            # unpaid (cash never collected) must NOT be marked "refunded" — that
            # would falsely imply money moved back. Restock and mark returned
            # either way; the payment transition is conditional on prior state.
            if order.payment_status == "paid":
                order.payment_status = "refunded"
            order.status = "returned"
            # Guarded, and the flag is set here: an order cancelled before the
            # return was approved has already given its units back, and a later
            # delete must not give them back a third time. See services/stock.py.
            if not order.stock_released:
                await stock.release(db, order.items)
                order.stock_released = True

    await db.commit()
    await db.refresh(request)
    return request
