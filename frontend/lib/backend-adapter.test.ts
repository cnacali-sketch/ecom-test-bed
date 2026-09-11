import { describe, expect, test } from "vitest";

import { adaptProduct, type BackendProduct } from "./backend-adapter";

function makeBackendProduct(overrides: Partial<BackendProduct> = {}): BackendProduct {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    sku: "prod-test-01",
    slug: "test-product",
    name: "Test Product",
    price: "100.00",
    mrp: "150.00",
    in_stock: true,
    description: "A test product.",
    images: ["https://example.com/a.jpg", "https://example.com/b.jpg"],
    attrs: {
      brand: "Savvy",
      type: "Tote",
      material: "Canvas",
      careInstructions: "Wipe clean.",
      measurements: "10x10",
      shippingInfo: "Ships fast.",
      currency: "INR",
      collectionSlugs: ["bags"],
      isNew: true,
      isSale: false,
      tags: ["new-in"],
    },
    variants: [],
    ...overrides,
  };
}

describe("adaptProduct", () => {
  test("maps a fully-populated backend product to the frontend Product shape", () => {
    const result = adaptProduct(makeBackendProduct());

    expect(result).toMatchObject({
      // id must be the backend UUID, not the SKU — see the comment on
      // adaptProduct: checkout sends this straight through as
      // OrderItemCreate.product_id, which the backend requires to be a
      // valid UUID.
      id: "11111111-1111-1111-1111-111111111111",
      slug: "test-product",
      name: "Test Product",
      brand: "Savvy",
      type: "Tote",
      material: "Canvas",
      description: "A test product.",
      careInstructions: "Wipe clean.",
      measurements: "10x10",
      shippingInfo: "Ships fast.",
      price: 100,
      mrp: 150,
      currency: "INR",
      collectionSlugs: ["bags"],
      isNew: true,
      isSale: false,
      inStock: true,
      tags: ["new-in"],
    });
    expect(result.images).toEqual([
      { url: "https://example.com/a.jpg", alt: "Test Product image 1" },
      { url: "https://example.com/b.jpg", alt: "Test Product image 2" },
    ]);
  });

  test("falls back to safe defaults when attrs is missing expected fields", () => {
    const result = adaptProduct(makeBackendProduct({ attrs: {}, description: null, in_stock: false }));

    expect(result.slug).toBe("test-product");
    expect(result.brand).toBe("");
    expect(result.description).toBe("");
    expect(result.currency).toBe("INR");
    expect(result.collectionSlugs).toEqual([]);
    expect(result.tags).toEqual([]);
    expect(result.isNew).toBe(false);
    expect(result.isSale).toBe(false);
    expect(result.inStock).toBe(false);
  });

  test("maps variants from their top-level backend fields", () => {
    const result = adaptProduct(
      makeBackendProduct({
        variants: [
          {
            id: "22222222-2222-2222-2222-222222222222",
            sku: "VAR-01",
            color: "Red",
            color_hex: "#ff0000",
            image: "https://example.com/red.jpg",
            in_stock: false,
          },
          {
            id: "33333333-3333-3333-3333-333333333333",
            sku: "VAR-02",
            color: "Blue",
            color_hex: "#0000ff",
            image: null,
            in_stock: true,
          },
        ],
      }),
    );

    expect(result.variants).toEqual([
      {
        id: "22222222-2222-2222-2222-222222222222",
        color: "Red",
        colorHex: "#ff0000",
        size: undefined,
        sku: "VAR-01",
        image: "https://example.com/red.jpg",
        inStock: false,
      },
      {
        id: "33333333-3333-3333-3333-333333333333",
        color: "Blue",
        colorHex: "#0000ff",
        size: undefined,
        sku: "VAR-02",
        image: "",
        inStock: true,
      },
    ]);
  });

  describe("card display toggles", () => {
    test("shows every row when attrs carries no toggles", () => {
      // The whole seeded catalogue predates these toggles. If a missing
      // attrs.show hid anything, saving nothing would blank live product cards.
      expect(adaptProduct(makeBackendProduct()).show).toEqual({
        name: true,
        category: true,
        price: true,
        mrp: true,
        dims: true,
      });
    });

    test("carries the toggles the admin actually saved", () => {
      const product = makeBackendProduct({
        attrs: { ...makeBackendProduct().attrs, show: { price: false, mrp: false } },
      });
      const { show } = adaptProduct(product);

      expect(show).toEqual({
        name: true,
        category: true,
        price: false,
        mrp: false,
        dims: true,
      });
    });

    test("ignores non-boolean and unknown keys instead of hiding rows", () => {
      const product = makeBackendProduct({
        attrs: {
          ...makeBackendProduct().attrs,
          show: { name: "no", price: 0, nonsense: true, dims: false },
        },
      });

      // "no" and 0 are not booleans, so they must not read as "hide".
      expect(adaptProduct(product).show).toEqual({
        name: true,
        category: true,
        price: true,
        mrp: true,
        dims: false,
      });
    });

    test("falls back to showing everything when attrs.show is the wrong type", () => {
      for (const value of [null, "all", 1, []]) {
        const product = makeBackendProduct({
          attrs: { ...makeBackendProduct().attrs, show: value },
        });
        expect(adaptProduct(product).show?.price).toBe(true);
      }
    });
  });
});
