import { describe, expect, test } from "vitest";

import { searchProducts } from "./search";
import type { Product } from "./types";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    slug: "test-product",
    name: "Test Product",
    brand: "Savvy",
    type: "Clip",
    material: "Acetate",
    description: "",
    careInstructions: "",
    measurements: "",
    shippingInfo: "",
    price: 499,
    mrp: 599,
    currency: "INR",
    images: [{ url: "https://example.com/a.jpg", alt: "a" }],
    variants: [],
    collectionSlugs: [],
    isNew: false,
    isSale: false,
    inStock: true,
    tags: [],
    ...overrides,
  };
}

describe("searchProducts", () => {
  test("matches terms in any order, not as one contiguous substring", () => {
    // The bug this came from: the product is named "... Rs 1", so a
    // single includes("1 rs") never matched and searching "1 rs" for the
    // Rs 1 test product returned nothing.
    const catalog = [makeProduct({ name: "TEST Payment Verification Rs 1" })];

    expect(searchProducts(catalog, "1 rs")).toHaveLength(1);
    expect(searchProducts(catalog, "rs 1")).toHaveLength(1);
    expect(searchProducts(catalog, "test 1")).toHaveLength(1);
  });

  test("requires every term to match, not any", () => {
    const catalog = [makeProduct({ name: "Silk Scrunchie", type: "Scrunchie", material: "Silk" })];

    expect(searchProducts(catalog, "silk scrunchie")).toHaveLength(1);
    expect(searchProducts(catalog, "silk hoops")).toHaveLength(0);
  });

  test("returns a product with no images without throwing", () => {
    // Live products can have images: [] (all three TEST payment products do).
    // The overlay indexed images[0].url blindly, which threw once search
    // started reading live data instead of the bundled catalogue.
    const catalog = [makeProduct({ name: "No Image Product", images: [] })];

    const results = searchProducts(catalog, "no image");

    expect(results).toHaveLength(1);
    expect(results[0].images).toEqual([]);
  });

  test("searches name, type, material, description and tags", () => {
    const catalog = [
      makeProduct({ id: "a", name: "Alpha", type: "Barrette" }),
      makeProduct({ id: "b", name: "Beta", material: "Tortoiseshell" }),
      makeProduct({ id: "c", name: "Gamma", tags: ["bridal"] }),
      makeProduct({ id: "d", name: "Delta", description: "Handmade in Jaipur." }),
    ];

    expect(searchProducts(catalog, "barrette").map((p) => p.id)).toEqual(["a"]);
    expect(searchProducts(catalog, "tortoiseshell").map((p) => p.id)).toEqual(["b"]);
    expect(searchProducts(catalog, "bridal").map((p) => p.id)).toEqual(["c"]);
    expect(searchProducts(catalog, "jaipur").map((p) => p.id)).toEqual(["d"]);
  });

  test("returns nothing below the minimum query length", () => {
    const catalog = [makeProduct({ name: "Alpha" })];

    expect(searchProducts(catalog, "a")).toEqual([]);
    expect(searchProducts(catalog, "  ")).toEqual([]);
  });

  test("is case-insensitive and ignores surrounding whitespace", () => {
    const catalog = [makeProduct({ name: "Silk Scrunchie" })];

    expect(searchProducts(catalog, "  SILK  ")).toHaveLength(1);
  });
});
