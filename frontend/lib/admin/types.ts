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

/**
 * One variant, as the editor holds it.
 *
 * The optional fields use `""` rather than `null` for "not set", because that
 * is what an empty form input produces and converting at the boundary is one
 * place to get wrong instead of three. `adapt.ts` turns them back into nulls,
 * which is what the API reads as "take the product's answer".
 */
export interface AdminVariant {
  /** Identity. Matched on by the API, so renaming one creates and deletes. */
  sku: string;
  color: string;
  colorHex: string;
  image: string;
  inStock: boolean;
  /** "" when the variant has no size, which is all fifty existing ones. */
  size: string;
  /** "" means the product's price applies. */
  price: number | "";
  mrp: number | "";
  /** "" means nobody is counting this variant, which is not the same as 0. */
  stockQuantity: number | "";
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
  /**
   * The product's variants.
   *
   * Carried for the same reason `images` is: the editor used to send
   * `variants: []` on every save because it had no variant UI, and the only
   * thing that stopped fifty of them being deleted was the API ignoring the
   * field. Now that it does not, the editor has to send the real set.
   */
  variants: AdminVariant[];
  name: string;
  category: string;
  price: number;
  mrp: number;
  cost: number;
  stock: number;
  maxPerOrder: number | "";
  desc: string;
  /** Primary image — what the editor's single ImageDrop shows and sets. */
  image: string;
  /**
   * Every image on the product, primary first.
   *
   * Carried even though the editor only edits the first one: without it a save
   * rebuilt `images` as `[image]` and silently dropped the rest of the gallery.
   */
  images: string[];
  /**
   * Collections this product belongs to, as slugs.
   *
   * Round-tripped rather than derived. A save used to rebuild this from the
   * category text, which moved the product into a collection that does not
   * exist and removed it from every real collection page.
   */
  collectionSlugs: string[];
  published: boolean;
  // Drives the storefront's "New In" homepage section + New badge (see
  // lib/types.ts BackendProduct.isNew). Named to match what it actually
  // does -- there is no separate "Featured" concept anywhere in the app.
  isNew: boolean;
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
  | "fraud"
  | "errorLogs"
  | "messages"
  | "activity"
  | "tools";

export const LOW_STOCK = 5;

/**
 * Upload rules per image slot.
 *
 * `w`/`h` are the recommended upload size — 2x what the slot actually renders
 * at, so it stays sharp on retina screens without shipping wasted pixels.
 * What's *enforced* is the aspect ratio (a 4:5 slot crops a square upload,
 * silently cutting off the top and bottom) and `maxKB`.
 *
 * maxKB matters more than usual here: next.config sets `unoptimized: true`,
 * so Next never resizes or recompresses — the uploaded file is delivered
 * byte-for-byte to every visitor, and gzip/zstd don't shrink already-
 * compressed image formats.
 */
export interface ImageSpec {
  w: number;
  h: number;
  maxKB: number;
  /** Human name for the shape, used in error messages. */
  shape: string;
}

export const IMG_SPECS = {
  /** Product grid card + detail gallery. */
  product: { w: 1000, h: 1250, maxKB: 250, shape: "4:5 portrait" },
  /** Homepage hero, the largest image on the site. */
  hero: { w: 1400, h: 1750, maxKB: 400, shape: "4:5 portrait" },
  /** Small inset image beside the hero copy (desktop only). */
  heroInset: { w: 640, h: 480, maxKB: 100, shape: "4:3 landscape" },
  /** Full-bleed teal campaign band. */
  campaign: { w: 1000, h: 1250, maxKB: 250, shape: "4:5 portrait" },
  /** Editorial story tiles. */
  editorial: { w: 900, h: 1125, maxKB: 200, shape: "4:5 portrait" },
  /** Circle-cropped quick CTA tiles + category tiles. */
  tile: { w: 640, h: 640, maxKB: 120, shape: "square" },
} as const satisfies Record<string, ImageSpec>;

export type SlotKey = keyof typeof IMG_SPECS;

/** Plain-English slot names. Shown on the pickers and in the crop dialog's
 * title, so the owner picks a place on the site rather than a pixel size. */
export const SLOT_LABELS: Record<SlotKey, string> = {
  product: "Product photo",
  hero: "Homepage hero",
  heroInset: "Hero inset",
  campaign: "Campaign band",
  editorial: "Editorial tile",
  tile: "Category tile",
};

/**
 * Name for a slot, given its spec.
 *
 * Identity first: every caller passes an `IMG_SPECS` reference, and that
 * resolves `product` vs `campaign` correctly even though the two share
 * dimensions. The value comparison is only a fallback for a hand-built spec.
 */
export function slotLabelFor(spec: ImageSpec): string {
  const keys = Object.keys(IMG_SPECS) as SlotKey[];
  const byIdentity = keys.find((key) => IMG_SPECS[key] === spec);
  if (byIdentity) return SLOT_LABELS[byIdentity];
  const byValue = keys.find(
    (key) => IMG_SPECS[key].w === spec.w && IMG_SPECS[key].h === spec.h,
  );
  return byValue ? SLOT_LABELS[byValue] : "Photo";
}

/**
 * File-size cap for the general Media Library when no slot is chosen. The
 * library is a shared pool, so "Original shape" stays available for images
 * whose destination isn't known yet — it still gets resized and re-encoded,
 * just not cropped. Matches the most generous slot (hero).
 */
export const MEDIA_MAX_KB = 400;

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
