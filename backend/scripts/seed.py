"""Seed the products/product_variants tables with catalog data.

Mirrors frontend/lib/mock-data.ts 1:1 (same ids/slugs/skus) so PLP/PDP
routes render identical content whether backend or mock-data fallback
serves the request. Extra display fields the Product/ProductVariant
models don't have columns for (slug, brand, collectionSlugs, etc.) are
kept in `attrs`, which the frontend adapter reads back out.

Safe to re-run: skips any product whose sku already exists.
"""
import asyncio

from sqlalchemy import select

from app.db import async_session_factory
from app.models.product import Product, ProductVariant

CATALOG = [
    {
        "sku": "prod-tote-01",
        "name": "Everyday Structured Tote",
        "price": 2799,
        "mrp": 3999,
        "description": (
            "A structured tote built for the daily commute — padded laptop sleeve, "
            "wide top opening, and a base that keeps its shape whether you're "
            "carrying two things or twenty."
        ),
        "images": [
            "https://placehold.co/800x1000/f3ede4/1a1a1a?text=Tote+Front",
            "https://placehold.co/800x1000/f3ede4/1a1a1a?text=Tote+Side",
            "https://placehold.co/800x1000/f3ede4/1a1a1a?text=Tote+Detail",
        ],
        "attrs": {
            "slug": "everyday-structured-tote",
            "brand": "Savvy",
            "type": "Tote",
            "material": "Vegan Leather",
            "careInstructions": (
                "Wipe clean with a soft, dry cloth. Avoid prolonged sun exposure. "
                "Store flat or upright with light stuffing to retain shape. Keep "
                "away from sharp objects and rough surfaces."
            ),
            "measurements": "Height: 32cm · Width: 40cm · Depth: 14cm · Strap drop: 22cm",
            "shippingInfo": "Ships within 2 business days. Free shipping on orders over ₹2,999. Easy 15-day returns.",
            "currency": "INR",
            "collectionSlugs": ["bags"],
            "isNew": True,
            "isSale": True,
            "inStock": True,
            "tags": ["new-in", "work", "best-seller"],
        },
        "variants": [
            {"sku": "TOTE-BLK-01", "color": "Black", "colorHex": "#1a1a1a", "image": "https://placehold.co/800x1000/f3ede4/1a1a1a?text=Tote+Black", "inStock": True},
            {"sku": "TOTE-TAN-01", "color": "Tan", "colorHex": "#c8a06a", "image": "https://placehold.co/800x1000/f3ede4/1a1a1a?text=Tote+Tan", "inStock": True},
            {"sku": "TOTE-RED-01", "color": "Brick Red", "colorHex": "#a13d2b", "image": "https://placehold.co/800x1000/f3ede4/1a1a1a?text=Tote+Red", "inStock": False},
        ],
    },
    {
        "sku": "prod-sling-02",
        "name": "Hands-Free Crossbody Sling",
        "price": 1499,
        "mrp": 1499,
        "description": (
            "A lightweight nylon sling with an adjustable strap and a "
            "water-resistant lining — made for days when you need both hands "
            "free and your essentials close."
        ),
        "images": [
            "https://placehold.co/800x1000/f3ede4/1a1a1a?text=Sling+Front",
            "https://placehold.co/800x1000/f3ede4/1a1a1a?text=Sling+Worn",
        ],
        "attrs": {
            "slug": "hands-free-crossbody-sling",
            "brand": "Savvy",
            "type": "Sling Bag",
            "material": "Nylon",
            "careInstructions": "Spot clean with a damp cloth and mild detergent. Do not machine wash. Air dry only, away from direct heat.",
            "measurements": "Height: 18cm · Width: 24cm · Depth: 7cm · Strap length: adjustable up to 130cm",
            "shippingInfo": "Ships within 2 business days. Free shipping on orders over ₹2,999. Easy 15-day returns.",
            "currency": "INR",
            "collectionSlugs": ["bags"],
            "isNew": True,
            "isSale": False,
            "inStock": True,
            "tags": ["new-in", "travel"],
        },
        "variants": [
            {"sku": "SLNG-BLK-02", "color": "Black", "colorHex": "#1a1a1a", "image": "https://placehold.co/800x1000/f3ede4/1a1a1a?text=Sling+Black", "inStock": True},
            {"sku": "SLNG-OLV-02", "color": "Olive", "colorHex": "#5c6b45", "image": "https://placehold.co/800x1000/f3ede4/1a1a1a?text=Sling+Olive", "inStock": True},
        ],
    },
    {
        "sku": "prod-clutch-03",
        "name": "Satin Evening Clutch",
        "price": 1899,
        "mrp": 2599,
        "description": (
            "A slim satin clutch with a magnetic clasp and detachable chain "
            "strap — enough room for the essentials, small enough to disappear "
            "into an evening."
        ),
        "images": [
            "https://placehold.co/800x1000/f3ede4/1a1a1a?text=Clutch+Front",
            "https://placehold.co/800x1000/f3ede4/1a1a1a?text=Clutch+Open",
        ],
        "attrs": {
            "slug": "satin-evening-clutch",
            "brand": "Savvy Atelier",
            "type": "Clutch",
            "material": "Satin",
            "careInstructions": "Dry clean only. Store in the provided dust bag. Avoid contact with water and oils.",
            "measurements": "Height: 11cm · Width: 21cm · Depth: 4cm · Chain drop: 55cm",
            "shippingInfo": "Ships within 2 business days. Free shipping on orders over ₹2,999. Easy 15-day returns.",
            "currency": "INR",
            "collectionSlugs": ["bags"],
            "isNew": False,
            "isSale": True,
            "inStock": True,
            "tags": ["evening"],
        },
        "variants": [
            {"sku": "CLTC-CHM-03", "color": "Champagne", "colorHex": "#e8d9b5", "image": "https://placehold.co/800x1000/f3ede4/1a1a1a?text=Clutch+Champagne", "inStock": True},
            {"sku": "CLTC-BLK-03", "color": "Black", "colorHex": "#1a1a1a", "image": "https://placehold.co/800x1000/f3ede4/1a1a1a?text=Clutch+Black", "inStock": False},
        ],
    },
    {
        "sku": "prod-hoops-04",
        "name": "Waterproof Gold Hoops",
        "price": 599,
        "mrp": 899,
        "description": (
            "18k gold-plated hoops with a waterproof coating that resists "
            "tarnish from sweat, showers, and daily wear. Lightweight enough "
            "to forget you're wearing them."
        ),
        "images": [
            "https://placehold.co/800x1000/f3ede4/1a1a1a?text=Hoops+Front",
            "https://placehold.co/800x1000/f3ede4/1a1a1a?text=Hoops+Worn",
        ],
        "attrs": {
            "slug": "waterproof-gold-hoops",
            "brand": "Savvy",
            "type": "Earrings",
            "material": "Gold Plated Brass",
            "careInstructions": "Wipe with a soft cloth after wear. Avoid perfume and lotion contact directly on the plating. Store in a dry pouch.",
            "measurements": "Diameter: 3cm · Weight: 4g per pair",
            "shippingInfo": "Ships within 2 business days. Free shipping on orders over ₹2,999. Easy 15-day returns.",
            "currency": "INR",
            "collectionSlugs": ["jewellery"],
            "isNew": True,
            "isSale": True,
            "inStock": True,
            "tags": ["new-in", "best-seller", "waterproof"],
        },
        "variants": [
            {"sku": "HOOP-GLD-04", "color": "Gold", "colorHex": "#d4af37", "image": "https://placehold.co/800x1000/f3ede4/1a1a1a?text=Hoops+Gold", "inStock": True},
            {"sku": "HOOP-SLV-04", "color": "Silver", "colorHex": "#c0c0c0", "image": "https://placehold.co/800x1000/f3ede4/1a1a1a?text=Hoops+Silver", "inStock": True},
        ],
    },
    {
        "sku": "prod-necklace-05",
        "name": "Layered Pendant Necklace Set",
        "price": 1299,
        "mrp": 1299,
        "description": (
            "A two-piece layered necklace set pairing a fine chain with a coin "
            "pendant — designed to be worn together or split across looks."
        ),
        "images": [
            "https://placehold.co/800x1000/f3ede4/1a1a1a?text=Necklace+Front",
            "https://placehold.co/800x1000/f3ede4/1a1a1a?text=Necklace+Detail",
        ],
        "attrs": {
            "slug": "layered-pendant-necklace-set",
            "brand": "Savvy Atelier",
            "type": "Necklace",
            "material": "Sterling Silver",
            "careInstructions": "Store flat to avoid tangling. Remove before swimming or showering. Polish with a jewellery cloth.",
            "measurements": "Chain lengths: 40cm and 45cm · Pendant diameter: 1.6cm",
            "shippingInfo": "Ships within 2 business days. Free shipping on orders over ₹2,999. Easy 15-day returns.",
            "currency": "INR",
            "collectionSlugs": ["jewellery"],
            "isNew": False,
            "isSale": False,
            "inStock": True,
            "tags": ["layered", "gifting"],
        },
        "variants": [
            {"sku": "NECK-SLV-05", "color": "Silver", "colorHex": "#c0c0c0", "image": "https://placehold.co/800x1000/f3ede4/1a1a1a?text=Necklace+Silver", "inStock": True},
            {"sku": "NECK-GLD-05", "color": "Gold", "colorHex": "#d4af37", "image": "https://placehold.co/800x1000/f3ede4/1a1a1a?text=Necklace+Gold", "inStock": True},
        ],
    },
    {
        "sku": "prod-claw-clip-06",
        "name": "Acetate Claw Clip Duo",
        "price": 349,
        "mrp": 499,
        "description": (
            "A two-pack of large acetate claw clips with a strong, gentle "
            "grip — sized for thick hair, styled for every day."
        ),
        "images": [
            "https://placehold.co/800x1000/f3ede4/1a1a1a?text=Claw+Clip",
        ],
        "attrs": {
            "slug": "acetate-claw-clip-duo",
            "brand": "Savvy",
            "type": "Hair Clip",
            "material": "Cellulose Acetate",
            "careInstructions": "Wipe clean with a dry cloth. Avoid dropping on hard surfaces.",
            "measurements": "Length: 10cm · Pack of 2",
            "shippingInfo": "Ships within 2 business days. Free shipping on orders over ₹2,999. Easy 15-day returns.",
            "currency": "INR",
            "collectionSlugs": ["jewellery"],
            "isNew": True,
            "isSale": True,
            "inStock": False,
            "tags": ["new-in", "hair", "thick-hair"],
        },
        "variants": [
            {"sku": "CLAW-TRT-06", "color": "Tortoise", "colorHex": "#6b4423", "image": "https://placehold.co/800x1000/f3ede4/1a1a1a?text=Claw+Tortoise", "inStock": True},
            {"sku": "CLAW-BLK-06", "color": "Black", "colorHex": "#1a1a1a", "image": "https://placehold.co/800x1000/f3ede4/1a1a1a?text=Claw+Black", "inStock": True},
            {"sku": "CLAW-BLS-06", "color": "Blush", "colorHex": "#e8b4b8", "image": "https://placehold.co/800x1000/f3ede4/1a1a1a?text=Claw+Blush", "inStock": False},
        ],
    },
]


async def seed() -> None:
    async with async_session_factory() as db:
        for entry in CATALOG:
            existing = await db.execute(select(Product).where(Product.sku == entry["sku"]))
            if existing.scalar_one_or_none() is not None:
                print(f"skip (exists): {entry['sku']}")
                continue

            product = Product(
                sku=entry["sku"],
                name=entry["name"],
                price=entry["price"],
                mrp=entry["mrp"],
                description=entry["description"],
                images=entry["images"],
                attrs=entry["attrs"],
            )
            for v in entry["variants"]:
                product.variants.append(
                    ProductVariant(
                        sku=v["sku"],
                        name=f"{entry['name']} - {v['color']}",
                        price=entry["price"],
                        mrp=entry["mrp"],
                        description=None,
                        images=[v["image"]],
                        attrs={
                            "color": v["color"],
                            "colorHex": v["colorHex"],
                            "inStock": v["inStock"],
                        },
                    )
                )
            db.add(product)
            print(f"seeded: {entry['sku']}")

        await db.commit()


if __name__ == "__main__":
    asyncio.run(seed())
