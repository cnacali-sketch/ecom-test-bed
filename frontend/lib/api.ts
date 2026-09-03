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

// Collections (nav/marketing metadata: name, hero image, SEO copy) aren't
// modeled in the backend in Phase 1 — this intentionally stays on mock data.
export async function fetchCollections(): Promise<Collection[]> {
  return mockCollections;
}

export async function fetchCollectionBySlug(slug: string): Promise<Collection | undefined> {
  return getMockCollectionBySlug(slug);
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
