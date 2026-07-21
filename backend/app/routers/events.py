"""Customer behavior tracking — first-party, no third-party analytics account
needed. Feeds the admin Analytics screen (event funnel + most-viewed products).

Reuses the pre-existing (previously unwired) UserEvent model/table: `user_id`
holds either a real signed-in account id or an anonymous per-browser session
id generated client-side, so behavior is attributable without requiring login.
"""
import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db_session
from app.dependencies.auth import require_admin
from app.models.product import Product
from app.models.user_event import UserEvent

router = APIRouter(prefix="/api/events", tags=["events"])

# Funnel stages, roughly in order: a shopper moves page_view -> product_view ->
# add_to_cart -> checkout_started -> order_placed. `search` is tracked
# separately (including zero-result searches client-side chooses to send).
EVENT_TYPES = {"page_view", "product_view", "add_to_cart", "checkout_started", "order_placed", "search"}


class EventCreate(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    event_type: str
    path: str = Field(default="", max_length=500)
    product_id: uuid.UUID | None = None
    query: str | None = Field(default=None, max_length=200)


@router.post("", status_code=204)
async def record_event(payload: EventCreate, db: AsyncSession = Depends(get_db_session)) -> None:
    """Ingest one behavior event. Public and fire-and-forget (sendBeacon-
    friendly): an unknown event_type is silently dropped rather than 422'd —
    a tracking call must never surface as a user-visible failure."""
    if payload.event_type not in EVENT_TYPES:
        return
    db.add(
        UserEvent(
            user_id=payload.user_id,
            event_type=payload.event_type,
            payload={
                "path": payload.path,
                "product_id": str(payload.product_id) if payload.product_id else None,
                "query": payload.query,
            },
        )
    )
    await db.commit()


class TopProduct(BaseModel):
    product_id: str
    name: str
    views: int


class EventSummary(BaseModel):
    counts: dict[str, int]
    top_products: list[TopProduct]
    total_events: int


@router.get("/summary", response_model=EventSummary, dependencies=[Depends(require_admin)])
async def events_summary(db: AsyncSession = Depends(get_db_session)) -> EventSummary:
    """Aggregate counts only — never returns raw per-user event rows.
    Feeds the admin Analytics screen: event-type funnel + most-viewed products.
    """
    counts_rows = await db.execute(select(UserEvent.event_type, func.count()).group_by(UserEvent.event_type))
    counts = {row[0]: row[1] for row in counts_rows.all()}
    total = sum(counts.values())

    # Top viewed products: tally product_view events by payload.product_id.
    # JSON field extraction differs by dialect (Postgres ->> vs SQLite
    # json_extract) — at this event volume, pulling product_view rows and
    # aggregating in Python is simpler and more portable than a dialect-
    # specific JSON query.
    view_rows = await db.execute(select(UserEvent.payload).where(UserEvent.event_type == "product_view"))
    tally: dict[str, int] = {}
    for (event_payload,) in view_rows.all():
        product_id = event_payload.get("product_id") if event_payload else None
        if product_id:
            tally[product_id] = tally.get(product_id, 0) + 1

    top_ids = sorted(tally, key=tally.get, reverse=True)[:10]
    products_by_id: dict[str, Product] = {}
    if top_ids:
        products_result = await db.execute(select(Product).where(Product.id.in_([uuid.UUID(pid) for pid in top_ids])))
        products_by_id = {str(p.id): p for p in products_result.scalars().all()}

    top_products = [
        TopProduct(
            product_id=pid,
            name=products_by_id[pid].name if pid in products_by_id else "Unknown product",
            views=tally[pid],
        )
        for pid in top_ids
    ]

    return EventSummary(counts=counts, top_products=top_products, total_events=total)
