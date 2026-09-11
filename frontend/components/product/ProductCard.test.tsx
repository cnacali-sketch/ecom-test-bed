/** @vitest-environment jsdom */

/**
 * The first rendering tests in this codebase.
 *
 * ProductCard is the right place to start: it is the component every shopper
 * sees most, and it is where the admin's per-product display toggles finally
 * take effect. Those toggles were round-tripped and unit-tested at the adapter
 * level, but nothing proved the card actually obeys them — an owner could
 * switch a price off, watch the adapter store it, and still have the price on
 * the shop. That gap is exactly what these cover.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import type { Product } from "@/lib/types";
import { ProductCard } from "./ProductCard";

// next/image needs the Next runtime to optimise and measure; in a test it only
// has to be an <img>. Same for Link, which otherwise wants a router.
vi.mock("next/image", () => ({
  // A plain <img> on purpose — the LCP advice the lint rule gives is about
  // shipped pages, and this element never leaves the test renderer.
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/cart-context", () => ({
  useCart: () => ({
    items: [],
    addItem: vi.fn(),
    updateQuantity: vi.fn(),
    removeItem: vi.fn(),
  }),
}));
vi.mock("@/lib/wishlist-context", () => ({
  useWishlist: () => ({ isWished: () => false, toggleWish: vi.fn() }),
}));

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    slug: "tortoise-grip-claw-clip",
    name: "Tortoise Grip Claw Clip",
    brand: "Savvy In Teal",
    type: "Claw Clip",
    material: "Cellulose acetate",
    description: "A sturdy claw clip.",
    careInstructions: "Wipe clean.",
    measurements: "9 × 4 × 2 cm",
    shippingInfo: "Ships in 24h",
    price: 499,
    mrp: 699,
    currency: "INR",
    images: [
      { url: "/media/one.webp", alt: "front" },
      { url: "/media/two.webp", alt: "back" },
    ],
    variants: [
      { id: "v1", color: "Teal", colorHex: "#0d9488", sku: "SIT-1-T", image: "", inStock: true },
    ],
    collectionSlugs: ["hair-accessories"],
    isNew: false,
    isSale: true,
    inStock: true,
    tags: ["tortoise"],
    ...overrides,
  };
}

describe("ProductCard", () => {
  test("renders the product a shopper would recognise", () => {
    render(<ProductCard product={makeProduct()} />);

    expect(screen.getByRole("heading", { name: "Tortoise Grip Claw Clip" })).toBeInTheDocument();
    expect(screen.getByText("Claw Clip")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeEnabled();
  });

  test("links to its own product page", () => {
    render(<ProductCard product={makeProduct()} />);

    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/products/tortoise-grip-claw-clip");
    }
  });

  test("a sold-out product cannot be added to the cart", () => {
    render(<ProductCard product={makeProduct({ inStock: false })} />);

    // Two separate signals, because either one alone has shipped broken before:
    // the overlay tells the eye, the disabled button stops the click.
    expect(screen.getByText("Sold Out")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sold out" })).toBeDisabled();
  });

  describe("admin display toggles", () => {
    test("shows everything when the product carries no toggles", () => {
      // The entire seeded catalogue predates these, so absent must mean show.
      render(<ProductCard product={makeProduct()} />);

      expect(screen.getByText("Tortoise Grip Claw Clip")).toBeInTheDocument();
      expect(screen.getByText("Claw Clip")).toBeInTheDocument();
      expect(screen.getByText("₹499")).toBeInTheDocument();
      expect(screen.getByText("₹699")).toBeInTheDocument();
    });

    test("hiding the price replaces it with Price on request", () => {
      const product = makeProduct({
        show: { name: true, category: true, price: false, mrp: true, dims: true },
      });

      render(<ProductCard product={product} />);

      expect(screen.getByText("Price on request")).toBeInTheDocument();
      expect(screen.queryByText("₹499")).not.toBeInTheDocument();
    });

    test("hiding the price also removes the discount flash", () => {
      // A "29% off" badge over a card with no price advertises a discount off
      // nothing. ProductCardPreview makes the same call, so the admin's preview
      // and the real card agree.
      const product = makeProduct({
        show: { name: true, category: true, price: false, mrp: true, dims: true },
      });

      render(<ProductCard product={product} />);

      expect(screen.queryByText(/% off/)).not.toBeInTheDocument();
    });

    test("hiding the M.R.P. keeps the selling price", () => {
      const product = makeProduct({
        show: { name: true, category: true, price: true, mrp: false, dims: true },
      });

      render(<ProductCard product={product} />);

      expect(screen.getByText("₹499")).toBeInTheDocument();
      expect(screen.queryByText("₹699")).not.toBeInTheDocument();
    });

    test("hiding the category removes the eyebrow", () => {
      const product = makeProduct({
        show: { name: true, category: false, price: true, mrp: true, dims: true },
      });

      render(<ProductCard product={product} />);

      expect(screen.queryByText("Claw Clip")).not.toBeInTheDocument();
      expect(screen.getByText("Tortoise Grip Claw Clip")).toBeInTheDocument();
    });

    test("hiding the name still announces the real one to a screen reader", () => {
      const product = makeProduct({
        show: { name: false, category: true, price: true, mrp: true, dims: true },
      });

      render(<ProductCard product={product} />);

      expect(screen.getByText("New arrival")).toBeInTheDocument();
      // Without the aria-label every card in a grid would announce as
      // "New arrival", making them indistinguishable without sight.
      expect(
        screen.getByRole("link", { name: "Tortoise Grip Claw Clip" }),
      ).toBeInTheDocument();
    });

    test("dimensions show as a Size row, and only when turned on", () => {
      const shown = makeProduct({
        show: { name: true, category: true, price: true, mrp: true, dims: true },
      });
      const { unmount } = render(<ProductCard product={shown} />);
      expect(screen.getByText(/Size: 9 × 4 × 2 cm/)).toBeInTheDocument();
      unmount();

      const hidden = makeProduct({
        show: { name: true, category: true, price: true, mrp: true, dims: false },
      });
      render(<ProductCard product={hidden} />);
      expect(screen.queryByText(/Size:/)).not.toBeInTheDocument();
    });

    test("no Size row when the product has no measurements", () => {
      const product = makeProduct({
        measurements: "",
        show: { name: true, category: true, price: true, mrp: true, dims: true },
      });

      render(<ProductCard product={product} />);

      expect(screen.queryByText(/Size:/)).not.toBeInTheDocument();
    });
  });

  describe("stock messaging", () => {
    test("exact mode shows the real count", () => {
      render(<ProductCard product={makeProduct({ stockMode: "exact", stock: 7 })} />);
      expect(screen.getByText("7 in stock")).toBeInTheDocument();
    });

    test("lowOnly mode warns only when stock is actually low", () => {
      const { unmount } = render(
        <ProductCard product={makeProduct({ stockMode: "lowOnly", stock: 2 })} />,
      );
      expect(screen.getByText("Only 2 left")).toBeInTheDocument();
      unmount();

      render(<ProductCard product={makeProduct({ stockMode: "lowOnly", stock: 40 })} />);
      expect(screen.getByText("In stock")).toBeInTheDocument();
      expect(screen.queryByText(/Only \d+ left/)).not.toBeInTheDocument();
    });

    test("hidden mode says nothing about inventory", () => {
      render(<ProductCard product={makeProduct({ stockMode: "hidden", stock: 3 })} />);
      expect(screen.queryByText(/in stock/i)).not.toBeInTheDocument();
    });
  });
});
