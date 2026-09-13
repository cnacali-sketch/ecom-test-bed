"""Indian states and union territories, and when two names mean the same place.

Two names for one place is the normal case here, not the exception. States get
renamed (Orissa became Odisha in 2011), merged (Dadra and Nagar Haveli with
Daman and Diu in 2020), and split (Ladakh out of Jammu & Kashmir in 2019), and
every dataset catches up at its own pace -- including India Post's, which still
answers "Jammu & Kashmir" for Leh.

So a comparison between a shopper's state and a dataset's state has to be a
question about *places*, not about strings.
"""
from __future__ import annotations

#: The 28 states and 8 union territories, current names, for the form's dropdown.
STATES_AND_UTS: tuple[str, ...] = (
    "Andaman and Nicobar Islands",
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chandigarh",
    "Chhattisgarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jammu and Kashmir",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Ladakh",
    "Lakshadweep",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Puducherry",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
)

#: Old or variant spellings -> the current name. Everything here is a name the
#: shop will genuinely receive: from the bundled dataset, from India Post, or
#: typed by someone who learned the older name at school.
_ALIASES: dict[str, str] = {
    "orissa": "Odisha",
    "pondicherry": "Puducherry",
    "uttaranchal": "Uttarakhand",
    "chattisgarh": "Chhattisgarh",
    "nct of delhi": "Delhi",
    "new delhi": "Delhi",
    "national capital territory of delhi": "Delhi",
    "dadra and nagar haveli": "Dadra and Nagar Haveli and Daman and Diu",
    "daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
    "andaman & nicobar islands": "Andaman and Nicobar Islands",
    "andaman and nicobar": "Andaman and Nicobar Islands",
    "jammu & kashmir": "Jammu and Kashmir",
    "tamilnadu": "Tamil Nadu",
}

#: Pairs that are different places today but which older data still conflates.
#: A disagreement across one of these is not evidence of anything.
#:
#: Ladakh is the live case: it became a union territory on 31 October 2019 and
#: both the bundled dataset and India Post still file Leh and Kargil under
#: Jammu & Kashmir. Treating that as a contradiction would flag -- or, in an
#: earlier draft of this work, refuse -- every order from Ladakh.
_COMPATIBLE: tuple[frozenset[str], ...] = (
    frozenset({"Ladakh", "Jammu and Kashmir"}),
    frozenset({"Telangana", "Andhra Pradesh"}),
)


def normalise(name: str) -> str:
    """A state name reduced to its current, canonical spelling.

    Unknown names come back title-cased rather than rejected: this is used for
    comparison, and an unrecognised state is the comparison's problem to report,
    not this function's to decide.
    """
    cleaned = " ".join((name or "").strip().split())
    if not cleaned:
        return ""
    key = cleaned.lower().replace("&", "and")
    key = " ".join(key.split())
    if key in _ALIASES:
        return _ALIASES[key]
    for known in STATES_AND_UTS:
        if known.lower() == key:
            return known
    return cleaned


def same_place(left: str, right: str) -> bool:
    """Whether two state names refer to the same place, allowing for stale data.

    Empty on either side is *not* a disagreement -- there is simply nothing to
    compare, and a half-filled profile must not be accused of contradicting
    itself.
    """
    a, b = normalise(left), normalise(right)
    if not a or not b:
        return True
    if a == b:
        return True
    return any({a, b} <= pair for pair in _COMPATIBLE)
