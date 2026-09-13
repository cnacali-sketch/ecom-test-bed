"""Rebuild `app/data/pincodes.json` from the GeoNames postal-code export.

Run by hand, not by the build:

    python scripts/build_pincodes.py

The result is committed. A generated file in the repo is worth it here -- the
alternative is a network call during image build, which makes a deploy depend on
a third party being up.

Why GeoNames and not the other obvious source
---------------------------------------------
`sanand0/pincode` was measured first and rejected: 11,042 PINs against
GeoNames' 19,238, so roughly 58% coverage. It misses 560100 (Electronics City),
500081 (Gachibowli) and 682001 (Kochi) -- ordinary urban PINs, not obscure ones.
Its state names are also years stale (`Uttaranchal`, renamed in 2007).

GeoNames is refreshed daily and carries current names throughout, including the
2020 `Dadra and Nagar Haveli and Daman and Diu` merger.

It is NOT authoritative on the newest administrative changes, and nothing is --
see `app/services/pincode.py` for the Ladakh case, where India Post's own API is
wrong too. That is why a state disagreement flags for review and never rejects.

Attribution
-----------
This data is derived from the GeoNames Postal Code files, used under
CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
Source: https://download.geonames.org/export/zip/IN.zip
"""
from __future__ import annotations

import io
import json
import pathlib
import sys
import urllib.request
import zipfile

SOURCE_URL = "https://download.geonames.org/export/zip/IN.zip"
OUT_PATH = pathlib.Path(__file__).resolve().parent.parent / "app" / "data" / "pincodes.json"

# Column positions in the GeoNames postal-code TSV. Documented in the readme.txt
# inside the same archive; named here so the indices below are readable.
COL_POSTCODE = 1
COL_PLACE = 2
COL_STATE = 3
COL_DISTRICT = 5


def build() -> dict:
    print(f"downloading {SOURCE_URL} ...")
    with urllib.request.urlopen(SOURCE_URL, timeout=120) as response:
        payload = response.read()
    print(f"  {len(payload):,} bytes")

    archive = zipfile.ZipFile(io.BytesIO(payload))
    rows = [
        line.split("\t")
        for line in archive.read("IN.txt").decode("utf-8").splitlines()
        if line
    ]
    print(f"  {len(rows):,} rows")

    # A PIN covers many post offices; the first row for it is enough, because
    # only the state and district are kept and those agree across the group.
    first_seen: dict[str, tuple[str, str]] = {}
    for row in rows:
        first_seen.setdefault(row[COL_POSTCODE], (row[COL_STATE], row[COL_DISTRICT]))

    states = sorted({state for state, _ in first_seen.values()})
    districts = sorted({district for _, district in first_seen.values()})
    state_index = {name: i for i, name in enumerate(states)}
    district_index = {name: i for i, name in enumerate(districts)}

    # Indices rather than repeated strings: the same 35 state names would
    # otherwise be written out 19,238 times, which triples the file for nothing.
    return {
        "_source": SOURCE_URL,
        "_licence": "GeoNames, CC BY 4.0",
        "states": states,
        "districts": districts,
        "pins": {
            pin: [state_index[state], district_index[district]]
            for pin, (state, district) in sorted(first_seen.items())
        },
    }


def main() -> int:
    data = build()

    bad = sorted(p for p in data["pins"] if not (len(p) == 6 and p.isdigit()))
    if bad:
        # Refuse to write rather than ship a file the validator will choke on.
        print(f"ERROR: {len(bad)} malformed postcodes, e.g. {bad[:5]}", file=sys.stderr)
        return 1

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    blob = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
    OUT_PATH.write_text(blob, encoding="utf-8")

    print(f"wrote {OUT_PATH}")
    print(f"  {len(data['pins']):,} pincodes")
    print(f"  {len(data['states'])} states, {len(data['districts'])} districts")
    print(f"  {len(blob.encode('utf-8')):,} bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
