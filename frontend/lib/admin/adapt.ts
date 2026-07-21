// Map the backend product shape into the richer admin model and back.
//
// The backend models a handful of columns and parks everything merchandising
// in the `attrs` JSONB blob (see backend/app/schemas/product.py). The admin
// screens need cost/margin/stock/badge styling, so those ride in attrs too.
// Fields the backend has no column for are round-tripped through attrs.

import type { BackendProduct } from "@/lib/backend-adapter";
import type { AdminBadge, AdminProduct } from "./types";
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
    name: p.name,
    category: attrStr(attrs, "type") || collectionSlugs[0] || "",
    price: Number(p.price),
    mrp: Number(p.mrp),
    cost: attrNum(attrs, "cost"),
    stock: attrNum(attrs, "stock", p.in_stock ? 1 : 0),
    maxPerOrder: attrNum(attrs, "maxPerOrder") || "",
    desc: p.description ?? "",
    image: p.images?.[0] ?? "",
    published: p.in_stock,
    featured: attrs.isNew === true,
    show: defShow(),
    stockMode: (attrStr(attrs, "stockMode", "hidden") as StockMode) || "hidden",
    dims: { h: "", w: "", l: "", unit: "cm" },
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
  return {
    sku,
    slug,
    name: p.name,
    price: (Number(p.price) || 0).toFixed(2),
    mrp: (Number(p.mrp) || 0).toFixed(2),
    in_stock: p.published && p.stock > 0,
    description: p.desc,
    images: p.image ? [p.image] : [],
    attrs: {
      type: p.category,
      cost: Number(p.cost) || 0,
      stock: Number(p.stock) || 0,
      maxPerOrder,
      stockMode: p.stockMode,
      isNew: p.featured,
      badge: p.badge,
      collectionSlugs: p.category ? [p.category.toLowerCase().replace(/\s+/g, "-")] : [],
    },
    variants: [],
  };
}
