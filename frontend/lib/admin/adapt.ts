// Map the backend product shape into the richer admin model and back.
//
// The backend models a handful of columns and parks everything merchandising
// in the `attrs` JSONB blob (see backend/app/schemas/product.py). The admin
// screens need cost/margin/stock/badge styling, so those ride in attrs too.
// Fields the backend has no column for are round-tripped through attrs.

import type { BackendProduct } from "@/lib/backend-adapter";
import type { AdminBadge, AdminDims, AdminProduct } from "./types";
import { defBadge, defShow } from "./types";
import type { BadgeAnimation, StockMode } from "@/lib/types";

function attrStr(attrs: Record<string, unknown>, key: string, fallback = ""): string {
  const v = attrs[key];
  return typeof v === "string" ? v : fallback;
}

function attrNum(attrs: Record<string, unknown>, key: string, fallback = 0): number {
  const v = attrs[key];
  return typeof v === "number" ? v : fallback;
}

function readBadge(attrs: Record<string, unknown>): AdminBadge {
  const raw = attrs.badge;
  if (raw && typeof raw === "object") {
    const b = raw as Record<string, unknown>;
    return {
      on: b.on !== false,
      text: typeof b.text === "string" ? b.text : "",
      anim: (typeof b.anim === "string" ? b.anim : "shine") as BadgeAnimation,
      bg: typeof b.bg === "string" ? b.bg : "#f59e0b",
      fg: typeof b.fg === "string" ? b.fg : "#ffffff",
      opacity: typeof b.opacity === "number" ? b.opacity : 100,
    };
  }
  // Fall back to the storefront's simpler badgeAnimation field.
  const anim = attrStr(attrs, "badgeAnimation", "shine") as BadgeAnimation;
  return defBadge(anim);
}

/** Card display toggles, defaulting any missing key to "shown". */
function readShow(attrs: Record<string, unknown>) {
  const base = defShow();
  const raw = attrs.show;
  if (!raw || typeof raw !== "object") return base;
  const saved = raw as Record<string, unknown>;
  const merged = { ...base };
  for (const key of Object.keys(base) as (keyof typeof base)[]) {
    if (typeof saved[key] === "boolean") merged[key] = saved[key] as boolean;
  }
  return merged;
}

function readDims(attrs: Record<string, unknown>): AdminDims {
  const blank: AdminDims = { h: "", w: "", l: "", unit: "cm" };
  const raw = attrs.dims;
  if (!raw || typeof raw !== "object") return blank;
  const d = raw as Record<string, unknown>;
  const unit = d.unit === "in" || d.unit === "mm" ? d.unit : "cm";
  return {
    h: typeof d.h === "string" ? d.h : "",
    w: typeof d.w === "string" ? d.w : "",
    l: typeof d.l === "string" ? d.l : "",
    unit,
  };
}

/**
 * Human-readable size for the PDP's Measurements accordion
 * (components/product/ProductDetail.tsx:95), or null when nothing was entered.
 */
function measurementsFrom(dims: AdminDims): string | null {
  const parts = [dims.h, dims.w, dims.l].map((v) => v.trim()).filter(Boolean);
  return parts.length > 0 ? `${parts.join(" × ")} ${dims.unit}` : null;
}

/** Backend product -> editable admin product. */
export function toAdmin(p: BackendProduct): AdminProduct {
  const attrs = p.attrs ?? {};
  const collectionSlugs = Array.isArray(attrs.collectionSlugs)
    ? (attrs.collectionSlugs as string[])
    : [];
  return {
    id: p.id,
    sku: p.sku,
    slug: p.slug,
    isLocalOnly: false,
    variants: (p.variants ?? []).map((v) => ({
      sku: v.sku,
      color: v.color,
      colorHex: v.color_hex,
      image: v.image ?? "",
      inStock: v.in_stock,
      size: v.size ?? "",
      price: v.price == null ? "" : Number(v.price),
      mrp: v.mrp == null ? "" : Number(v.mrp),
      stockQuantity: v.stock_quantity == null ? "" : Number(v.stock_quantity),
    })),
    name: p.name,
    category: attrStr(attrs, "type") || collectionSlugs[0] || "",
    price: Number(p.price),
    mrp: Number(p.mrp),
    cost: attrNum(attrs, "cost"),
    stock: attrNum(attrs, "stock", p.in_stock ? 1 : 0),
    maxPerOrder: attrNum(attrs, "maxPerOrder") || "",
    desc: p.description ?? "",
    image: p.images?.[0] ?? "",
    images: p.images ?? [],
    collectionSlugs,
    published: p.in_stock,
    isNew: attrs.isNew === true,
    show: readShow(attrs),
    stockMode: (attrStr(attrs, "stockMode", "hidden") as StockMode) || "hidden",
    dims: readDims(attrs),
    badge: readBadge(attrs),
  };
}

const slugify = (s: string): string =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * Admin product -> backend create/update payload.
 *
 * `slug` is carried through unchanged for an already-persisted product (it's
 * the public PDP URL — see the doc on AdminProduct.slug) and only derived
 * from the name for a brand-new draft. `sku` likewise: the backend treats it
 * as immutable on update and ignores whatever is sent here for an existing
 * product, but a new draft still needs one to create with.
 *
 * Numeric fields go through `Number(...) || 0` because Inventory's inline
 * cells can commit an empty string on blur (see Inventory.tsx NumCell) — a
 * blank price/cost must not throw on `.toFixed()` or reach the API as NaN.
 */
export function toBackendPayload(p: AdminProduct): Record<string, unknown> {
  const slug = p.slug || slugify(p.name) || `product-${Date.now()}`;
  const sku = p.sku || slug.toUpperCase().slice(0, 60);
  const maxPerOrder = p.maxPerOrder === "" ? null : Number(p.maxPerOrder) || null;

  // The editor exposes one ImageDrop, which owns the *primary* slot only. So
  // images[0] is whatever that slot holds now (empty means the owner removed
  // it), and images[1..] — the gallery the admin has no UI for — is carried
  // through untouched instead of being replaced by [image].
  const gallery = p.images ?? [];
  const secondary = gallery.slice(1);
  const images = p.image ? [p.image, ...secondary] : secondary;

  // Preserve real membership. Deriving a slug from the category is only
  // reasonable for a product that has never been in a collection — for anything
  // else it silently relocates the product to a collection nobody created.
  const collectionSlugs =
    p.collectionSlugs && p.collectionSlugs.length > 0
      ? p.collectionSlugs
      : p.category
        ? [slugify(p.category)]
        : [];

  const measurements = measurementsFrom(p.dims);

  return {
    sku,
    slug,
    name: p.name,
    price: (Number(p.price) || 0).toFixed(2),
    mrp: (Number(p.mrp) || 0).toFixed(2),
    in_stock: p.published && p.stock > 0,
    description: p.desc,
    images,
    attrs: {
      type: p.category,
      cost: Number(p.cost) || 0,
      stock: Number(p.stock) || 0,
      maxPerOrder,
      stockMode: p.stockMode,
      isNew: p.isNew,
      badge: p.badge,
      collectionSlugs,
      show: p.show,
      dims: p.dims,
      // Only written when dimensions were actually entered. Omitting the key
      // lets the backend's attrs merge keep any hand-written measurements
      // string that is already on the product (verified against the API), so
      // a blank dims form never blanks the PDP's Measurements section.
      ...(measurements ? { measurements } : {}),
    },
    // The real set now, not an empty list. An empty one is read by the API as
    // "leave them alone" rather than "delete them" -- deliberately, because
    // this is exactly the payload every old console build sends -- so sending
    // [] here would quietly make variants uneditable rather than dangerous.
    variants: p.variants.map((v) => ({
      sku: v.sku,
      color: v.color,
      color_hex: v.colorHex,
      image: v.image || null,
      in_stock: v.inStock,
      size: v.size || null,
      price: v.price === "" ? null : Number(v.price),
      mrp: v.mrp === "" ? null : Number(v.mrp),
      stock_quantity: v.stockQuantity === "" ? null : Number(v.stockQuantity),
    })),
  };
}
