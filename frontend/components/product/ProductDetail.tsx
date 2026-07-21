"use client";

import { useEffect, useState } from "react";
import { AccordionSection } from "@/components/product/AccordionSection";
import { CrossSellRail } from "@/components/product/CrossSellRail";
import { ImageGallery } from "@/components/product/ImageGallery";
import { PriceBlock } from "@/components/product/PriceBlock";
import { TrustBadges } from "@/components/product/TrustBadges";
import { VariantSelector } from "@/components/product/VariantSelector";
import { trackEvent } from "@/lib/analytics";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

interface ProductDetailProps {
  product: Product;
  relatedProducts: Product[];
}

export function ProductDetail({ product, relatedProducts }: ProductDetailProps) {
  const [activeVariantId, setActiveVariantId] = useState(product.variants[0]?.id ?? "");
  const { addItem, openCart } = useCart();

  useEffect(() => {
    trackEvent("product_view", { product_id: product.id });
  }, [product.id]);

  const activeVariant =
    product.variants.find((variant) => variant.id === activeVariantId) ?? product.variants[0];
  const canAddToCart = Boolean(activeVariant?.inStock) && product.inStock;

  const handleAddToCart = () => {
    if (!activeVariant || !canAddToCart) return;
    addItem({
      productId: product.id,
      variantId: activeVariant.id,
      name: product.name,
      image: activeVariant.image,
      color: activeVariant.color,
      price: product.price,
      currency: product.currency,
      quantity: 1,
    });
    trackEvent("add_to_cart", { product_id: product.id });
    openCart();
  };

  return (
    // pb-24 on mobile clears the sticky add-to-cart bar
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:pb-10 lg:pt-10">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
        <ImageGallery images={product.images} />

        <div className="flex flex-col gap-6">
          <div>
            <p className="eyebrow">{product.type}</p>
            <h1 className="font-display mt-1 text-3xl italic text-ink sm:text-4xl">
              {product.name}
            </h1>
          </div>

          <PriceBlock price={product.price} mrp={product.mrp} currency={product.currency} size="lg" />

          {activeVariant && (
            <VariantSelector
              variants={product.variants}
              activeVariantId={activeVariant.id}
              onSelect={setActiveVariantId}
            />
          )}

          {/* Desktop actions — on mobile the sticky bar below takes over */}
          <div className="hidden gap-3 lg:flex">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!canAddToCart}
              className="flex-1 bg-teal py-3.5 text-xs uppercase tracking-[0.18em] text-white transition-colors hover:bg-teal-deep disabled:cursor-not-allowed disabled:bg-ink/20"
            >
              {canAddToCart ? "Add to cart" : "Sold out"}
            </button>
            <button
              type="button"
              disabled={!canAddToCart}
              className="flex-1 border border-teal py-3.5 text-xs uppercase tracking-[0.18em] text-teal transition-colors hover:bg-teal hover:text-white disabled:cursor-not-allowed disabled:border-ink/20 disabled:text-ink/30"
            >
              Buy it now
            </button>
          </div>

          <div>
            <AccordionSection title="Description" defaultOpen>
              {product.description}
            </AccordionSection>
            <AccordionSection title="Care Instructions">{product.careInstructions}</AccordionSection>
            <AccordionSection title="Measurements">{product.measurements}</AccordionSection>
            <AccordionSection title="Shipping & Returns">{product.shippingInfo}</AccordionSection>
          </div>

          <TrustBadges />
        </div>
      </div>

      <CrossSellRail products={relatedProducts} />

      {/* Sticky mobile add-to-cart bar. Extra bottom padding clears the phone's
          gesture bar / home indicator via the safe-area inset. */}
      <div className="fixed inset-x-0 bottom-0 z-[70] border-t border-ink/10 bg-paper/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="flex items-center gap-4">
          <div className="min-w-0">
            <p className="truncate text-[11px] uppercase tracking-[0.1em] text-ink-soft">
              {product.name}
            </p>
            <p className="text-base font-semibold text-ink">
              {formatPrice(product.price, product.currency)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!canAddToCart}
            className="ml-auto shrink-0 bg-teal px-7 py-3.5 text-xs uppercase tracking-[0.16em] text-white transition-colors hover:bg-teal-deep disabled:cursor-not-allowed disabled:bg-ink/20"
          >
            {canAddToCart ? "Add to cart" : "Sold out"}
          </button>
        </div>
      </div>
    </div>
  );
}
