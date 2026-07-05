import type { Collection, Product } from "./types";

// Placeholder imagery only — no hotlinked/proprietary CDN assets.
const img = (seed: string, w = 800, h = 1000) =>
  `https://placehold.co/${w}x${h}/f3ede4/1a1a1a?text=${encodeURIComponent(seed)}`;

export const collections: Collection[] = [
  {
    id: "col-bags",
    slug: "bags",
    name: "Bags",
    description: "Totes, slings, and everyday carry pieces built for movement.",
    seoDescription:
      "Our bag edit spans structured totes, slouchy slings, and compact crossbodies designed for the way you actually move through a day. Each piece is built on durable vegan-leather bases with reinforced stitching at stress points, so your everyday carry looks as sharp on day 300 as it did on day one. Shop by occasion — work totes with laptop sleeves, weekend slings that go hands-free, and mini bags for nights out — or browse the full range and let color do the talking. New drops land monthly, and our best sellers restock fast, so sign up for restock alerts if your size or shade sells out.",
    heroImage: img("Bags Collection", 1600, 700),
    productIds: ["prod-tote-01", "prod-sling-02", "prod-clutch-03"],
  },
  {
    id: "col-jewellery",
    slug: "jewellery",
    name: "Jewellery",
    description: "Stackable earrings, layered necklaces, and everyday fine-adjacent pieces.",
    seoDescription:
      "Jewellery that earns its place in daily rotation: waterproof platings, hypoallergenic bases, and finishes that hold up to gym bags and beach trips alike. From statement hoops to delicate layered chains, our jewellery edit is built around mixing and stacking rather than one-and-done styling. Every piece ships with care instructions to keep the plating looking new, and our bestsellers are restocked continuously so your favorites are rarely out of reach for long.",
    heroImage: img("Jewellery Collection", 1600, 700),
    productIds: ["prod-hoops-04", "prod-necklace-05", "prod-claw-clip-06"],
  },
];

export const products: Product[] = [
  {
    id: "prod-tote-01",
    slug: "everyday-structured-tote",
    name: "Everyday Structured Tote",
    brand: "Savvy",
    type: "Tote",
    material: "Vegan Leather",
    description:
      "A structured tote built for the daily commute — padded laptop sleeve, wide top opening, and a base that keeps its shape whether you're carrying two things or twenty.",
    careInstructions:
      "Wipe clean with a soft, dry cloth. Avoid prolonged sun exposure. Store flat or upright with light stuffing to retain shape. Keep away from sharp objects and rough surfaces.",
    measurements: "Height: 32cm · Width: 40cm · Depth: 14cm · Strap drop: 22cm",
    shippingInfo:
      "Ships within 2 business days. Free shipping on orders over ₹2,999. Easy 15-day returns.",
    price: 2799,
    mrp: 3999,
    currency: "INR",
    images: [
      { url: img("Tote Front"), alt: "Everyday Structured Tote, front view" },
      { url: img("Tote Side"), alt: "Everyday Structured Tote, side view" },
      { url: img("Tote Detail"), alt: "Everyday Structured Tote, hardware detail" },
    ],
    variants: [
      { id: "var-tote-black", color: "Black", colorHex: "#1a1a1a", sku: "TOTE-BLK-01", image: img("Tote Black"), inStock: true },
      { id: "var-tote-tan", color: "Tan", colorHex: "#c8a06a", sku: "TOTE-TAN-01", image: img("Tote Tan"), inStock: true },
      { id: "var-tote-red", color: "Brick Red", colorHex: "#a13d2b", sku: "TOTE-RED-01", image: img("Tote Red"), inStock: false },
    ],
    collectionSlugs: ["bags"],
    isNew: true,
    isSale: true,
    inStock: true,
    tags: ["new-in", "work", "best-seller"],
  },
  {
    id: "prod-sling-02",
    slug: "hands-free-crossbody-sling",
    name: "Hands-Free Crossbody Sling",
    brand: "Savvy",
    type: "Sling Bag",
    material: "Nylon",
    description:
      "A lightweight nylon sling with an adjustable strap and a water-resistant lining — made for days when you need both hands free and your essentials close.",
    careInstructions:
      "Spot clean with a damp cloth and mild detergent. Do not machine wash. Air dry only, away from direct heat.",
    measurements: "Height: 18cm · Width: 24cm · Depth: 7cm · Strap length: adjustable up to 130cm",
    shippingInfo:
      "Ships within 2 business days. Free shipping on orders over ₹2,999. Easy 15-day returns.",
    price: 1499,
    mrp: 1499,
    currency: "INR",
    images: [
      { url: img("Sling Front"), alt: "Hands-Free Crossbody Sling, front view" },
      { url: img("Sling Worn"), alt: "Hands-Free Crossbody Sling, worn crossbody" },
    ],
    variants: [
      { id: "var-sling-black", color: "Black", colorHex: "#1a1a1a", sku: "SLNG-BLK-02", image: img("Sling Black"), inStock: true },
      { id: "var-sling-olive", color: "Olive", colorHex: "#5c6b45", sku: "SLNG-OLV-02", image: img("Sling Olive"), inStock: true },
    ],
    collectionSlugs: ["bags"],
    isNew: true,
    isSale: false,
    inStock: true,
    tags: ["new-in", "travel"],
  },
  {
    id: "prod-clutch-03",
    slug: "satin-evening-clutch",
    name: "Satin Evening Clutch",
    brand: "Savvy Atelier",
    type: "Clutch",
    material: "Satin",
    description:
      "A slim satin clutch with a magnetic clasp and detachable chain strap — enough room for the essentials, small enough to disappear into an evening.",
    careInstructions:
      "Dry clean only. Store in the provided dust bag. Avoid contact with water and oils.",
    measurements: "Height: 11cm · Width: 21cm · Depth: 4cm · Chain drop: 55cm",
    shippingInfo:
      "Ships within 2 business days. Free shipping on orders over ₹2,999. Easy 15-day returns.",
    price: 1899,
    mrp: 2599,
    currency: "INR",
    images: [
      { url: img("Clutch Front"), alt: "Satin Evening Clutch, front view" },
      { url: img("Clutch Open"), alt: "Satin Evening Clutch, interior view" },
    ],
    variants: [
      { id: "var-clutch-champagne", color: "Champagne", colorHex: "#e8d9b5", sku: "CLTC-CHM-03", image: img("Clutch Champagne"), inStock: true },
      { id: "var-clutch-black", color: "Black", colorHex: "#1a1a1a", sku: "CLTC-BLK-03", image: img("Clutch Black"), inStock: false },
    ],
    collectionSlugs: ["bags"],
    isNew: false,
    isSale: true,
    inStock: true,
    tags: ["evening"],
  },
  {
    id: "prod-hoops-04",
    slug: "waterproof-gold-hoops",
    name: "Waterproof Gold Hoops",
    brand: "Savvy",
    type: "Earrings",
    material: "Gold Plated Brass",
    description:
      "18k gold-plated hoops with a waterproof coating that resists tarnish from sweat, showers, and daily wear. Lightweight enough to forget you're wearing them.",
    careInstructions:
      "Wipe with a soft cloth after wear. Avoid perfume and lotion contact directly on the plating. Store in a dry pouch.",
    measurements: "Diameter: 3cm · Weight: 4g per pair",
    shippingInfo:
      "Ships within 2 business days. Free shipping on orders over ₹2,999. Easy 15-day returns.",
    price: 599,
    mrp: 899,
    currency: "INR",
    images: [
      { url: img("Hoops Front"), alt: "Waterproof Gold Hoops, front view" },
      { url: img("Hoops Worn"), alt: "Waterproof Gold Hoops, worn detail" },
    ],
    variants: [
      { id: "var-hoops-gold", color: "Gold", colorHex: "#d4af37", sku: "HOOP-GLD-04", image: img("Hoops Gold"), inStock: true },
      { id: "var-hoops-silver", color: "Silver", colorHex: "#c0c0c0", sku: "HOOP-SLV-04", image: img("Hoops Silver"), inStock: true },
    ],
    collectionSlugs: ["jewellery"],
    isNew: true,
    isSale: true,
    inStock: true,
    tags: ["new-in", "best-seller", "waterproof"],
  },
  {
    id: "prod-necklace-05",
    slug: "layered-pendant-necklace-set",
    name: "Layered Pendant Necklace Set",
    brand: "Savvy Atelier",
    type: "Necklace",
    material: "Sterling Silver",
    description:
      "A two-piece layered necklace set pairing a fine chain with a coin pendant — designed to be worn together or split across looks.",
    careInstructions:
      "Store flat to avoid tangling. Remove before swimming or showering. Polish with a jewellery cloth.",
    measurements: "Chain lengths: 40cm and 45cm · Pendant diameter: 1.6cm",
    shippingInfo:
      "Ships within 2 business days. Free shipping on orders over ₹2,999. Easy 15-day returns.",
    price: 1299,
    mrp: 1299,
    currency: "INR",
    images: [
      { url: img("Necklace Front"), alt: "Layered Pendant Necklace Set, front view" },
      { url: img("Necklace Detail"), alt: "Layered Pendant Necklace Set, pendant detail" },
    ],
    variants: [
      { id: "var-necklace-silver", color: "Silver", colorHex: "#c0c0c0", sku: "NECK-SLV-05", image: img("Necklace Silver"), inStock: true },
      { id: "var-necklace-gold", color: "Gold", colorHex: "#d4af37", sku: "NECK-GLD-05", image: img("Necklace Gold"), inStock: true },
    ],
    collectionSlugs: ["jewellery"],
    isNew: false,
    isSale: false,
    inStock: true,
    tags: ["layered", "gifting"],
  },
  {
    id: "prod-claw-clip-06",
    slug: "acetate-claw-clip-duo",
    name: "Acetate Claw Clip Duo",
    brand: "Savvy",
    type: "Hair Clip",
    material: "Cellulose Acetate",
    description:
      "A two-pack of large acetate claw clips with a strong, gentle grip — sized for thick hair, styled for every day.",
    careInstructions: "Wipe clean with a dry cloth. Avoid dropping on hard surfaces.",
    measurements: "Length: 10cm · Pack of 2",
    shippingInfo:
      "Ships within 2 business days. Free shipping on orders over ₹2,999. Easy 15-day returns.",
    price: 349,
    mrp: 499,
    currency: "INR",
    images: [{ url: img("Claw Clip"), alt: "Acetate Claw Clip Duo" }],
    variants: [
      { id: "var-claw-tortoise", color: "Tortoise", colorHex: "#6b4423", sku: "CLAW-TRT-06", image: img("Claw Tortoise"), inStock: true },
      { id: "var-claw-black", color: "Black", colorHex: "#1a1a1a", sku: "CLAW-BLK-06", image: img("Claw Black"), inStock: true },
      { id: "var-claw-blush", color: "Blush", colorHex: "#e8b4b8", sku: "CLAW-BLS-06", image: img("Claw Blush"), inStock: false },
    ],
    collectionSlugs: ["jewellery"],
    isNew: true,
    isSale: true,
    inStock: false,
    tags: ["new-in", "hair", "thick-hair"],
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}

export function getCollectionBySlug(slug: string): Collection | undefined {
  return collections.find((collection) => collection.slug === slug);
}

export function getProductsByCollectionSlug(slug: string): Product[] {
  return products.filter((product) => product.collectionSlugs.includes(slug));
}

export function getRelatedProducts(product: Product, limit = 4): Product[] {
  return products
    .filter(
      (candidate) =>
        candidate.id !== product.id &&
        candidate.collectionSlugs.some((slug) => product.collectionSlugs.includes(slug)),
    )
    .slice(0, limit);
}
