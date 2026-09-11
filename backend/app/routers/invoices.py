"""Invoice endpoints.

  POST /api/orders/{id}/invoice  — issue the invoice for an order (admin)
  GET  /api/orders/{id}/invoice  — fetch it (admin)
  GET  /api/invoices             — every invoice, newest first (admin)

Issuing is admin-only and deliberately explicit rather than automatic on
payment: the number series is a legal record, and an invoice raised for an
order that turns out to be a test or a duplicate cannot simply be deleted
without leaving a hole in it.
"""
import uuid
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db_session
from app.dependencies.auth import require_admin
from app.models.invoice import Invoice
from app.models.order import Order
from app.services.invoicing import build_invoice

router = APIRouter(tags=["invoices"])


class InvoiceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    order_id: uuid.UUID
    number: str
    financial_year: str
    issued_at: datetime
    # False means a bill of supply: the shop has no GSTIN, so no tax was
    # charged and none is shown.
    is_tax_invoice: bool
    seller_name: str
    seller_gstin: str | None
    seller_address: str
    seller_state: str
    buyer_name: str
    buyer_address: str
    place_of_supply: str
    intra_state: bool
    taxable_value: Decimal
    cgst: Decimal
    sgst: Decimal
    igst: Decimal
    total: Decimal
    lines: list[dict]


async def _load_order(db: AsyncSession, order_id: uuid.UUID) -> Order:
    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


async def _existing(db: AsyncSession, order_id: uuid.UUID) -> Invoice | None:
    result = await db.execute(select(Invoice).where(Invoice.order_id == order_id))
    return result.scalar_one_or_none()


@router.post(
    "/api/orders/{order_id}/invoice",
    response_model=InvoiceRead,
    status_code=201,
    dependencies=[Depends(require_admin)],
)
async def issue_invoice(
    order_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)
) -> Invoice:
    """Issue the invoice for an order. Admin-gated.

    Idempotent: an order already invoiced returns the invoice it has, with a
    200 rather than a new number. Burning a second number on the same sale
    would leave the series describing two transactions where there was one.
    """
    order = await _load_order(db, order_id)

    already = await _existing(db, order_id)
    if already is not None:
        return already

    # Nothing to invoice on an order that was never paid for. A COD order is
    # invoiced when the cash is collected and the order marked paid, which is
    # also when the sale actually happened.
    if order.payment_status == "unpaid":
        raise HTTPException(
            status_code=409,
            detail=(
                "This order is not paid, so there is nothing to invoice yet. "
                "Mark it paid once the money is collected."
            ),
        )

    invoice = await build_invoice(db, order)
    db.add(invoice)
    await db.commit()
    await db.refresh(invoice)
    return invoice


@router.get(
    "/api/orders/{order_id}/invoice",
    response_model=InvoiceRead,
    dependencies=[Depends(require_admin)],
)
async def get_invoice(
    order_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)
) -> Invoice:
    invoice = await _existing(db, order_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="No invoice has been issued for this order")
    return invoice


@router.get("/api/invoices", response_model=list[InvoiceRead], dependencies=[Depends(require_admin)])
async def list_invoices(db: AsyncSession = Depends(get_db_session)) -> list[Invoice]:
    """Every invoice, newest first — the register an accountant asks for."""
    result = await db.execute(select(Invoice).order_by(Invoice.issued_at.desc()))
    return list(result.scalars().all())
