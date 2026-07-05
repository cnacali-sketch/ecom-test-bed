"""Seed the database from the frontend catalog.

Single source of truth: reads `frontend/content/catalog.ts` via a small
TypeScript→JSON bridge so backend and frontend always stay in sync.

Usage:
    cd backend
    python scripts/seed.py                      # uses catalog.ts via tsx
    python scripts/seed.py --json path/to/file  # skip tsx, pass JSON directly

Safe to re-run: skips products whose slug already exists.

ponytail: tsx bridge is one subprocess call; no separate ETL pipeline.
Add a proper ETL step only when catalog.ts exceeds ~500 products or needs
transformation that can't be done in the TypeScript dumper script.
"""
import argparse
import asyncio
import json
import subprocess
import sys
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select

from app.db import async_session_factory
from app.models.collection import Collection
from app.models.product import Product, ProductVariant

REPO_ROOT = Path(__file__).resolve().parents[2]
CATALOG_TS = REPO_ROOT / "frontend" / "content" / "catalog.ts"
DUMPER_TS = REPO_ROOT / "backend" / "scripts" / "_dump_catalog.ts"


def _write_dumper() -> None:
    """Write a tiny TS script that imports the catalog and prints JSON."""
    DUMPER_TS.write_text(
        """
import { products, collections } from "../../frontend/content/catalog";
console.log(JSON.stringify({ products, collections }, null, 0));
""".strip()
    )


def _load_catalog_via_tsx() -> dict:
    """Run the dumper with tsx and parse its stdout as JSON."""
    _write_dumper()
    try:
        result = subprocess.run(
            ["npx", "tsx", str(DUMPER_TS)],
            capture_output=True,
            text=True,
            cwd=str(REPO_ROOT / "frontend"),
            timeout=30,
        )
    except FileNotFoundError:
        sys.exit("tsx not found. Run 'npm install' in frontend/ first.")
    if result.returncode != 0:
        sys.exit(f"tsx failed:\n{result.stderr}")
    DUMPER_TS.unlink(missing_ok=True)
    return json.loads(result.stdout)


async def seed(catalog: dict) -> None:
    async with async_session_factory() as db:
        for p in catalog["products"]:
            existing = await db.execute(select(Product).where(Product.slug == p["slug"]))
            if existing.scalar_one_or_none() is not None:
                print(f"skip (exists): {p['slug']}")
                continue

            attrs = {
                "brand": p.get("brand", ""),
                "type": p.get("type", ""),
                "material": p.get("material", ""),
                "careInstructions": p.get("careInstructions", ""),
                "measurements": p.get("measurements", ""),
                "shippingInfo": p.get("shippingInfo", ""),
                "collectionSlugs": p.get("collectionSlugs", []),
                "isNew": p.get("isNew", False),
                "isSale": p.get("isSale", False),
                "tags": p.get("tags", []),
            }

            product = Product(
                sku=p["id"],  # use the catalog id as the SKU until a proper SKU field lands
                slug=p["slug"],
                name=p["name"],
                price=Decimal(str(p["price"])),
                mrp=Decimal(str(p["mrp"])),
                in_stock=p.get("inStock", True),
                description=p.get("description"),
                images=[img["url"] for img in p.get("images", [])],
                attrs=attrs,
            )

            for v in p.get("variants", []):
                product.variants.append(
                    ProductVariant(
                        sku=v["sku"],
                        color=v["color"],
                        color_hex=v["colorHex"],
                        image=v.get("image"),
                        in_stock=v.get("inStock", True),
                    )
                )

            db.add(product)
            print(f"seeded: {p['slug']}")

        await db.commit()

        # Seed collections and wire product → collection relationships
        for c in catalog.get("collections", []):
            existing = await db.execute(select(Collection).where(Collection.slug == c["slug"]))
            col = existing.scalar_one_or_none()
            if col is None:
                col = Collection(
                    slug=c["slug"],
                    name=c["name"],
                    description=c.get("description"),
                    hero_image=c.get("heroImage"),
                )
                db.add(col)
                print(f"seeded collection: {c['slug']}")
            else:
                print(f"skip collection (exists): {c['slug']}")

        await db.flush()

        # Wire products to collections via product_ids in each collection
        for c in catalog.get("collections", []):
            col_result = await db.execute(select(Collection).where(Collection.slug == c["slug"]))
            col = col_result.scalar_one_or_none()
            if not col:
                continue
            for prod_id in c.get("productIds", []):
                prod_result = await db.execute(
                    select(Product).where(Product.attrs["id"].astext == prod_id)  # type: ignore[union-attr]
                )
                prod = prod_result.scalar_one_or_none()
                if prod and col not in prod.collections:
                    prod.collections.append(col)

        await db.commit()
        print("done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", help="Path to pre-dumped catalog JSON (skips tsx)")
    args = parser.parse_args()

    if args.json:
        catalog = json.loads(Path(args.json).read_text())
    else:
        catalog = _load_catalog_via_tsx()

    asyncio.run(seed(catalog))
