"use client";

import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/content/site.config";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/format";
import { trackEvent } from "@/lib/analytics";
import type { Product } from "@/lib/types";

interface SpecimenRangesProps {
  products: Product[];
}

/**
 * "Specimen range" showcase (SECTION 2 of the now-removed design
 * prototype's home.html): a dark
 * arch-radius card with a giant italic word + spec line, two CTAs, a pair of
 * preview images, and a badge + caption underneath. One of the genuinely new
 * component types this redesign introduces — the config only supplies
 * editorial copy (word/badge/caption/productId); name, type, material,
 * price and images are read live from the matching catalog product so the
 * price line can never drift out of sync with the real product record.
 */
export function SpecimenRanges({ products }: SpecimenRangesProps) {
  const { addItem } = useCart();
  const { specimenSectionEyebrow, specimenSectionSub, specimenRanges, specimenExploreLabel } =
    siteConfig.home;

  const ranges = specimenRanges
    .map((range) => ({ range, product: products.find((product) => product.id === range.productId) }))
    .filter((entry): entry is { range: (typeof specimenRanges)[number]; product: Product } => Boolean(entry.product));

  const handleAddToCart = (product: Product) => {
    const variant = product.variants[0];
    if (!variant || !variant.inStock || !product.inStock) return;
    addItem({
      productId: product.id,
      variantId: variant.id,
      name: product.name,
      image: variant.image,
      color: variant.color,
      price: product.price,
      currency: product.currency,
      quantity: 1,
    });
    trackEvent("add_to_cart", { product_id: product.id });
  };

  if (ranges.length === 0) return null;

  return (
    <section className="py-[var(--section)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-[46ch] text-center">
          <h2 className="text-[18px] uppercase leading-[2] tracking-[0.02em] text-ink">{specimenSectionEyebrow}</h2>
          <p className="mt-2.5 text-[15px] leading-[1.67] text-ink-soft">{specimenSectionSub}</p>
        </div>

        <div className="mt-14 flex flex-col gap-14">
          {ranges.map(({ range, product }) => {
            const [previewA, previewB] = product.images;
            const canAdd = product.variants[0]?.inStock && product.inStock;
            return (
              <article key={range.productId}>
                <div className="rounded-[min(var(--r-arch),50vw)] bg-specimen px-6 py-16 text-center text-white sm:px-10 sm:py-[88px]">
                  <p className="font-display m-0 text-[clamp(40px,9vw,120px)] font-light italic leading-[0.9] tracking-tight text-white">
                    {range.word}
                  </p>
                  <p className="mt-5 text-[13px] uppercase tracking-[0.18em] text-white/62">
                    {product.type} · {product.material} · {formatPrice(product.price, product.currency)}
                  </p>
                  <div className="mt-8 flex flex-wrap justify-center gap-2.5">
                    <Link
                      href={range.exploreHref}
                      className="rounded-full border border-white px-6 py-2.5 text-[13px] text-white transition-colors hover:bg-white hover:text-specimen"
                    >
                      {specimenExploreLabel}
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleAddToCart(product)}
                      disabled={!canAdd}
                      className="rounded-full border border-acid bg-acid px-6 py-2.5 text-[13px] text-ink transition-colors hover:bg-white hover:border-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {canAdd ? "Add to cart" : "Sold out"}
                    </button>
                  </div>
                </div>

                {previewA && previewB && (
                  <div className="mt-5 grid grid-cols-2 gap-5">
                    <div className="relative aspect-[8/5.5] overflow-hidden rounded-[28px] bg-warm-linen">
                      <Image src={previewA.url} alt={previewA.alt} fill sizes="(min-width: 1024px) 45vw, 90vw" className="object-cover" />
                    </div>
                    <div className="relative aspect-[8/5.5] overflow-hidden rounded-[28px] bg-warm-linen">
                      <Image src={previewB.url} alt={previewB.alt} fill sizes="(min-width: 1024px) 45vw, 90vw" className="object-cover" />
                    </div>
                  </div>
                )}

                <p className="mt-5 flex flex-col items-center justify-center gap-3 text-center sm:flex-row">
                  <span className="inline-block rounded-full bg-acid px-2.5 py-[3px] text-xs text-ink">{range.badge}</span>
                  <span className="text-[11px] leading-tight text-ink-soft">{range.caption}</span>
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
