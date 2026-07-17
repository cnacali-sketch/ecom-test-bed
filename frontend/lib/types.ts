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
}

export interface ProductImage {
  url: string;
  alt: string;
}

export type BadgeAnimation = "shine" | "pulse" | "wiggle" | "none";
export type StockMode = "hidden" | "exact" | "lowOnly";

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
