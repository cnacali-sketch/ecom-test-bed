"""Recording what the shelf held, once a day.

`inventory_snapshots` has existed since the first migration and has never been
written to. Nothing reads it either, which is the honest order to build this in:
a stock history is only worth having if it was being collected before anyone
needed it, and there is nothing to say about eleven lifetime orders across
thirty-three products that a trend line would not invent.

So this records, and stops there. No days-of-stock-left, no reorder point, no
forecast. Those need months of readings and a sales rate that is currently one
order every few days; adding them now would produce a number that looks like
analysis and is arithmetic on noise.

What is deliberately *not* recorded is as important. A product whose
`attrs["stock"]` is absent or null is untracked -- twenty-three of the
thirty-three live products are, and that is a valid, sellable state, not a
zero. Writing zero for them would say "sold out" in a table whose whole purpose
is to be read back later by something that cannot ask what the zero meant.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory_snapshot import InventorySnapshot
from app.models.product import Product

logger = logging.getLogger(__name__)


def tracked_quantity(product: Product) -> int | None:
    """The product's counted stock, or None when nobody is counting it.

    `bool` is excluded on purpose: it is an `int` subclass in Python, so a
    stray `"stock": true` would otherwise be recorded as a quantity of 1.
    """
    attrs = product.attrs or {}
    value = attrs.get("stock")
    if isinstance(value, bool) or not isinstance(value, int):
        return None
    return value


async def capture(db: AsyncSession, *, on: date | None = None) -> int:
    """Record today's stock level for every product that counts stock.

    Returns the number of readings written. Safe to call twice: a product that
    already has a reading for the day is skipped, so running the job by hand
    after it has already run on its timer is a no-op rather than a conflict.
    """
    day = on or datetime.now(timezone.utc).date()

    already = set(
        (
            await db.execute(
                select(InventorySnapshot.product_id).where(
                    InventorySnapshot.snapshot_date == day
                )
            )
        )
        .scalars()
        .all()
    )

    products = (await db.execute(select(Product))).scalars().all()

    written = 0
    for product in products:
        if product.id in already:
            continue
        quantity = tracked_quantity(product)
        if quantity is None:
            continue
        db.add(
            InventorySnapshot(
                product_id=product.id, quantity=quantity, snapshot_date=day
            )
        )
        written += 1

    if written:
        await db.commit()
    return written
