"""Turn a paid order into an invoice.

Everything numeric comes from services/gst.py; this module is about where the
figures come from, how the document is numbered, and what gets frozen onto it.

Three rules shape it:

* **Issue once.** An order has at most one invoice. Asking again returns the
  one already issued rather than burning another number — a series with a hole
  in it is worse than no series.
* **Snapshot everything.** Names, addresses, HSN codes and rates are copied
  onto the invoice at issue. A later correction to a product must not rewrite
  a document a customer already has.
* **Never invent a tax status.** With no GSTIN configured the shop is not
  registered, and the correct document is a bill of supply with no tax lines —
  not a tax invoice with zeros in it.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.invoice import Invoice, InvoiceSequence
from app.models.order import Order
from app.services import gst


def _decimal(value, fallback: Decimal) -> Decimal:
    try:
        return Decimal(str(value))
    except Exception:
        return fallback


def product_tax_profile(product) -> tuple[str, Decimal]:
    """The HSN code and GST rate to bill a product at.

    Read from the product's own attrs when set, falling back to the shop
    defaults. Neither default is a legal classification — they exist so an
    invoice is never quietly issued with a blank code, and the real values are
    the shop's to set with their accountant.
    """
    settings = get_settings()
    attrs = (getattr(product, "attrs", None) or {}) if product is not None else {}
    hsn = attrs.get("hsn") or settings.default_hsn or ""
    rate = _decimal(attrs.get("gstRate"), _decimal(settings.default_gst_rate, Decimal("0")))
    return str(hsn), rate


async def _next_number(db: AsyncSession, year: str) -> int:
    """Reserve the next sequence number for a financial year.

    The counter row is locked for the transaction, so two invoices issued at
    the same instant cannot take the same number — which the unique constraint
    would reject anyway, but as a failed request rather than a correct one.
    """
    row = await db.execute(
        select(InvoiceSequence).where(InvoiceSequence.financial_year == year).with_for_update()
    )
    counter = row.scalar_one_or_none()
    if counter is None:
        counter = InvoiceSequence(financial_year=year, last_number=0)
        db.add(counter)
        await db.flush()
    counter.last_number += 1
    return counter.last_number


def _buyer_address(order: Order) -> tuple[str, str, str]:
    """Recipient name, printable address, and the state that decides the tax."""
    a = order.shipping_address or {}
    name = str(a.get("full_name") or "").strip()
    state = str(a.get("state") or "").strip()
    parts = [
        a.get("line1"),
        a.get("line2"),
        ", ".join(p for p in [a.get("city"), state] if p),
        a.get("postcode"),
        a.get("country"),
    ]
    address = "\n".join(str(p).strip() for p in parts if p and str(p).strip())
    return name, address, state


async def build_invoice(db: AsyncSession, order: Order) -> Invoice:
    """Issue the invoice for an order. Caller commits."""
    settings = get_settings()
    gstin = (settings.shop_gstin or "").strip()
    is_tax_invoice = bool(gstin)

    buyer_name, buyer_address, buyer_state = _buyer_address(order)
    intra = gst.is_intra_state(settings.shop_state, buyer_state)

    lines: list[dict] = []
    computed: list[gst.LineTax] = []
    for item in order.items:
        product = item.product
        hsn, rate = product_tax_profile(product)
        # A bill of supply carries no tax, so the rate is forced to zero rather
        # than printed as if it had been collected.
        effective_rate = rate if is_tax_invoice else Decimal("0")
        gross = (Decimal(item.unit_price) * item.quantity).quantize(Decimal("0.01"))
        split = gst.split_inclusive(gross, effective_rate, intra_state=intra)
        computed.append(split)
        lines.append(
            {
                "description": product.name if product is not None else "Item no longer listed",
                "sku": product.sku if product is not None else "",
                "hsn": hsn,
                "quantity": item.quantity,
                "unit_price": str(Decimal(item.unit_price).quantize(Decimal("0.01"))),
                "gross": str(split.total),
                "gst_rate": str(effective_rate),
                "taxable_value": str(split.taxable_value),
                "cgst": str(split.cgst),
                "sgst": str(split.sgst),
                "igst": str(split.igst),
            }
        )

    totals = gst.sum_lines(computed)
    issued = datetime.now(timezone.utc)
    year = gst.financial_year(issued)
    sequence = await _next_number(db, year)

    return Invoice(
        id=uuid.uuid4(),
        order_id=order.id,
        number=f"{settings.invoice_prefix}/{year}/{sequence:04d}",
        financial_year=year,
        sequence=sequence,
        issued_at=issued,
        is_tax_invoice=is_tax_invoice,
        seller_name=settings.shop_legal_name,
        seller_gstin=gstin or None,
        seller_address=settings.shop_address or "",
        seller_state=settings.shop_state or "",
        buyer_name=buyer_name,
        buyer_address=buyer_address,
        place_of_supply=buyer_state,
        intra_state=intra,
        taxable_value=totals.taxable_value,
        cgst=totals.cgst,
        sgst=totals.sgst,
        igst=totals.igst,
        total=totals.total,
        lines=lines,
    )
