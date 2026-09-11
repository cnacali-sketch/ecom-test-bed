// Core domain types shared across the storefront.

export type Currency = "INR" | "USD";

export interface Money {
  amount: number;
  currency: Currency;
}

export interface ProductVariant {
  id: string;
  color: string;
  colorHex: string;
  size?: string;
  sku: string;
  image: string;
  inStock: boolean;
  /** Optional low-stock/backorder copy shown next to the swatch label,
   * e.g. "Only 2 left". Absent means no note is shown. */
  stockNote?: string;
}

export interface ProductImage {
  url: string;
  alt: string;
}

export type BadgeAnimation = "shine" | "pulse" | "wiggle" | "none";
export type StockMode = "hidden" | "exact" | "lowOnly";

/**
 * Per-product card display toggles, set in the admin's product editor and
 * previewed there by ProductCardPreview.
 *
 * Every key defaults to true. A product saved before these existed, or one
 * whose attrs carry only some of the keys, must keep rendering exactly as it
 * does today — so a missing key is "show", never "hide".
 */
export interface ProductShow {
  name: boolean;
  category: boolean;
  price: boolean;
  mrp: boolean;
  dims: boolean;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  type: string;
  material: string;
  description: string;
  careInstructions: string;
  measurements: string;
  shippingInfo: string;
  price: number;
  mrp: number;
  currency: Currency;
  images: ProductImage[];
  variants: ProductVariant[];
  collectionSlugs: string[];
  isNew: boolean;
  isSale: boolean;
  inStock: boolean;
  tags: string[];
  /** Units on hand, only meaningful when stockMode is "exact" or "lowOnly". */
  stock?: number;
  /** What shoppers see about inventory level. Defaults to "hidden". */
  stockMode?: StockMode;
  /** Discount-badge attention style. Defaults to "shine" when on sale. */
  badgeAnimation?: BadgeAnimation;
  /** Which rows the product card renders. Absent means show everything. */
  show?: ProductShow;
  /** Internal payment-verification product. Real rows in the live catalogue,
   * but they must never be indexed by search engines or listed in the
   * sitemap. Carried from the backend's attrs so this keeps working when the
   * products are eventually deleted, rather than matching on slug. */
  isTestProduct?: boolean;
}

export interface Collection {
  id: string;
  slug: string;
  name: string;
  description: string;
  seoDescription: string;
  heroImage: string;
  productIds: string[];
}

export interface CartItem {
  productId: string;
  variantId: string;
  name: string;
  image: string;
  color: string;
  size?: string;
  price: number;
  currency: Currency;
  quantity: number;
}

export interface FilterCounts {
  brand: Record<string, number>;
  type: Record<string, number>;
  color: Record<string, number>;
  material: Record<string, number>;
}

export type SortOption =
  | "featured"
  | "best-selling"
  | "price-asc"
  | "price-desc"
  | "az"
  | "za"
  | "newest";
