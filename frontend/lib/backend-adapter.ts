import type { BadgeAnimation, Product, ProductShow, ProductVariant, StockMode } from "./types";

/**
 * Shape returned by GET /api/products (see backend/app/schemas/product.py).
 * The backend's Product/ProductVariant tables only model a few universal
 * columns; everything display-specific (slug, brand, collections, tags,
 * flags, variant color/size) rides in the untyped `attrs` JSONB column,
 * seeded by backend/scripts/seed.py.
 */
export interface BackendProductVariant {
  id: string;
  sku: string;
  color: string;
  color_hex: string;
  image: string | null;
  in_stock: boolean;
  size?: string | null;
  price?: string | null;
  mrp?: string | null;
  stock_quantity?: number | null;
}

export interface BackendProduct {
  id: string;
  sku: string;
  slug: string;
  name: string;
  /** Pydantic serializes Decimal as a string to preserve precision. */
  price: string;
  mrp: string;
  in_stock: boolean;
  description: string | null;
  images: string[];
  attrs: Record<string, unknown>;
  variants: BackendProductVariant[];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

const SHOW_EVERYTHING: ProductShow = {
  name: true,
  category: true,
  price: true,
  mrp: true,
  dims: true,
};

/**
 * Read the admin's card display toggles out of attrs.
 *
 * Keys are merged over "show everything" one at a time rather than spread
 * wholesale, so a half-written or hand-edited attrs blob can only ever turn
 * off a row it explicitly names. Anything non-boolean is ignored.
 */
function readShow(value: unknown): ProductShow {
  if (!value || typeof value !== "object") return SHOW_EVERYTHING;
  const saved = value as Record<string, unknown>;
  const merged = { ...SHOW_EVERYTHING };
  for (const key of Object.keys(SHOW_EVERYTHING) as (keyof ProductShow)[]) {
    if (typeof saved[key] === "boolean") merged[key] = saved[key];
  }
  return merged;
}

function adaptVariant(variant: BackendProductVariant): ProductVariant {
  return {
    id: variant.id,
    color: variant.color,
    colorHex: variant.color_hex,
    size: undefined,
    sku: variant.sku,
    image: variant.image ?? "",
    inStock: variant.in_stock,
  };
}

export function adaptProduct(product: BackendProduct): Product {
  const attrs = product.attrs;
  return {
    // Must be the real DB primary key, not the human-readable SKU — checkout
    // sends this straight through as OrderItemCreate.product_id, which the
    // backend requires to be a valid UUID (see routers/orders.py).
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: typeof attrs.brand === "string" ? attrs.brand : "",
    type: typeof attrs.type === "string" ? attrs.type : "",
    material: typeof attrs.material === "string" ? attrs.material : "",
    description: product.description ?? "",
    careInstructions: typeof attrs.careInstructions === "string" ? attrs.careInstructions : "",
    measurements: typeof attrs.measurements === "string" ? attrs.measurements : "",
    shippingInfo: typeof attrs.shippingInfo === "string" ? attrs.shippingInfo : "",
    price: Number(product.price),
    mrp: Number(product.mrp),
    currency: attrs.currency === "USD" ? "USD" : "INR",
    images: product.images.map((url, index) => ({
      url,
      alt: `${product.name} image ${index + 1}`,
    })),
    variants: product.variants.map(adaptVariant),
    collectionSlugs: asStringArray(attrs.collectionSlugs),
    isNew: attrs.isNew === true,
    isSale: attrs.isSale === true,
    inStock: product.in_stock,
    tags: asStringArray(attrs.tags),
    stock: typeof attrs.stock === "number" ? attrs.stock : undefined,
    stockMode: typeof attrs.stockMode === "string" ? (attrs.stockMode as StockMode) : undefined,
    badgeAnimation:
      typeof attrs.badgeAnimation === "string" ? (attrs.badgeAnimation as BadgeAnimation) : undefined,
    show: readShow(attrs.show),
    isTestProduct: attrs.isTestProduct === true,
  };
}
