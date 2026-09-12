import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { fetchCollectionBySlug, fetchCollections, fetchProducts, fetchProductSearch, fetchProductsByCollectionSlug, fetchSiteContent } from "./api";
import type { BackendProduct } from "./backend-adapter";
import { collections as mockCollections, getCollectionBySlug as getMockCollectionBySlug, products as mockProducts } from "./mock-data";

function backendProduct(overrides: Partial<BackendProduct> = {}): BackendProduct {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    sku: "live-sku-01",
    slug: "live-product",
    name: "Live Product",
    price: "500.00",
    mrp: "600.00",
    in_stock: true,
    description: "Fetched from the live backend.",
    images: ["https://example.com/live.jpg"],
    attrs: { collectionSlugs: ["hair-accessories"] },
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
    // Backend is opt-in: these tests exercise the live-backend path.
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test("maps a live 200 response through the adapter", async () => {
    mockFetchOnce({ ok: true, json: () => Promise.resolve([backendProduct()]) });

    const result = await fetchProducts();

    expect(result).toHaveLength(1);
    // id is the backend UUID (adaptProduct's contract), not the SKU.
    expect(result[0]).toMatchObject({ id: "11111111-1111-1111-1111-111111111111", slug: "live-product" });
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
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test("filters the live catalog by collectionSlugs when the backend is reachable", async () => {
    mockFetchOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          backendProduct({
            id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            sku: "in-bags",
            attrs: { collectionSlugs: ["hair-accessories"] },
          }),
          backendProduct({
            id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            sku: "in-jewellery",
            attrs: { collectionSlugs: ["jewellery"] },
          }),
        ]),
    });

    const result = await fetchProductsByCollectionSlug("hair-accessories");

    // id is the backend UUID (adaptProduct's contract), not the SKU.
    expect(result.map((p) => p.id)).toEqual(["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"]);
  });

  test("falls back to mock filtering when the backend is unreachable", async () => {
    mockFetchOnce(null);

    const result = await fetchProductsByCollectionSlug("hair-accessories");

    expect(result.every((p) => p.collectionSlugs.includes("hair-accessories"))).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("fetchCollections", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test("maps a live 200 response through adaptCollection", async () => {
    mockFetchOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          { slug: "live-collection", name: "Live Collection", description: "From the backend.", hero_image: "https://example.com/hero.jpg" },
        ]),
    });

    const result = await fetchCollections();

    expect(result).toEqual([
      {
        id: "live-collection",
        slug: "live-collection",
        name: "Live Collection",
        description: "From the backend.",
        seoDescription: "From the backend.",
        heroImage: "https://example.com/hero.jpg",
        productIds: [],
      },
    ]);
  });

  test("falls back to mock data when the backend is unreachable", async () => {
    mockFetchOnce(null);

    const result = await fetchCollections();

    expect(result).toBe(mockCollections);
  });
});

describe("fetchCollectionBySlug", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test("maps a live 200 response through adaptCollection", async () => {
    mockFetchOnce({
      ok: true,
      json: () =>
        Promise.resolve({ slug: "hair-accessories", name: "Hair Accessories", description: null, hero_image: null }),
    });

    const result = await fetchCollectionBySlug("hair-accessories");

    expect(result).toMatchObject({ slug: "hair-accessories", name: "Hair Accessories", description: "", heroImage: "" });
  });

  test("falls back to mock data on a 404 (slug not seeded in the backend yet)", async () => {
    mockFetchOnce({ ok: false });

    const result = await fetchCollectionBySlug("hair-accessories");

    expect(result).toEqual(getMockCollectionBySlug("hair-accessories"));
  });
});

describe("fetchSiteContent", () => {
  /**
   * The call a second storefront would be built on. It has to return the whole
   * document -- brand, nav, footer, policies, homepage -- because anything it
   * leaves out is something that frontend would have to get by copying
   * content/site.config.ts, which is the coupling this endpoint removes.
   */
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test("returns the document a storefront renders from", async () => {
    mockFetchOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          key: "site",
          version: 3,
          updated_at: "2026-09-12T10:00:00Z",
          document: { brand: { name: "Savvy In Teal" }, nav: [{ label: "New In" }] },
        }),
    });

    const content = await fetchSiteContent();

    expect(content?.version).toBe(3);
    expect(content?.document.brand).toEqual({ name: "Savvy In Teal" });
  });

  test("returns null rather than throwing when the backend is unreachable", async () => {
    /** Every other call in this module falls back instead of crashing the
     * render, and content is the one a page cannot even partially draw
     * without -- so it has to fail the same quiet way. */
    mockFetchOnce(null);

    expect(await fetchSiteContent()).toBeNull();
  });

  test("returns null when the backend is not configured at all", async () => {
    vi.unstubAllEnvs();

    expect(await fetchSiteContent()).toBeNull();
  });
});

describe("fetchProductSearch", () => {
  /**
   * Search moved from the browser to the database. What the caller has to be
   * able to tell apart is "the shop has nothing matching" from "the backend
   * could not answer" -- the first is a real result to render, the second has
   * to fall back to matching the bundled catalogue, or an unreachable API
   * turns every search into an empty shop.
   */
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test("sends the query to the server rather than filtering locally", async () => {
    const fetchMock = mockFetchOnce({ ok: true, json: () => Promise.resolve([]) });

    await fetchProductSearch("silk scrunchie");

    expect(String(fetchMock.mock.calls[0][0])).toContain("q=silk%20scrunchie");
  });

  test("maps results through the same adapter the catalogue uses", async () => {
    /** So a search result always resolves to a real product page. */
    mockFetchOnce({ ok: true, json: () => Promise.resolve([backendProduct()]) });

    const found = await fetchProductSearch("clip");

    expect(found?.[0].slug).toBe("live-product");
  });

  test("an empty result is a real answer, not a failure", async () => {
    mockFetchOnce({ ok: true, json: () => Promise.resolve([]) });

    expect(await fetchProductSearch("helicopter")).toEqual([]);
  });

  test("an unreachable backend returns null so the caller can fall back", async () => {
    /** null and [] must not be the same value here. Collapsing them would
     * make a backend outage indistinguishable from "no matches", and the
     * search page would show an empty shop instead of offline results. */
    mockFetchOnce(null);

    expect(await fetchProductSearch("clip")).toBeNull();
  });

  test("a blank query does not hit the network at all", async () => {
    const fetchMock = mockFetchOnce({ ok: true, json: () => Promise.resolve([]) });

    expect(await fetchProductSearch("   ")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("a query with characters that need escaping is encoded", async () => {
    const fetchMock = mockFetchOnce({ ok: true, json: () => Promise.resolve([]) });

    await fetchProductSearch("gold & silk");

    expect(String(fetchMock.mock.calls[0][0])).toContain("q=gold%20%26%20silk");
  });
});
