import { adaptProduct, type BackendProduct } from "./backend-adapter";
import {
  collections as mockCollections,
  getCollectionBySlug as getMockCollectionBySlug,
  getProductsByCollectionSlug as getMockProductsByCollectionSlug,
  products as mockProducts,
} from "./mock-data";
import type { Collection, Product } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const FETCH_TIMEOUT_MS = 3000;

/**
 * Small fetch wrapper around the FastAPI backend. The backend is being built
 * in parallel and may not be running yet, so every call falls back to the
 * bundled mock data on any failure (network error, timeout, non-2xx, bad
 * JSON) instead of throwing — pages must never hard-crash for this reason.
 */
async function fetchJson<T>(path: string): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
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
async function fetchLiveProducts(): Promise<Product[] | null> {
  const data = await fetchJson<BackendProduct[]>("/api/products");
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
