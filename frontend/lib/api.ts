import { cache } from "react";

import { adaptProduct, type BackendProduct } from "./backend-adapter";
import {
  collections as mockCollections,
  getCollectionBySlug as getMockCollectionBySlug,
  getProductsByCollectionSlug as getMockProductsByCollectionSlug,
  products as mockProducts,
} from "./mock-data";
import type { Collection, Product } from "./types";

// Backend is OPT-IN during the frontend-first phase: the storefront uses
// the bundled catalog (content/catalog.ts) unless NEXT_PUBLIC_API_URL is
// explicitly set. This prevents a stale locally-running backend from
// hijacking the storefront with old seed data.
const FETCH_TIMEOUT_MS = 3000;

/** Backend base URL, or null when the storefront should stay on the bundled catalog. */
function apiBaseUrl(): string | null {
  return process.env.NEXT_PUBLIC_API_URL ?? null;
}

/**
 * Small fetch wrapper around the FastAPI backend. The backend is being built
 * in parallel and may not be running yet, so every call falls back to the
 * bundled mock data on any failure (network error, timeout, non-2xx, bad
 * JSON) instead of throwing — pages must never hard-crash for this reason.
 */
async function fetchJson<T>(path: string, revalidateSeconds?: number): Promise<T | null> {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      ...(revalidateSeconds != null ? { next: { revalidate: revalidateSeconds } } : {}),
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Fetches the live catalog; returns null (not []) when the backend is
// unreachable OR responds with an unexpected (non-array) shape, so callers
// can distinguish "backend down/broken" from "no matches".
//
// limit=200 (the backend's max) is passed explicitly: GET /api/products
// defaults to 48, so without this the storefront would silently show only
// the newest 48 of a larger catalog. 200 covers the current catalog with
// room to spare; move to real pagination if it ever grows past that.
async function fetchLiveProducts(): Promise<Product[] | null> {
  const data = await fetchJson<BackendProduct[]>("/api/products?limit=200");
  return Array.isArray(data) ? data.map(adaptProduct) : null;
}

export async function fetchProducts(): Promise<Product[]> {
  return (await fetchLiveProducts()) ?? mockProducts;
}

// Backend Collection rows (see backend/app/routers/collections.py). Only the
// fields the storefront actually needs -- id/seoDescription/productIds have
// no backend column (collections are seed-script-managed only, no admin UI
// yet), so adaptCollection below fills those with safe fallbacks rather than
// leaving fetchCollectionBySlug callers to handle a third, partial shape.
interface BackendCollection {
  slug: string;
  name: string;
  description: string | null;
  hero_image: string | null;
}

function adaptCollection(c: BackendCollection): Collection {
  return {
    id: c.slug,
    slug: c.slug,
    name: c.name,
    description: c.description ?? "",
    seoDescription: c.description ?? "",
    heroImage: c.hero_image ?? "",
    productIds: [],
  };
}

// Same live-first, mock-fallback pattern as fetchProducts: the backend's
// Collection table (name/description/hero image) has a real, working read
// API, but nothing previously called it -- the storefront always rendered
// the bundled mock collections regardless of what was live. Falls back to
// mock on any failure (unreachable backend, or a slug that only exists in
// the bundled catalog and was never migrated to the backend's seed data).
export async function fetchCollections(): Promise<Collection[]> {
  const data = await fetchJson<BackendCollection[]>("/api/collections");
  return Array.isArray(data) ? data.map(adaptCollection) : mockCollections;
}

export async function fetchCollectionBySlug(slug: string): Promise<Collection | undefined> {
  const data = await fetchJson<BackendCollection>(`/api/collections/${encodeURIComponent(slug)}`);
  return data ? adaptCollection(data) : getMockCollectionBySlug(slug);
}

export async function fetchProductsByCollectionSlug(slug: string): Promise<Product[]> {
  const live = await fetchLiveProducts();
  if (live) return live.filter((product) => product.collectionSlugs.includes(slug));
  return getMockProductsByCollectionSlug(slug);
}

/** Admin-editable overrides for the hero banner + announcement ribbon. Every
 * field is null when the admin hasn't set an override — callers fall back
 * to their content/site.config.ts default per-field, not all-or-nothing. */
export interface HomepageContentOverride {
  announcement_enabled: boolean | null;
  announcement_messages: string[] | null;
  hero_accent_word: string | null;
  hero_headline: string | null;
  hero_subline: string | null;
  hero_cta_label: string | null;
  hero_cta_href: string | null;
  hero_image: string | null;
  hero_image_alt: string | null;
  quick_ctas: { label: string; href: string; image: string }[] | null;
  new_in_heading: string | null;
  new_in_sub: string | null;
  campaign_eyebrow: string | null;
  campaign_title_italic: string | null;
  campaign_title: string | null;
  campaign_copy: string | null;
  campaign_cta_label: string | null;
  campaign_cta_href: string | null;
  campaign_image: string | null;
  campaign_image_alt: string | null;
  editorial_tiles: { eyebrow: string; title: string; copy: string; href: string; image: string; imageAlt: string }[] | null;
  seo_brand_story: string | null;
  seo_categories: { title: string; copy: string; href: string }[] | null;
  seo_faqs: { q: string; a: string }[] | null;
}

// cache() dedupes this to exactly one backend call per request, regardless
// of how many homepage sections (HeroBanner, QuickCtaRow, CampaignBand,
// EditorialTiles, SeoContentBlock, layout.tsx's announcement, page.tsx's
// New In heading) each independently call it — previously 7 real round-trips
// per page view (measured live), now 1. revalidate: 30s means an admin
// content edit takes up to 30s to appear instead of instantly, in exchange
// for every other page load being served from Next's cache.
export const fetchHomepageContent = cache(
  async (): Promise<HomepageContentOverride | null> => fetchJson<HomepageContentOverride>("/api/sections", 30),
);

/**
 * The whole content document, as the backend now owns it.
 *
 * `GET /api/content/site` returns everything a storefront needs to render --
 * brand, navigation, footer, policy copy, homepage content, SEO defaults --
 * rather than the thin layer of homepage overrides `fetchHomepageContent`
 * reads. That difference is the point: a second storefront can be written
 * against this and never needs a copy of `content/site.config.ts`.
 *
 * This storefront has not moved over yet. Its components still merge
 * `fetchHomepageContent()` over the bundled config, which works and is not
 * worth breaking to prove an architectural point; migrating them is follow-on
 * work. `site.config.ts` remains the offline fallback for when the API is
 * unreachable, which is exactly the role it should end up in.
 *
 * Shaped loosely on purpose. The document is content, and pinning a type to
 * every nested field here would mean editing the frontend every time the shop
 * adds an FAQ — the coupling this whole change exists to remove.
 */
export interface SiteContentDocument {
  key: string;
  version: number;
  updated_at: string | null;
  document: Record<string, unknown>;
}

export const fetchSiteContent = cache(
  async (): Promise<SiteContentDocument | null> =>
    fetchJson<SiteContentDocument>("/api/content/site", 30),
);
