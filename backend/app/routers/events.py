"""Customer behavior tracking — first-party, no third-party analytics account
needed. Feeds the admin Analytics screen (event funnel + most-viewed products)
and the Fraud & Abuse screen (ad-click/checkout velocity by IP).

Reuses the pre-existing (previously unwired) UserEvent model/table: `user_id`
holds either a real signed-in account id or an anonymous per-browser session
id generated client-side, so behavior is attributable without requiring login.
"""
import re
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db_session
from app.dependencies.auth import require_admin
from app.models.order import Order
from app.models.product import Product
from app.models.user_event import UserEvent
from app.services import login_throttle
from app.services.request_ip import client_ip, hash_ip

router = APIRouter(prefix="/api/events", tags=["events"])

# Public, unauthenticated, fire-and-forget ingest -- without a cap it's a free
# DB-fill and fraud-data-poisoning vector (flood fake events to drown out or
# skew the ad-click/checkout-velocity fraud signals this same data feeds).
# High ceiling: a real browsing session legitimately fires many of these
# (every page_view, product_view, add_to_cart).
EVENT_MAX_PER_IP = 200

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
# Coupon abuse looks at a code's whole lifetime, not a rolling window — a
# coupon abuse pattern (one IP cycling through several accounts, or one
# account/IP redeeming a code far more than a real shopper would) plays out
# over the coupon's run, not necessarily within the last day.
COUPON_ABUSE_MIN_ORDERS = 3
COUPON_ABUSE_MIN_ACCOUNTS = 2

# Deliberately coarse, regex-based UA parsing — good enough to bucket
# "mobile vs desktop" and "which browser" for a dashboard chart, not meant to
# be a precise UA-sniffing library. Order matters: check bot/tablet/mobile
# before falling through to desktop.
_DEVICE_PATTERNS = [
    ("Bot", re.compile(r"bot|crawler|spider|slurp", re.I)),
    ("Tablet", re.compile(r"ipad|tablet", re.I)),
    ("Mobile", re.compile(r"mobile|iphone|android", re.I)),
]
_BROWSER_PATTERNS = [
    ("Edge", re.compile(r"edg/", re.I)),
    ("Chrome", re.compile(r"chrome/", re.I)),
    ("Safari", re.compile(r"safari/", re.I)),  # after Chrome — Chrome UAs also contain "Safari/"
    ("Firefox", re.compile(r"firefox/", re.I)),
]


def _classify_device(user_agent: str | None) -> str:
    if not user_agent:
        return "Unknown"
    for label, pattern in _DEVICE_PATTERNS:
        if pattern.search(user_agent):
            return label
    return "Desktop"


def _classify_browser(user_agent: str | None) -> str:
    if not user_agent:
        return "Unknown"
    for label, pattern in _BROWSER_PATTERNS:
        if pattern.search(user_agent):
            return label
    return "Other"


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
    friendly): an unknown event_type, and a throttled caller, are both
    silently dropped rather than surfaced as an error — a tracking call must
    never show up as a user-visible failure."""
    if payload.event_type not in EVENT_TYPES:
        return

    throttle_key = login_throttle.client_key(request, "event")
    if login_throttle.is_locked(throttle_key, EVENT_MAX_PER_IP):
        return
    login_throttle.record_failure(throttle_key)

    ip = client_ip(request)
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
            ip_hash=hash_ip(ip),
            ip_address=ip[:64] or None,
            user_agent=(request.headers.get("user-agent") or "")[:256] or None,
        )
    )
    await db.commit()


class TopProduct(BaseModel):
    product_id: str
    name: str
    views: int


class LocationCount(BaseModel):
    city: str
    state: str
    order_count: int


class EventSummary(BaseModel):
    counts: dict[str, int]
    top_products: list[TopProduct]
    total_events: int
    # Decision-making data: where visitors browse from (device/browser, from
    # the same events already collected) and where orders actually ship to
    # (real shipping addresses — not IP geolocation, which this store
    # deliberately doesn't do; see hash_ip in request_ip.py).
    device_counts: dict[str, int]
    browser_counts: dict[str, int]
    top_locations: list[LocationCount]
    state_counts: dict[str, int]
    country_counts: dict[str, int]


@router.get("/summary", response_model=EventSummary, dependencies=[Depends(require_admin)])
async def events_summary(db: AsyncSession = Depends(get_db_session)) -> EventSummary:
    """Aggregate counts only — never returns raw per-user event rows.
    Feeds the admin Analytics screen: event-type funnel + most-viewed products.
    """
    counts_rows = await db.execute(select(UserEvent.event_type, func.count()).group_by(UserEvent.event_type))
    counts = {row[0]: row[1] for row in counts_rows.all()}
    total = sum(counts.values())

    ua_rows = await db.execute(select(UserEvent.user_agent))
    device_counts: dict[str, int] = {}
    browser_counts: dict[str, int] = {}
    for (user_agent,) in ua_rows.all():
        device = _classify_device(user_agent)
        browser = _classify_browser(user_agent)
        device_counts[device] = device_counts.get(device, 0) + 1
        browser_counts[browser] = browser_counts.get(browser, 0) + 1

    # Real customer locations, from actual shipping addresses on real orders
    # — not derived from IP, which is coarse and often wrong at city level.
    # .title() only smooths casing ("india" -> "India"); it can't merge an
    # abbreviation with a full name ("IN" vs "India" still count separately)
    # since the address form is free text, not a fixed country/state picker.
    location_rows = await db.execute(select(Order.shipping_address))
    location_tally: dict[tuple[str, str], int] = {}
    state_tally: dict[str, int] = {}
    country_tally: dict[str, int] = {}
    for (address,) in location_rows.all():
        city = (address or {}).get("city", "").strip().title()
        state = (address or {}).get("state", "").strip().title()
        country = (address or {}).get("country", "").strip().upper()
        if not city and not state and not country:
            continue
        key = (city or "Unknown", state or "Unknown")
        location_tally[key] = location_tally.get(key, 0) + 1
        if state:
            state_tally[state] = state_tally.get(state, 0) + 1
        if country:
            country_tally[country] = country_tally.get(country, 0) + 1
    top_locations = [
        LocationCount(city=city, state=state, order_count=count)
        for (city, state), count in sorted(location_tally.items(), key=lambda kv: kv[1], reverse=True)[:10]
    ]

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

    return EventSummary(
        counts=counts,
        top_products=top_products,
        total_events=total,
        device_counts=device_counts,
        browser_counts=browser_counts,
        top_locations=top_locations,
        state_counts=state_tally,
        country_counts=country_tally,
    )


class AdClickFlag(BaseModel):
    ip_hash: str
    sample_ip: str | None
    ad_click_count: int
    sample_user_agent: str | None
    sample_device: str
    sample_browser: str


class CheckoutVelocityFlag(BaseModel):
    ip_hash: str
    sample_ip: str | None
    checkout_event_count: int
    sample_user_agent: str | None
    sample_device: str
    sample_browser: str


class CouponAbuseFlag(BaseModel):
    coupon_code: str
    ip_hash: str
    sample_ip: str | None
    order_count: int
    distinct_accounts: int
    total_discount_given: Decimal


class FraudSummary(BaseModel):
    window_hours: int
    ad_click_flags: list[AdClickFlag]
    checkout_velocity_flags: list[CheckoutVelocityFlag]
    coupon_abuse_flags: list[CouponAbuseFlag]


@router.get("/fraud-summary", response_model=FraudSummary, dependencies=[Depends(require_admin)])
async def fraud_summary(db: AsyncSession = Depends(get_db_session)) -> FraudSummary:
    """Tag-only fraud/abuse signals for admin review — never auto-blocks.

    Three lenses:
    - ad_click_flags: the same IP hitting page_view with a gclid/fbclid
      (i.e. arriving via a Google/Meta ad) repeatedly within FRAUD_WINDOW_HOURS
      — ad-click-fraud or bot traffic burning ad spend.
    - checkout_velocity_flags: the same IP hitting checkout_started/
      order_placed repeatedly within FRAUD_WINDOW_HOURS — a fake-order pattern.
    - coupon_abuse_flags: a coupon code redeemed from the same IP across
      several distinct accounts, or far more times than a real shopper would
      need, over the coupon's whole lifetime (not windowed — this pattern
      plays out over a coupon's run, not necessarily the last day).

    Deliberately advisory only: shared offices, CGNAT, and mobile carrier
    NAT all put many real shoppers behind one IP, so this flags for a human
    to look at rather than blocking anyone automatically.
    """
    since = datetime.now(timezone.utc) - timedelta(hours=FRAUD_WINDOW_HOURS)

    page_views = await db.execute(
        select(UserEvent.ip_hash, UserEvent.ip_address, UserEvent.user_agent, UserEvent.payload).where(
            UserEvent.event_type == "page_view",
            UserEvent.created_at >= since,
            UserEvent.ip_hash.is_not(None),
        )
    )
    ad_click_tally: dict[str, int] = {}
    ad_click_ip: dict[str, str | None] = {}
    ad_click_ua: dict[str, str | None] = {}
    for ip_hash, ip_address, user_agent, event_payload in page_views.all():
        if not (event_payload or {}).get("gclid") and not (event_payload or {}).get("fbclid"):
            continue
        ad_click_tally[ip_hash] = ad_click_tally.get(ip_hash, 0) + 1
        ad_click_ip.setdefault(ip_hash, ip_address)
        ad_click_ua.setdefault(ip_hash, user_agent)

    checkout_events = await db.execute(
        select(UserEvent.ip_hash, UserEvent.ip_address, UserEvent.user_agent).where(
            UserEvent.event_type.in_(["checkout_started", "order_placed"]),
            UserEvent.created_at >= since,
            UserEvent.ip_hash.is_not(None),
        )
    )
    checkout_tally: dict[str, int] = {}
    checkout_ip: dict[str, str | None] = {}
    checkout_ua: dict[str, str | None] = {}
    for ip_hash, ip_address, user_agent in checkout_events.all():
        checkout_tally[ip_hash] = checkout_tally.get(ip_hash, 0) + 1
        checkout_ip.setdefault(ip_hash, ip_address)
        checkout_ua.setdefault(ip_hash, user_agent)

    ad_click_flags = sorted(
        (
            AdClickFlag(
                ip_hash=ip_hash,
                sample_ip=ad_click_ip.get(ip_hash),
                ad_click_count=count,
                sample_user_agent=ad_click_ua.get(ip_hash),
                sample_device=_classify_device(ad_click_ua.get(ip_hash)),
                sample_browser=_classify_browser(ad_click_ua.get(ip_hash)),
            )
            for ip_hash, count in ad_click_tally.items()
            if count >= AD_CLICK_FLAG_THRESHOLD
        ),
        key=lambda flag: flag.ad_click_count,
        reverse=True,
    )
    checkout_velocity_flags = sorted(
        (
            CheckoutVelocityFlag(
                ip_hash=ip_hash,
                sample_ip=checkout_ip.get(ip_hash),
                checkout_event_count=count,
                sample_user_agent=checkout_ua.get(ip_hash),
                sample_device=_classify_device(checkout_ua.get(ip_hash)),
                sample_browser=_classify_browser(checkout_ua.get(ip_hash)),
            )
            for ip_hash, count in checkout_tally.items()
            if count >= CHECKOUT_FLAG_THRESHOLD
        ),
        key=lambda flag: flag.checkout_event_count,
        reverse=True,
    )

    coupon_orders = await db.execute(
        select(Order.coupon_code, Order.ip_address, Order.user_id, Order.discount_amount).where(
            Order.coupon_code.is_not(None), Order.ip_address.is_not(None)
        )
    )
    coupon_groups: dict[tuple[str, str], dict] = {}
    for coupon_code, ip_address, user_id, discount_amount in coupon_orders.all():
        group = coupon_groups.setdefault(
            (coupon_code, ip_address), {"accounts": set(), "count": 0, "discount": Decimal("0")}
        )
        group["accounts"].add(user_id)
        group["count"] += 1
        group["discount"] += discount_amount or Decimal("0")

    coupon_abuse_flags = sorted(
        (
            CouponAbuseFlag(
                coupon_code=coupon_code,
                ip_hash=hash_ip(ip_address),
                sample_ip=ip_address,
                order_count=group["count"],
                distinct_accounts=len(group["accounts"]),
                total_discount_given=group["discount"],
            )
            for (coupon_code, ip_address), group in coupon_groups.items()
            if group["count"] >= COUPON_ABUSE_MIN_ORDERS or len(group["accounts"]) >= COUPON_ABUSE_MIN_ACCOUNTS
        ),
        key=lambda flag: flag.order_count,
        reverse=True,
    )

    return FraudSummary(
        window_hours=FRAUD_WINDOW_HOURS,
        ad_click_flags=ad_click_flags,
        checkout_velocity_flags=checkout_velocity_flags,
        coupon_abuse_flags=coupon_abuse_flags,
    )
