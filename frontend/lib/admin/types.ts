// Admin-side product model.
//
// Richer than the storefront `Product` (lib/types.ts): it carries backend-only
// merchandising fields the shopper never sees — cost, margin inputs, per-order
// cap, real stock count, and the badge styling controls. The 5-frame picker
// from the standalone demo is deliberately gone: the storefront uses one
// uniform gold hover-ring, so a per-product frame choice has nothing to drive.

import type { BadgeAnimation, StockMode } from "@/lib/types";

/** Which detail rows the shopper-facing card shows. Backend fields still exist regardless. */
export interface AdminShow {
  name: boolean;
  category: boolean;
  price: boolean;
  mrp: boolean;
  dims: boolean;
}

export interface AdminDims {
  h: string;
  w: string;
  l: string;
  unit: "cm" | "in" | "mm";
}

export interface AdminBadge {
  on: boolean;
  text: string;
  anim: BadgeAnimation;
  bg: string;
  fg: string;
  opacity: number;
}

export interface AdminProduct {
  /** Backend product UUID when it came from the API; a temp local id for a brand-new draft. */
  id: string;
  /** Backend sku, if persisted. Empty for an unsaved draft. Immutable once created (see adapt.ts). */
  sku: string;
  /**
   * Backend slug, if persisted. Empty for an unsaved draft. Must round-trip
   * unchanged on every save — losing it would silently break the public PDP
   * URL and any bookmarked/indexed link (toBackendPayload only derives a new
   * slug when this is empty, i.e. a genuinely new product).
   */
  slug: string;
  /** True until this product has been saved to the backend at least once. */
  isLocalOnly: boolean;
  name: string;
  category: string;
  price: number;
  mrp: number;
  cost: number;
  stock: number;
  maxPerOrder: number | "";
  desc: string;
  image: string;
  published: boolean;
  featured: boolean;
  show: AdminShow;
  stockMode: StockMode;
  dims: AdminDims;
  badge: AdminBadge;
}

export interface AdminCategory {
  id: string;
  name: string;
  parent: string;
  slug: string;
  image: string;
}

export interface MediaItem {
  id: string;
  name: string;
  url: string;
  size: number;
}

export type AdminView =
  | "dashboard"
  | "home"
  | "products"
  | "editor"
  | "inventory"
  | "categories"
  | "media"
  | "orders"
  | "customers"
  | "analytics"
  | "coupons"
  | "fraud";

export const LOW_STOCK = 5;
export const REQ_IMG = { w: 1000, h: 1000, maxMB: 2 };

export const BADGE_BG = [
  "#f59e0b", "#b8860b", "#0d9488", "#e11d48", "#b91c1c", "#7c3aed", "#059669", "#1f2937", "#ffffff",
];
export const BADGE_FG = ["#ffffff", "#111827", "#b8860b", "#0d9488", "#fffbeb"];

export const defShow = (): AdminShow => ({
  name: true, category: true, price: true, mrp: true, dims: true,
});

export const defBadge = (
  anim: BadgeAnimation = "shine",
  text = "",
  bg = "#f59e0b",
  fg = "#ffffff",
  opacity = 100,
): AdminBadge => ({ on: true, text, anim, bg, fg, opacity });
