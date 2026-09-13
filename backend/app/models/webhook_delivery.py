"""Every webhook Razorpay has sent us, and what we did about it.

The webhook endpoint is the only part of this system that handles money with
nobody watching. Until now it kept no record of doing so: a delivery that was
ignored returned 200 and vanished, a forged one was rejected with a 401 and
vanished, and a delivery that raised on its way to the database took the whole
request down and vanished. The only trace of any of it was whatever the
processing happened to change.

That is not hypothetical. `payment_status` was `varchar(16)` while the refund
handler wrote `partially_refunded`, so every refund webhook 500'd. Razorpay
would have retried, given up, and the shop would have had a refund at Razorpay
with nothing here to show it was ever attempted -- no failed request, no error,
no record of the money.

This table is the record. One row per delivery attempt, written before the
processing runs and updated after it, so that a delivery survives its own
failure.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import JSON

from app.db import Base

JSONType = JSONB().with_variant(JSON(), "sqlite")

#: What happened to a delivery. Stored as a word rather than inferred later,
#: because "no order changed" and "we never got that far" look identical from
#: the outside and mean entirely different things.
DELIVERY_STATUSES = frozenset(
    {
        "received",   # written down on arrival; still in the handler, or the
                      # process died before it finished. A row left in this
                      # state is itself the finding.
        "processed",  # understood, and something changed
        "ignored",    # understood, and correctly did nothing
        "rejected",   # failed the signature check, or was not JSON
        "failed",     # we tried and raised
    }
)


class WebhookDelivery(Base):
    """One inbound webhook delivery, recorded whether or not it worked."""

    __tablename__ = "webhook_deliveries"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    provider: Mapped[str] = mapped_column(String(32), default="razorpay")

    # Null when the body never parsed -- a rejected delivery still gets a row,
    # and inventing an event name for it would put a guess in the record.
    event: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    # Razorpay's own id for the event, from the `X-Razorpay-Event-Id` header,
    # when it sends one. Recorded rather than relied upon: it is what ties a
    # retry to the delivery it is retrying, and this column being null is
    # information too.
    event_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    signature_valid: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(16), index=True)

    # Why it was ignored, or what it raised. The single most useful column here
    # when something has gone wrong at two in the morning.
    detail: Mapped[str | None] = mapped_column(String(2000), nullable=True)

    # The order this delivery was about, when it named one.
    #
    # Deliberately NOT a foreign key. Three tables already point at `orders.id`
    # and two of them made an order undeletable until this week; a log of what
    # arrived has no business blocking the deletion of what it arrived about.
    # It is a recorded identifier, not a relationship.
    order_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True, index=True)

    # What Razorpay actually sent, parsed. Null only when it was not JSON.
    payload: Mapped[dict | None] = mapped_column(JSONType, nullable=True)

    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # How many times this row has been through the handler: once on arrival,
    # plus once per admin-initiated replay.
    attempts: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
