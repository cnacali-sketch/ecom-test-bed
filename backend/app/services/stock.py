"""Reserving and releasing the stock an order holds.

An order holds stock from the moment it is placed until it ends. There are
three ways it can end — cancelled, returned, deleted — and every one of them
has to give the units back exactly once.

"Exactly once" is why `Order.stock_released` exists rather than each endpoint
reacting to a status change. Approving a return already restocks *and* sets
the order to returned, so any rule of the form "restock when the status
becomes returned" double-counts. A flag on the order records whether its units
are currently held, and every path checks it, so the operations compose
regardless of the order they happen in.

Products with no numeric `attrs["stock"]` are untracked — most of the seeded
catalogue is — and are skipped everywhere here. That has to stay a valid,
sellable state, not an error and not an invented stock count.
"""
from __future__ import annotations

import uuid
from collections.abc import Iterable
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product


class _HasProductAndQuantity(Protocol):
    """Both OrderItem (persisted) and OrderItemCreate (inbound payload) fit."""

    product_id: uuid.UUID
    quantity: int


def quantities_by_product(
    items: Iterable[_HasProductAndQuantity],
) -> dict[uuid.UUID, int]:
    """Collapse line items to one total per product.

    Two lines for the same product must lock that product's row once, not
    twice — locking it twice in one transaction is how deadlocks start.
    """
    totals: dict[uuid.UUID, int] = {}
    for item in items:
        totals[item.product_id] = totals.get(item.product_id, 0) + item.quantity
    return totals


async def _locked_product(db: AsyncSession, product_id: uuid.UUID) -> Product | None:
    result = await db.execute(
        select(Product).where(Product.id == product_id).with_for_update()
    )
    return result.scalar_one_or_none()


def _tracked_stock(product: Product) -> int | float | None:
    stock = (product.attrs or {}).get("stock")
    return stock if isinstance(stock, (int, float)) else None


async def shortfalls(
    db: AsyncSession, items: Iterable[_HasProductAndQuantity]
) -> list[tuple[str, int | float, int]]:
    """Which products cannot cover the quantity asked for.

    Returns (name, available, wanted) per failing product. Empty means the
    whole order can be reserved.
    """
    failures: list[tuple[str, int | float, int]] = []
    for product_id, qty in quantities_by_product(items).items():
        product = await _locked_product(db, product_id)
        if product is None:
            continue
        stock = _tracked_stock(product)
        if stock is None:
            continue
        if stock < qty:
            failures.append((product.name, stock, qty))
    return failures


async def reserve(db: AsyncSession, items: Iterable[_HasProductAndQuantity]) -> None:
    """Take the units out of stock. Call `shortfalls` first — this does not
    check, so that the caller decides what a shortage means."""
    for product_id, qty in quantities_by_product(items).items():
        product = await _locked_product(db, product_id)
        if product is None:
            continue
        stock = _tracked_stock(product)
        if stock is None:
            continue
        remaining = stock - qty
        product.attrs = {**product.attrs, "stock": remaining}
        if remaining <= 0:
            product.in_stock = False


async def release(db: AsyncSession, items: Iterable[_HasProductAndQuantity]) -> None:
    """Put the units back, and make the product sellable again.

    Restoring `in_stock` matters as much as the number: reserving down to zero
    switches it off, so a release that only adjusted the count would leave a
    product with stock on hand that the storefront refuses to sell.
    """
    for product_id, qty in quantities_by_product(items).items():
        product = await _locked_product(db, product_id)
        if product is None:
            continue
        stock = _tracked_stock(product)
        if stock is None:
            continue
        restored = stock + qty
        product.attrs = {**product.attrs, "stock": restored}
        if restored > 0:
            product.in_stock = True
