import { describe, expect, test } from "vitest";

import type { BackendProduct } from "@/lib/backend-adapter";
import type { AdminProduct } from "./types";
import { toAdmin, toBackendPayload } from "./adapt";

/**
 * A product shaped the way the seeded catalogue really is: several images,
 * membership of more than one collection, and merchandising fields the admin
 * screens never render.
 */
function backendProduct(overrides: Partial<BackendProduct> = {}): BackendProduct {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    sku: "SIT-CLIP-001",
    slug: "tortoise-grip-claw-clip",
    name: "Tortoise Grip Claw Clip",
    price: "499.00",
    mrp: "699.00",
    in_stock: true,
    description: "A sturdy claw clip.",
    images: ["/media/one.webp", "/media/two.webp", "/media/three.webp"],
    attrs: {
      type: "Claw Clip",
      brand: "Savvy In Teal",
      material: "Cellulose acetate",
      tags: ["tortoise", "grip"],
      collectionSlugs: ["hair-accessories", "charms"],
      stock: 12,
      stockMode: "exact",
    },
    variants: [],
    ...overrides,
  };
}

/** The attrs an admin save sends back for an untouched product. */
function savedAttrs(product: BackendProduct): Record<string, unknown> {
  return draftAttrs(toAdmin(product));
}

/** The attrs an admin save sends back for an edited draft. */
function draftAttrs(draft: AdminProduct): Record<string, unknown> {
  return toBackendPayload(draft).attrs as Record<string, unknown>;
}

describe("admin product round-trip", () => {
  test("keeps every image, not just the first", () => {
    const product = backendProduct();
    const saved = toBackendPayload(toAdmin(product));
    // Editing any field in the admin used to drop images 2..n on the floor,
    // because toAdmin read only images[0] and toBackendPayload wrote [image].
    expect(saved.images).toEqual(product.images);
  });

  test("keeps the product in the collections it was already in", () => {
    const product = backendProduct();
    // The bug: collectionSlugs was rebuilt from the category text, so this
    // product left hair-accessories and charms and joined "claw-clip" — a
    // collection that does not exist, removing it from every collection page.
    expect(savedAttrs(product).collectionSlugs).toEqual(["hair-accessories", "charms"]);
  });

  test("derives a collection from the category only for a brand-new product", () => {
    const product = backendProduct({ attrs: { type: "Claw Clip" } });
    expect(savedAttrs(product).collectionSlugs).toEqual(["claw-clip"]);
  });

  test("slugifies a derived collection properly", () => {
    // "claw " (trailing space, as typed in the admin) produced "claw-" before,
    // because the derivation only collapsed whitespace and never trimmed.
    const product = backendProduct({ attrs: { type: "claw " } });
    expect(savedAttrs(product).collectionSlugs).toEqual(["claw"]);
  });

  test("a new image chosen in the admin becomes the primary one", () => {
    const product = backendProduct();
    const draft = { ...toAdmin(product), image: "/media/new-hero.webp" };
    const saved = toBackendPayload(draft) as { images: string[] };
    expect(saved.images[0]).toBe("/media/new-hero.webp");
    // and the rest are still there, behind it
    expect(saved.images).toContain("/media/two.webp");
    expect(saved.images).toContain("/media/three.webp");
  });

  test("removing the primary image does not resurrect it", () => {
    const product = backendProduct();
    const draft = { ...toAdmin(product), image: "" };
    const saved = toBackendPayload(draft) as { images: string[] };
    expect(saved.images).not.toContain("/media/one.webp");
    expect(saved.images).toEqual(["/media/two.webp", "/media/three.webp"]);
  });

  test("persists the card display toggles", () => {
    const product = backendProduct();
    const draft = { ...toAdmin(product), show: { ...toAdmin(product).show, mrp: false } };
    const saved = draftAttrs(draft);
    // These toggles used to live only in component state, so every one of them
    // silently reset on reload and never reached the storefront at all.
    expect((saved.show as { mrp: boolean }).mrp).toBe(false);
    expect(toAdmin({ ...product, attrs: { ...product.attrs, show: saved.show } }).show.mrp).toBe(false);
  });

  test("persists dimensions and publishes them as measurements", () => {
    const product = backendProduct();
    const draft = { ...toAdmin(product), dims: { h: "9", w: "4", l: "2", unit: "cm" as const } };
    const saved = draftAttrs(draft);
    expect(saved.dims).toEqual({ h: "9", w: "4", l: "2", unit: "cm" });
    // The PDP renders attrs.measurements (ProductDetail.tsx:95), which the
    // admin previously had no way to write.
    expect(saved.measurements).toBe("9 × 4 × 2 cm");
    expect(toAdmin({ ...product, attrs: { ...product.attrs, dims: saved.dims } }).dims.h).toBe("9");
  });

  test("leaves an existing measurements string alone when dims are blank", () => {
    const product = backendProduct({
      attrs: { ...backendProduct().attrs, measurements: "9cm long, hand-measured" },
    });
    const saved = savedAttrs(product);
    // Omitting the key lets the backend's attrs merge keep what is already
    // there — verified against the live API, not assumed.
    expect("measurements" in saved).toBe(false);
  });

  test("carries slug and sku through unchanged", () => {
    const product = backendProduct();
    const saved = toBackendPayload(toAdmin(product));
    expect(saved.slug).toBe("tortoise-grip-claw-clip");
    expect(saved.sku).toBe("SIT-CLIP-001");
  });
});

describe("variants", () => {
  /**
   * The console posted `variants: []` on every save for its whole life,
   * because it had no variant editor. Fifty variants in production survived
   * only because the API ignored the field. Now that it does not, this mapping
   * is the thing standing between a price edit and fifty deleted rows.
   */
  const withVariants = (): BackendProduct =>
    backendProduct({
      variants: [
        {
          id: "v1",
          sku: "SIT-CLIP-TOR",
          color: "Tortoise",
          color_hex: "#6b4423",
          image: "/media/tortoise.webp",
          in_stock: true,
        },
        {
          id: "v2",
          sku: "SIT-CLIP-GLD",
          color: "Gold",
          color_hex: "#d4af37",
          image: null,
          in_stock: false,
          size: "Large",
          price: "650.00",
          mrp: "800.00",
          stock_quantity: 4,
        },
      ],
    });

  test("a product's variants survive the round trip", () => {
    const payload = toBackendPayload(toAdmin(withVariants()));

    expect(payload.variants).toEqual([
      {
        sku: "SIT-CLIP-TOR",
        color: "Tortoise",
        color_hex: "#6b4423",
        image: "/media/tortoise.webp",
        in_stock: true,
        size: null,
        price: null,
        mrp: null,
        stock_quantity: null,
      },
      {
        sku: "SIT-CLIP-GLD",
        color: "Gold",
        color_hex: "#d4af37",
        image: null,
        in_stock: false,
        size: "Large",
        price: 650,
        mrp: 800,
        stock_quantity: 4,
      },
    ]);
  });

  test("a save no longer sends an empty list for a product that has variants", () => {
    /** The specific regression: `variants: []` used to be hardcoded here, and
     * it is the payload that would delete all fifty if the API read an empty
     * list as "these are all of them". */
    const payload = toBackendPayload(toAdmin(withVariants()));

    expect(payload.variants).toHaveLength(2);
  });

  test("an unset price stays unset rather than becoming zero", () => {
    /** Null means "use the product's price". Zero would mean the variant is
     * free, and a rounding of absent to 0 here would put the whole catalogue
     * on sale for nothing. */
    const admin = toAdmin(withVariants());

    expect(admin.variants[0].price).toBe("");
    expect(admin.variants[0].stockQuantity).toBe("");
    expect((toBackendPayload(admin).variants as unknown[])[0]).toMatchObject({
      price: null,
      stock_quantity: null,
    });
  });

  test("a variant with no image round-trips as null, not as an empty string", () => {
    /** The API's column is nullable; "" would be a real value meaning "this
     * variant has an image whose URL is blank". */
    const payload = toBackendPayload(toAdmin(withVariants()));

    expect((payload.variants as { image: unknown }[])[1].image).toBeNull();
  });

  test("a product with no variants maps to an empty list", () => {
    const payload = toBackendPayload(toAdmin(backendProduct({ variants: [] })));

    expect(payload.variants).toEqual([]);
  });

  test("a zero quantity is kept, because sold out is a fact", () => {
    /** The classic falsy bug in the other direction: 0 must not be flattened
     * back to "not counted". */
    const admin = toAdmin(
      backendProduct({
        variants: [
          {
            id: "v1",
            sku: "S",
            color: "C",
            color_hex: "#000",
            image: null,
            in_stock: false,
            stock_quantity: 0,
          },
        ],
      }),
    );

    expect(admin.variants[0].stockQuantity).toBe(0);
    expect((toBackendPayload(admin).variants as { stock_quantity: unknown }[])[0].stock_quantity).toBe(0);
  });
});
