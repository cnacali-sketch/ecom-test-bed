/**
 * ============================================================
 * CATALOG — every product and collection on the storefront.
 * ============================================================
 *
 * EDIT ME: To add a product, copy any block below and change the
 * fields. To clone this store for a different genre (candles,
 * ceramics, pet gear…), replace this file's contents and update
 * `content/site.config.ts` — nothing in components/ needs to change.
 *
 * Images are Pexels CDN URLs (free license, no attribution needed).
 * `px(photoId, width, height)` builds a cropped CDN URL.
 * Replace with your own product photography by swapping URLs or
 * pointing at files in /public.
 */
import type { Collection, Product } from "@/lib/types";
import { px } from "./site.config";

export const collections: Collection[] = [
  {
    id: "col-hair",
    slug: "hair-accessories",
    name: "Hair Accessories",
    description: "Claw clips, barrettes, silk scrunchies and pins — built to stay put.",
    seoDescription:
      "Our hair accessories are designed around real hair and real days. Claw clips come in two spring strengths — a wide grip for thick or curly hair and a gentler close for fine hair. French barrettes use steel spring closures that survive handbags and gym floors. Silk scrunchies are cut from mulberry silk to hold without creasing, and our pins and combs are finished by hand so nothing snags. Everything ships from our Bengaluru studio with 15-day easy returns, and bestsellers restock weekly.",
    heroImage: px(22469099, 1600, 700),
    productIds: [
      "prod-claw-tortoise",
      "prod-barrette-french",
      "prod-scrunchie-silk",
      "prod-ties-everyday",
      "prod-pins-pearl",
      "prod-clipset-pastel",
      "prod-combkit-salon",
    ],
  },
  {
    id: "col-jewellery",
    slug: "jewellery",
    name: "Jewellery",
    description: "Everyday gold-tone hoops, drops and pendants with waterproof plating.",
    seoDescription:
      "Jewellery that earns a place in daily rotation: PVD gold-tone plating that shrugs off water and sweat, hypoallergenic posts, and shapes made for stacking rather than storing. From everyday hoops to heritage-inspired drops with pearl and stone detail, each piece ships with care notes to keep the finish looking new. Pair them with our hair accessories — the teal box means they're made to be worn together.",
    heroImage: px(10944923, 1600, 700),
    productIds: ["prod-hoops-everyday", "prod-drops-heritage", "prod-pendant-teal"],
  },
];

export const products: Product[] = [
  // ---------------- HAIR ACCESSORIES ----------------
  {
    id: "prod-claw-tortoise",
    slug: "tortoise-grip-claw-clip",
    name: "Tortoise Grip Claw Clip",
    brand: "Savvy In Teal",
    type: "Claw Clip",
    material: "Cellulose Acetate",
    description:
      "Our signature claw clip in hand-polished cellulose acetate. A wide steel spring and long interlocking teeth hold a full twist of thick or curly hair without slipping — and without the creak of cheap plastic.",
    careInstructions:
      "Wipe with a soft dry cloth. Avoid dropping on hard floors; acetate is durable but not unbreakable. Keep away from direct heat (car dashboards, straighteners).",
    measurements: "Length: 11cm · Width: 5cm · Spring: wide-grip steel",
    shippingInfo: "Ships within 2 business days. Free shipping over ₹1,499. 15-day easy returns.",
    price: 649,
    mrp: 899,
    currency: "INR",
    images: [
      { url: px(33343186, 800, 1000), alt: "Neutral claw clips arranged on dark stone" },
      { url: px(20166056, 800, 1000), alt: "Claw clips styled on soft white fur" },
      { url: px(20166053, 800, 1000), alt: "Close-up of claw clip teeth and finish" },
    ],
    variants: [
      { id: "var-claw-tortoise", color: "Tortoise", colorHex: "#6b4423", sku: "SIT-CLAW-TOR-01", image: px(33343186, 800, 1000), inStock: true },
      { id: "var-claw-black", color: "Black", colorHex: "#1a1a1a", sku: "SIT-CLAW-BLK-01", image: px(20166053, 800, 1000), inStock: true },
      { id: "var-claw-champagne", color: "Champagne", colorHex: "#e8d9b5", sku: "SIT-CLAW-CHM-01", image: px(20166056, 800, 1000), inStock: false },
    ],
    collectionSlugs: ["hair-accessories"],
    isNew: true,
    isSale: true,
    inStock: true,
    tags: ["claw", "thick-hair", "bestseller"],
    // Demo: wiggling sale badge, urgency "Only N left".
    stock: 3,
    stockMode: "lowOnly",
    badgeAnimation: "wiggle",
  },
  {
    id: "prod-barrette-french",
    slug: "classic-french-barrette",
    name: "Classic French Barrette",
    brand: "Savvy In Teal",
    type: "Barrette",
    material: "Acetate + Steel",
    description:
      "The half-up workhorse. A classic French barrette with a steel spring closure that clicks shut and stays shut — from morning meeting to last local home.",
    careInstructions:
      "Wipe clean with a dry cloth. If the spring loosens over years of wear, a gentle re-bend restores the click.",
    measurements: "Length: 8cm · Closure: French steel spring",
    shippingInfo: "Ships within 2 business days. Free shipping over ₹1,499. 15-day easy returns.",
    price: 449,
    mrp: 599,
    currency: "INR",
    images: [
      { url: px(31854724, 800, 1000), alt: "Barrettes and clips arranged in a shell dish" },
      { url: px(7450827, 800, 1000), alt: "Barrettes worn in curly hair, portrait" },
    ],
    variants: [
      { id: "var-barrette-gold", color: "Gold", colorHex: "#d4af37", sku: "SIT-BARR-GLD-01", image: px(31854724, 800, 1000), inStock: true },
      { id: "var-barrette-tortoise", color: "Tortoise", colorHex: "#6b4423", sku: "SIT-BARR-TOR-01", image: px(7450827, 800, 1000), inStock: true },
    ],
    collectionSlugs: ["hair-accessories"],
    isNew: false,
    isSale: true,
    inStock: true,
    tags: ["barrette", "half-up"],
    // Demo: exact stock count shown for trust.
    stock: 24,
    stockMode: "exact",
  },
  {
    id: "prod-scrunchie-silk",
    slug: "mulberry-silk-scrunchie-trio",
    name: "Mulberry Silk Scrunchie Trio",
    brand: "Savvy In Teal",
    type: "Scrunchie",
    material: "Mulberry Silk",
    description:
      "Three 22-momme mulberry silk scrunchies in a rotating set of seasonal shades. Silk glides instead of gripping, so overnight buns come down crease-free.",
    careInstructions:
      "Hand wash cold with a drop of gentle shampoo. Air dry flat, away from direct sun. Do not wring.",
    measurements: "Diameter: 10cm relaxed · Silk: 22 momme charmeuse",
    shippingInfo: "Ships within 2 business days. Free shipping over ₹1,499. 15-day easy returns.",
    price: 999,
    mrp: 1299,
    currency: "INR",
    images: [
      { url: px(37195179, 800, 1000), alt: "Stack of silk scrunchies in soft light" },
      { url: px(31253361, 800, 1000), alt: "Satin scrunchies in warm red tones" },
    ],
    variants: [
      { id: "var-scrunchie-neutrals", color: "The Neutrals", colorHex: "#cbb9a4", sku: "SIT-SCRN-NEU-03", image: px(37195179, 800, 1000), inStock: true },
      { id: "var-scrunchie-jewel", color: "The Jewels", colorHex: "#7a1f2b", sku: "SIT-SCRN-JWL-03", image: px(31253361, 800, 1000), inStock: true },
    ],
    collectionSlugs: ["hair-accessories"],
    isNew: true,
    isSale: false,
    inStock: true,
    tags: ["scrunchie", "silk", "gift"],
    // Demo: exact stock. No sale = no badge.
    stock: 40,
    stockMode: "exact",
  },
  {
    id: "prod-ties-everyday",
    slug: "everyday-hair-tie-set",
    name: "Everyday Hair Tie Set",
    brand: "Savvy In Teal",
    type: "Hair Tie",
    material: "Seamless Elastic",
    description:
      "Eight seamless elastics with a soft matte weave — strong enough for a gym-day ponytail, gentle enough for fine hair. The set lives happily on a wrist without leaving a mark.",
    careInstructions: "Machine wash in a laundry bag if needed; air dry. Replace when elasticity fades.",
    measurements: "Diameter: 5cm relaxed · Set of 8",
    shippingInfo: "Ships within 2 business days. Free shipping over ₹1,499. 15-day easy returns.",
    price: 349,
    mrp: 449,
    currency: "INR",
    images: [
      { url: px(6044137, 800, 1000), alt: "Hair ties with dried flowers on a decorative box" },
      { url: px(6044135, 800, 1000), alt: "Hair ties arranged with soft styling" },
      { url: px(6044144, 800, 1000), alt: "Hair tie set detail on textured surface" },
    ],
    variants: [
      { id: "var-ties-warm", color: "Warm Set", colorHex: "#b98a5e", sku: "SIT-TIES-WRM-08", image: px(6044137, 800, 1000), inStock: true },
      { id: "var-ties-cool", color: "Cool Set", colorHex: "#5b7a76", sku: "SIT-TIES-CLL-08", image: px(6044144, 800, 1000), inStock: true },
    ],
    collectionSlugs: ["hair-accessories"],
    isNew: false,
    isSale: false,
    inStock: true,
    tags: ["ties", "everyday", "multipack"],
  },
  {
    id: "prod-pins-pearl",
    slug: "pearl-cluster-hair-pins",
    name: "Pearl Cluster Hair Pins",
    brand: "Savvy In Teal",
    type: "Hair Pin",
    material: "Faux Pearl + Alloy",
    description:
      "A set of five pins topped with clustered faux pearls — the fastest way to turn a plain bun into an occasion. Wedding-season favourite; sells out every October.",
    careInstructions: "Store in the pouch provided. Wipe pearls with a dry cloth; avoid perfume contact.",
    measurements: "Pin length: 6cm · Set of 5",
    shippingInfo: "Ships within 2 business days. Free shipping over ₹1,499. 15-day easy returns.",
    price: 799,
    mrp: 999,
    currency: "INR",
    images: [
      { url: px(27462683, 800, 1000), alt: "Pearl hair clips with baby's breath flowers" },
      { url: px(18031831, 800, 1000), alt: "Floral hair accessories flat lay" },
      { url: px(34186057, 800, 1000), alt: "Updo styled with decorative pins and flowers" },
    ],
    variants: [
      { id: "var-pins-pearl", color: "Pearl", colorHex: "#f3ede4", sku: "SIT-PINS-PRL-05", image: px(27462683, 800, 1000), inStock: true },
    ],
    collectionSlugs: ["hair-accessories"],
    isNew: true,
    isSale: false,
    inStock: true,
    tags: ["pins", "occasion", "bridal"],
    // Demo: low-stock urgency ("sells out every October").
    stock: 2,
    stockMode: "lowOnly",
  },
  {
    id: "prod-clipset-pastel",
    slug: "pastel-mini-clip-set",
    name: "Pastel Mini Clip Set",
    brand: "Savvy In Teal",
    type: "Clip Set",
    material: "Resin",
    description:
      "Twelve mini clips in sorbet shades — for face-framing pieces, kids' hair, or pinning back a grow-out fringe. The teal one is, naturally, our favourite.",
    careInstructions: "Wipe clean. Keep the set in its tin so the small ones stop disappearing.",
    measurements: "Clip length: 3cm · Set of 12",
    shippingInfo: "Ships within 2 business days. Free shipping over ₹1,499. 15-day easy returns.",
    price: 499,
    mrp: 699,
    currency: "INR",
    images: [
      { url: px(8468179, 800, 1000), alt: "Colorful mini clips flat lay on pastel background" },
      { url: px(8468016, 800, 1000), alt: "Colorful clips worn in straight brown hair" },
      { url: px(33343184, 800, 1000), alt: "Clips arranged on textured surface" },
    ],
    variants: [
      { id: "var-clipset-sorbet", color: "Sorbet Mix", colorHex: "#e8b4b8", sku: "SIT-CLIP-SRB-12", image: px(8468179, 800, 1000), inStock: true },
    ],
    collectionSlugs: ["hair-accessories"],
    isNew: false,
    isSale: true,
    inStock: true,
    tags: ["clips", "kids", "multipack"],
    // Demo: pulsing sale badge, hidden stock.
    badgeAnimation: "pulse",
  },
  {
    id: "prod-combkit-salon",
    slug: "salon-comb-and-clip-kit",
    name: "Salon Comb & Clip Kit",
    brand: "Savvy In Teal",
    type: "Kit",
    material: "Carbon Fibre + Steel",
    description:
      "The kit our stylist friends kept borrowing: two carbon-fibre combs, four sectioning clips, and a tail comb, rolled into a canvas pouch. Heat-resistant, anti-static, salon-grade.",
    careInstructions: "Wash combs in warm soapy water monthly. Canvas pouch is machine washable.",
    measurements: "Combs: 18cm & 21cm · Sectioning clips: 9cm · Pouch: 24cm roll",
    shippingInfo: "Ships within 2 business days. Free shipping over ₹1,499. 15-day easy returns.",
    price: 1199,
    mrp: 1499,
    currency: "INR",
    images: [
      { url: px(35013087, 800, 1000), alt: "Salon drawer with combs and sectioning clips" },
      { url: px(6188294, 800, 1000), alt: "Clips detail on textured mesh" },
    ],
    variants: [
      { id: "var-combkit-black", color: "Black", colorHex: "#1a1a1a", sku: "SIT-COMB-BLK-KIT", image: px(35013087, 800, 1000), inStock: true },
    ],
    collectionSlugs: ["hair-accessories"],
    isNew: false,
    isSale: false,
    inStock: false,
    tags: ["kit", "salon", "tools"],
  },

  // ---------------- JEWELLERY ----------------
  {
    id: "prod-hoops-everyday",
    slug: "everyday-gold-hoops",
    name: "Everyday Gold Hoops",
    brand: "Savvy In Teal",
    type: "Earrings",
    material: "PVD Gold-Tone Steel",
    description:
      "Mid-size hoops with a click-secure closure and waterproof PVD plating. Shower in them, gym in them, forget you own them — they'll still be gold.",
    careInstructions:
      "PVD plating is water-resistant; still avoid perfume and chlorine. Wipe with the cloth provided.",
    measurements: "Diameter: 28mm · Post: hypoallergenic steel",
    shippingInfo: "Ships within 2 business days. Free shipping over ₹1,499. 15-day easy returns.",
    price: 1299,
    mrp: 1699,
    currency: "INR",
    images: [
      { url: px(12144990, 800, 1000), alt: "Gold hoop earrings resting on an open book" },
      { url: px(15787782, 800, 1000), alt: "Golden earrings detail on book page" },
    ],
    variants: [
      { id: "var-hoops-gold", color: "Gold", colorHex: "#d4af37", sku: "SIT-HOOP-GLD-28", image: px(12144990, 800, 1000), inStock: true },
    ],
    collectionSlugs: ["jewellery"],
    isNew: true,
    isSale: true,
    inStock: true,
    tags: ["earrings", "hoops", "waterproof"],
  },
  {
    id: "prod-drops-heritage",
    slug: "heritage-drop-earrings",
    name: "Heritage Drop Earrings",
    brand: "Savvy In Teal",
    type: "Earrings",
    material: "Alloy + Pearl + Stone",
    description:
      "Occasion drops with pearl and green-stone detail, drawn from heritage jewellery silhouettes. Heavier in look than on the ear — the lever back carries the weight.",
    careInstructions: "Store flat in the box. Wipe after wear; keep away from moisture and perfume.",
    measurements: "Drop length: 55mm · Closure: lever back",
    shippingInfo: "Ships within 2 business days. Free shipping over ₹1,499. 15-day easy returns.",
    price: 1899,
    mrp: 2499,
    currency: "INR",
    images: [
      { url: px(13595793, 800, 1000), alt: "Gold drop earrings with emerald beads and pearls" },
      { url: px(32989030, 800, 1000), alt: "Chandelier earrings on beige background" },
    ],
    variants: [
      { id: "var-drops-emerald", color: "Emerald", colorHex: "#2e6b4f", sku: "SIT-DROP-EMR-01", image: px(13595793, 800, 1000), inStock: true },
    ],
    collectionSlugs: ["jewellery"],
    isNew: false,
    isSale: false,
    inStock: true,
    tags: ["earrings", "occasion", "heritage"],
  },
  {
    id: "prod-pendant-teal",
    slug: "signature-teal-pendant",
    name: "Signature Teal Pendant",
    brand: "Savvy In Teal",
    type: "Necklace",
    material: "PVD Gold-Tone + Enamel",
    description:
      "Our namesake piece: a small enamel pendant in the house teal on a fine gold-tone chain. The one we put in every gift order's photo.",
    careInstructions: "Wipe gently; enamel resists scratching but not impact. Fasten the clasp before storing.",
    measurements: "Chain: 45cm + 5cm extender · Pendant: 12mm",
    shippingInfo: "Ships within 2 business days. Free shipping over ₹1,499. 15-day easy returns.",
    price: 1499,
    mrp: 1999,
    currency: "INR",
    images: [
      { url: px(32780784, 800, 1000), alt: "Gold pendant necklace styled on fabric" },
      { url: px(10944923, 800, 1000), alt: "Woman wearing layered gold jewellery" },
    ],
    variants: [
      { id: "var-pendant-teal", color: "Teal", colorHex: "#1f6f6b", sku: "SIT-PNDT-TEA-01", image: px(32780784, 800, 1000), inStock: true },
      { id: "var-pendant-blush", color: "Blush", colorHex: "#e8b4b8", sku: "SIT-PNDT-BLS-01", image: px(10944923, 800, 1000), inStock: true },
    ],
    collectionSlugs: ["jewellery"],
    isNew: true,
    isSale: false,
    inStock: true,
    tags: ["necklace", "signature", "gift"],
  },
];

// ---------- Lookup helpers (used by lib/api.ts fallbacks) ----------

export function getCollectionBySlug(slug: string): Collection | undefined {
  return collections.find((collection) => collection.slug === slug);
}

export function getProductsByCollectionSlug(slug: string): Product[] {
  return products.filter((product) => product.collectionSlugs.includes(slug));
}

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}
