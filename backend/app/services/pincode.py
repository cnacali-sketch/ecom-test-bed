"""Is this a real Indian postcode, and where is it?

A PIN is the one part of an address that can actually be checked. Everything
else about a delivery address is a claim; a PIN either exists in the postal
system or it does not, and that makes it the anchor the rest of the validation
hangs off -- it is also what lets the form fill in city and state itself, so
this module makes checkout easier to complete, not harder.

Two sources, in order:

1. **The bundled dataset** (`app/data/pincodes.json`, 19,238 PINs). Instant, no
   network, and the customer's postcode never leaves this server.
2. **India Post's public API**, only for a PIN the file has never heard of.
   The file is a snapshot and new PINs get created, so a miss must not be
   treated as a verdict.

Neither source is authoritative about current administrative names
---------------------------------------------------------------
This is the important caveat and it is not theoretical. Leh (194101) and Kargil
(194103) have been in the union territory of **Ladakh** since 31 October 2019.
Both the bundled dataset *and India Post's own API* still answer
"Jammu & Kashmir". A shopper in Leh who correctly picks Ladakh is more current
than the government's own endpoint.

So: a state disagreement is reported, never enforced. Callers flag it for a
human. Rejecting on it would have quietly refused every order from Ladakh.
"""
from __future__ import annotations

import json
import logging
import pathlib
import time
import urllib.error
import urllib.request
from dataclasses import dataclass

logger = logging.getLogger(__name__)

_DATA_PATH = pathlib.Path(__file__).resolve().parent.parent / "data" / "pincodes.json"

API_URL = "https://api.postalpincode.in/pincode/{pin}"
# Matches services/razorpay.py. Long enough for a slow third party, short enough
# that a hung connection cannot hold a checkout request open indefinitely.
API_TIMEOUT_SECONDS = 15
# Measured at ~1s per call, so repeats must not pay it again. A day is fine:
# the postal map changes on the scale of years.
CACHE_TTL_SECONDS = 24 * 60 * 60

# In-process, like services/login_throttle.py, and with the same caveat: it does
# not survive a restart and is not shared between workers. That costs a few
# repeated lookups, never correctness.
_api_cache: dict[str, tuple[float, "Place | None"]] = {}


@dataclass(frozen=True)
class Place:
    state: str
    district: str
    #: False when the answer came from the live API rather than the bundled file.
    #: Only used for logging -- both sources are equally trusted.
    from_dataset: bool = True


class _Dataset:
    """The bundled file, parsed once on first use.

    Lazy rather than at import so that a corrupt or missing data file surfaces
    where it can be handled, instead of preventing the app from starting.
    """

    def __init__(self) -> None:
        self._pins: dict[str, list[int]] | None = None
        self._states: list[str] = []
        self._districts: list[str] = []

    def _load(self) -> None:
        if self._pins is not None:
            return
        try:
            raw = json.loads(_DATA_PATH.read_text(encoding="utf-8"))
            self._states = raw["states"]
            self._districts = raw["districts"]
            self._pins = raw["pins"]
        except Exception:
            # A missing dataset degrades to "every PIN is unknown", which sends
            # everything to the API backstop. Slower and noisier, but the shop
            # keeps taking orders.
            logger.exception("pincode dataset unavailable; falling back to the API alone")
            self._pins = {}

    def get(self, pin: str) -> Place | None:
        self._load()
        assert self._pins is not None
        entry = self._pins.get(pin)
        if entry is None:
            return None
        return Place(state=self._states[entry[0]], district=self._districts[entry[1]])

    def __len__(self) -> int:
        self._load()
        return len(self._pins or {})


_dataset = _Dataset()


def is_well_formed(pin: str) -> bool:
    """Six digits, not starting with 0 or 9.

    The first-digit rule is measured, not assumed: across all 19,238 real
    postcodes in the dataset the leading digit is only ever 1-8. It cheaply
    rejects `000000` and `999999` before any lookup happens.
    """
    return len(pin) == 6 and pin.isdigit() and pin[0] in "12345678"


def _from_api(pin: str) -> Place | None:
    """Ask India Post. Returns None for "no such postcode".

    Raises RuntimeError when the service could not be reached at all -- the
    caller must tell those two cases apart, because one is a real answer and the
    other is our own outage and must not be held against the shopper.
    """
    request = urllib.request.Request(
        API_URL.format(pin=pin), headers={"Accept": "application/json"}
    )
    try:
        with urllib.request.urlopen(request, timeout=API_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read()[:300].decode("utf-8", "replace")
        raise RuntimeError(f"Pincode lookup failed: {error.code} {detail}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Could not reach the pincode service: {error.reason}") from error
    except (ValueError, TimeoutError) as error:
        # Malformed JSON is the service misbehaving, not a verdict on the PIN.
        raise RuntimeError(f"Pincode lookup returned nothing usable: {error}") from error

    if not isinstance(payload, list) or not payload:
        raise RuntimeError("Pincode lookup returned an unexpected shape")

    first = payload[0]
    if first.get("Status") != "Success":
        return None

    offices = first.get("PostOffice") or []
    if not offices:
        return None

    office = offices[0]
    return Place(
        state=str(office.get("State") or ""),
        district=str(office.get("District") or ""),
        from_dataset=False,
    )


def lookup(pin: str) -> Place | None:
    """Where this postcode is, or None if no source recognises it.

    Raises RuntimeError only when the PIN is absent from the dataset *and* the
    API could not be reached. Callers must treat that as "unverified", not as
    "fake" -- see `verify` below, which is what most callers actually want.
    """
    pin = (pin or "").strip()
    if not is_well_formed(pin):
        return None

    found = _dataset.get(pin)
    if found is not None:
        return found

    cached = _api_cache.get(pin)
    if cached is not None and time.monotonic() - cached[0] < CACHE_TTL_SECONDS:
        return cached[1]

    place = _from_api(pin)
    _api_cache[pin] = (time.monotonic(), place)
    return place


@dataclass(frozen=True)
class Verdict:
    """What we were able to establish, kept separate from what to do about it."""

    #: False only when a source positively said this postcode does not exist.
    known_bad: bool
    place: Place | None
    #: True when nothing could be established either way (our outage, not theirs).
    unverified: bool = False


def verify(pin: str) -> Verdict:
    """Check a postcode without ever letting our own outage reject a customer.

    Three outcomes, and the difference between the last two is the whole point:

    - **Recognised** -- `place` is set, order proceeds and the address can be
      cross-checked against it.
    - **Positively unknown** -- a source answered and said no such postcode.
      This is the only case a caller should refuse an order over.
    - **Unverified** -- not in the file and the API is unreachable. Accepted,
      and left for a human to glance at. A third party being down must never
      stop this shop taking money.
    """
    if not is_well_formed(pin):
        return Verdict(known_bad=True, place=None)

    try:
        place = lookup(pin)
    except RuntimeError:
        logger.warning("pincode %s could not be verified; accepting unverified", pin)
        return Verdict(known_bad=False, place=None, unverified=True)

    if place is None:
        return Verdict(known_bad=True, place=None)
    return Verdict(known_bad=False, place=place)
