import type { Product, ProductVariant } from "./types";

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
  name: string;
  price: number;
  mrp: number;
  description: string | null;
  images: string[];
  attrs: Record<string, unknown>;
}

export interface BackendProduct {
  id: string;
  sku: string;
  name: string;
  price: number;
  mrp: number;
  description: string | null;
  images: string[];
  attrs: Record<string, unknown>;
  variants: BackendProductVariant[];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function adaptVariant(variant: BackendProductVariant): ProductVariant {
  const attrs = variant.attrs;
  return {
    id: variant.id,
    color: typeof attrs.color === "string" ? attrs.color : variant.name,
    colorHex: typeof attrs.colorHex === "string" ? attrs.colorHex : "#000000",
    size: typeof attrs.size === "string" ? attrs.size : undefined,
    sku: variant.sku,
    image: variant.images[0] ?? "",
    inStock: typeof attrs.inStock === "boolean" ? attrs.inStock : true,
  };
}

export function adaptProduct(product: BackendProduct): Product {
  const attrs = product.attrs;
  return {
    id: product.sku,
    slug: typeof attrs.slug === "string" ? attrs.slug : product.sku,
    name: product.name,
    brand: typeof attrs.brand === "string" ? attrs.brand : "",
    type: typeof attrs.type === "string" ? attrs.type : "",
    material: typeof attrs.material === "string" ? attrs.material : "",
    description: product.description ?? "",
    careInstructions: typeof attrs.careInstructions === "string" ? attrs.careInstructions : "",
    measurements: typeof attrs.measurements === "string" ? attrs.measurements : "",
    shippingInfo: typeof attrs.shippingInfo === "string" ? attrs.shippingInfo : "",
    price: product.price,
    mrp: product.mrp,
    currency: attrs.currency === "USD" ? "USD" : "INR",
    images: product.images.map((url, index) => ({
      url,
      alt: `${product.name} image ${index + 1}`,
    })),
    variants: product.variants.map(adaptVariant),
    collectionSlugs: asStringArray(attrs.collectionSlugs),
    isNew: attrs.isNew === true,
    isSale: attrs.isSale === true,
    inStock: attrs.inStock !== false,
    tags: asStringArray(attrs.tags),
  };
}
