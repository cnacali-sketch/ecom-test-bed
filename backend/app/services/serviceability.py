"""Where the shop currently delivers.

The shop is starting in Bengaluru while deliveries are being worked out, so an
address outside that area is refused at checkout and offered a place on the
waitlist instead. That is a commercial decision with a short shelf life -- it
exists to be switched off -- so the rule is configuration read from the content
document, not a constant compiled into an image.

Matched on the **district a PIN resolves to**, never on the city someone types.
People write Bangalore, Bengaluru and Bangalore Urban for the same place, and a
shop that refused "Bangalore" because its config said "Bengaluru" would look
broken in the least explicable way possible.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.services import pincode

#: Used when the content document has no `serviceability` block at all.
#:
#: A stored document written before this feature existed will not have the key,
#: which is the situation in production the day this ships. The default has to
#: be the intended business rule rather than "allow everywhere", or the
#: restriction would silently not apply until somebody opened the admin.
DEFAULT_DISTRICTS: tuple[str, ...] = ("Bengaluru", "Bangalore Rural")


@dataclass(frozen=True)
class Area:
    """The configured delivery area, already normalised for comparison."""

    limited: bool
    districts: frozenset[str]

    def covers(self, district: str) -> bool:
        if not self.limited:
            return True
        return _fold(district) in self.districts


def _fold(value: str) -> str:
    return " ".join((value or "").strip().lower().split())


def area_from_document(document: dict[str, Any] | None) -> Area:
    """Read the delivery area out of the site content document.

    Every field is defended individually rather than trusting the block's
    shape: this document is editable through the admin, and a half-saved or
    hand-edited `serviceability` key must not be able to close the shop.

    In particular **an empty district list turns the limit off** rather than
    refusing every order. Deleting all the districts reads as "stop limiting",
    which is the harmless interpretation; the alternative is an admin clearing a
    list and taking the storefront down without being told.
    """
    block = (document or {}).get("serviceability")
    if not isinstance(block, dict):
        return Area(limited=True, districts=frozenset(_fold(d) for d in DEFAULT_DISTRICTS))

    limited = bool(block.get("limitedArea", True))

    # An ABSENT `districts` key and an EMPTY one mean different things, and
    # collapsing them was a bug: a partially-written block should fall back to
    # the intended rule, while a list an admin has deliberately cleared should
    # stop limiting. Only the first case takes the defaults.
    raw = block.get("districts")
    if raw is None:
        names = list(DEFAULT_DISTRICTS)
    elif isinstance(raw, list):
        names = [d for d in raw if isinstance(d, str) and d.strip()]
    else:
        names = list(DEFAULT_DISTRICTS)

    districts = frozenset(_fold(d) for d in names)
    if limited and not districts:
        limited = False

    return Area(limited=limited, districts=districts)


@dataclass(frozen=True)
class Decision:
    """Whether this postcode can be delivered to, and what to say if not."""

    deliverable: bool
    district: str = ""
    state: str = ""
    #: True when the postcode could not be checked at all. Treated as
    #: deliverable -- see below.
    unverified: bool = False


def check(postcode: str, area: Area) -> Decision:
    """Decide whether an address is inside the delivery area.

    Fails open twice, deliberately:

    - **An unverifiable postcode is delivered to.** If the bundled dataset does
      not know it and India Post cannot be reached, the shop takes the order and
      flags it. Refusing would turn a third party's outage into lost sales, and
      the order can still be cancelled by a human who knows the area.
    - **A postcode in no known district is delivered to.** Same reasoning: the
      dataset is a snapshot, and "I have not heard of this place" is not
      evidence that nobody lives there.

    A refusal therefore only ever happens when a postcode is positively known
    to be somewhere the shop does not deliver.
    """
    if not area.limited:
        return Decision(deliverable=True)

    verdict = pincode.verify(postcode)
    if verdict.unverified:
        return Decision(deliverable=True, unverified=True)
    if verdict.place is None:
        # Either malformed or no such postcode. Not this function's refusal to
        # make -- the address validator rejects it with a better message.
        return Decision(deliverable=True, unverified=True)

    return Decision(
        deliverable=area.covers(verdict.place.district),
        district=verdict.place.district,
        state=verdict.place.state,
    )
