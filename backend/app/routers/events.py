"""Customer behavior tracking — first-party, no third-party analytics account
needed. Feeds the admin Analytics screen (event funnel + most-viewed products).

Reuses the pre-existing (previously unwired) UserEvent model/table: `user_id`
holds either a real signed-in account id or an anonymous per-browser session
id generated client-side, so behavior is attributable without requiring login.
"""
import hashlib
import hmac
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_db_session
from app.dependencies.auth import require_admin
from app.models.product import Product
from app.models.user_event import UserEvent

router = APIRouter(prefix="/api/events", tags=["events"])

# Funnel stages, roughly in order: a shopper moves page_view -> product_view ->
# add_to_cart -> checkout_started -> order_placed. `search` is tracked
# separately (including zero-result searches client-side chooses to send).
EVENT_TYPES = {"page_view", "product_view", "add_to_cart", "checkout_started", "order_placed", "search"}

# Fraud/abuse summary tuning — same-IP repeats within this window past these
# counts get surfaced to the admin for review. Never auto-blocks (shared/
# mobile IPs can legitimately trip these); tune the thresholds if the demo
# catalogue's traffic volume makes them too noisy or too quiet.
FRAUD_WINDOW_HOURS = 24
AD_CLICK_FLAG_THRESHOLD = 5
CHECKOUT_FLAG_THRESHOLD = 5


def _hash_ip(ip: str) -> str:
    """HMAC-SHA256 of the client IP, truncated to 16 hex chars. Keyed on a
    dedicated fraud_hash_secret (not a bare hash) so it can't be trivially
    rainbow-tabled back to real IPs — only ever used to group repeat visits,
    never reversed. 64 bits is ample collision resistance at this volume."""
    settings = get_settings()
    digest = hmac.new(settings.fraud_hash_secret.encode(), ip.encode(), hashlib.sha256).hexdigest()
    return digest[:16]


def _client_ip(request: Request) -> str:
    """Best-effort client IP. NOTE: X-Forwarded-For is trusted as-is, which
    assumes the app sits behind a proxy that overwrites it (Cloudflare tunnel
    in dev). A client hitting the backend directly can forge this header — so
    the fraud signals it feeds are advisory leads to investigate, never an
    authorization or auto-block decision (which is why /fraud-summary is
    admin-gated and read-only)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class EventCreate(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    event_type: str
    path: str = Field(default="", max_length=500)
    product_id: uuid.UUID | None = None
    query: str | None = Field(default=None, max_length=200)
    # Ad click identifiers, present on the landing page_view when the visit
    # came from a Google or Meta ad. Feed the ad-click-fraud lens of
    # /fraud-summary below — stored in payload, not a dedicated column,
    # matching product_id/query already living there.
    gclid: str | None = Field(default=None, max_length=200)
    fbclid: str | None = Field(default=None, max_length=200)


@router.post("", status_code=204)
async def record_event(payload: EventCreate, request: Request, db: AsyncSession = Depends(get_db_session)) -> None:
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
                "gclid": payload.gclid,
                "fbclid": payload.fbclid,
            },
            ip_hash=_hash_ip(_client_ip(request)),
            user_agent=(request.headers.get("user-agent") or "")[:256] or None,
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


class AdClickFlag(BaseModel):
    ip_hash: str
    ad_click_count: int
    sample_user_agent: str | None


class CheckoutVelocityFlag(BaseModel):
    ip_hash: str
    checkout_event_count: int
    sample_user_agent: str | None


class FraudSummary(BaseModel):
    window_hours: int
    ad_click_flags: list[AdClickFlag]
    checkout_velocity_flags: list[CheckoutVelocityFlag]


@router.get("/fraud-summary", response_model=FraudSummary, dependencies=[Depends(require_admin)])
async def fraud_summary(db: AsyncSession = Depends(get_db_session)) -> FraudSummary:
    """Tag-only fraud/abuse signals for admin review — never auto-blocks.

    Two lenses, both derived from ip_hash grouping within FRAUD_WINDOW_HOURS:
    - ad_click_flags: the same IP hitting page_view with a gclid/fbclid
      (i.e. arriving via a Google/Meta ad) repeatedly — ad-click-fraud or bot
      traffic burning ad spend, the main concern once most traffic is paid.
    - checkout_velocity_flags: the same IP hitting checkout_started/
      order_placed repeatedly — a fake-order or coupon-abuse pattern.

    Deliberately advisory only: shared offices, CGNAT, and mobile carrier
    NAT all put many real shoppers behind one IP, so this flags for a human
    to look at rather than blocking anyone automatically.
    """
    since = datetime.now(timezone.utc) - timedelta(hours=FRAUD_WINDOW_HOURS)

    page_views = await db.execute(
        select(UserEvent.ip_hash, UserEvent.user_agent, UserEvent.payload).where(
            UserEvent.event_type == "page_view",
            UserEvent.created_at >= since,
            UserEvent.ip_hash.is_not(None),
        )
    )
    ad_click_tally: dict[str, int] = {}
    ad_click_ua: dict[str, str | None] = {}
    for ip_hash, user_agent, event_payload in page_views.all():
        if not (event_payload or {}).get("gclid") and not (event_payload or {}).get("fbclid"):
            continue
        ad_click_tally[ip_hash] = ad_click_tally.get(ip_hash, 0) + 1
        ad_click_ua.setdefault(ip_hash, user_agent)

    checkout_events = await db.execute(
        select(UserEvent.ip_hash, UserEvent.user_agent).where(
            UserEvent.event_type.in_(["checkout_started", "order_placed"]),
            UserEvent.created_at >= since,
            UserEvent.ip_hash.is_not(None),
        )
    )
    checkout_tally: dict[str, int] = {}
    checkout_ua: dict[str, str | None] = {}
    for ip_hash, user_agent in checkout_events.all():
        checkout_tally[ip_hash] = checkout_tally.get(ip_hash, 0) + 1
        checkout_ua.setdefault(ip_hash, user_agent)

    ad_click_flags = sorted(
        (
            AdClickFlag(ip_hash=ip_hash, ad_click_count=count, sample_user_agent=ad_click_ua.get(ip_hash))
            for ip_hash, count in ad_click_tally.items()
            if count >= AD_CLICK_FLAG_THRESHOLD
        ),
        key=lambda flag: flag.ad_click_count,
        reverse=True,
    )
    checkout_velocity_flags = sorted(
        (
            CheckoutVelocityFlag(
                ip_hash=ip_hash, checkout_event_count=count, sample_user_agent=checkout_ua.get(ip_hash)
            )
            for ip_hash, count in checkout_tally.items()
            if count >= CHECKOUT_FLAG_THRESHOLD
        ),
        key=lambda flag: flag.checkout_event_count,
        reverse=True,
    )

    return FraudSummary(
        window_hours=FRAUD_WINDOW_HOURS,
        ad_click_flags=ad_click_flags,
        checkout_velocity_flags=checkout_velocity_flags,
    )
