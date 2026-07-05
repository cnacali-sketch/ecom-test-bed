import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { fetchProducts, fetchProductsByCollectionSlug } from "./api";
import type { BackendProduct } from "./backend-adapter";
import { products as mockProducts } from "./mock-data";

function backendProduct(overrides: Partial<BackendProduct> = {}): BackendProduct {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    sku: "live-sku-01",
    name: "Live Product",
    price: 500,
    mrp: 600,
    description: "Fetched from the live backend.",
    images: ["https://example.com/live.jpg"],
    attrs: { slug: "live-product", collectionSlugs: ["bags"] },
    variants: [],
    ...overrides,
  };
}

function mockFetchOnce(response: { ok: boolean; json?: () => unknown } | null) {
  const fetchMock = vi.fn();
  if (response === null) {
    fetchMock.mockRejectedValue(new Error("network error"));
  } else {
    fetchMock.mockResolvedValue({
      ok: response.ok,
      json: response.json ?? (() => Promise.resolve(null)),
    });
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("fetchProducts", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("maps a live 200 response through the adapter", async () => {
    mockFetchOnce({ ok: true, json: () => Promise.resolve([backendProduct()]) });

    const result = await fetchProducts();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "live-sku-01", slug: "live-product" });
  });

  test("a live 200 response with an empty array returns [] rather than falling back to mock", async () => {
    mockFetchOnce({ ok: true, json: () => Promise.resolve([]) });

    const result = await fetchProducts();

    expect(result).toEqual([]);
  });

  test("falls back to mock data on a network error", async () => {
    mockFetchOnce(null);

    const result = await fetchProducts();

    expect(result).toBe(mockProducts);
  });

  test("falls back to mock data on a non-2xx response", async () => {
    mockFetchOnce({ ok: false });

    const result = await fetchProducts();

    expect(result).toBe(mockProducts);
  });

  test("falls back to mock data when the backend returns a 200 with an unexpected (non-array) shape", async () => {
    mockFetchOnce({ ok: true, json: () => Promise.resolve({ error: "boom" }) });

    const result = await fetchProducts();

    expect(result).toBe(mockProducts);
  });
});

describe("fetchProductsByCollectionSlug", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("filters the live catalog by collectionSlugs when the backend is reachable", async () => {
    mockFetchOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          backendProduct({ sku: "in-bags", attrs: { collectionSlugs: ["bags"] } }),
          backendProduct({ sku: "in-jewellery", attrs: { collectionSlugs: ["jewellery"] } }),
        ]),
    });

    const result = await fetchProductsByCollectionSlug("bags");

    expect(result.map((p) => p.id)).toEqual(["in-bags"]);
  });

  test("falls back to mock filtering when the backend is unreachable", async () => {
    mockFetchOnce(null);

    const result = await fetchProductsByCollectionSlug("bags");

    expect(result.every((p) => p.collectionSlugs.includes("bags"))).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});
