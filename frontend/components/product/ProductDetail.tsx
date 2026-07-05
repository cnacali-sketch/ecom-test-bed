"use client";

import { useState } from "react";
import { AccordionSection } from "@/components/product/AccordionSection";
import { CrossSellRail } from "@/components/product/CrossSellRail";
import { ImageGallery } from "@/components/product/ImageGallery";
import { PriceBlock } from "@/components/product/PriceBlock";
import { TrustBadges } from "@/components/product/TrustBadges";
import { VariantSelector } from "@/components/product/VariantSelector";
import { useCart } from "@/lib/cart-context";
import type { Product } from "@/lib/types";

interface ProductDetailProps {
  product: Product;
  relatedProducts: Product[];
}

export function ProductDetail({ product, relatedProducts }: ProductDetailProps) {
  const [activeVariantId, setActiveVariantId] = useState(product.variants[0]?.id ?? "");
  const { addItem } = useCart();

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
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <ImageGallery images={product.images} />

        <div className="flex flex-col gap-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500">{product.brand}</p>
            <h1 className="text-2xl font-semibold text-neutral-900">{product.name}</h1>
          </div>

          <PriceBlock price={product.price} mrp={product.mrp} currency={product.currency} size="lg" />

          {activeVariant && (
            <VariantSelector
              variants={product.variants}
              activeVariantId={activeVariant.id}
              onSelect={setActiveVariantId}
            />
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!canAddToCart}
              className="flex-1 rounded bg-neutral-900 py-3 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {canAddToCart ? "Add to Cart" : "Sold Out"}
            </button>
            <button
              type="button"
              disabled={!canAddToCart}
              className="flex-1 rounded border border-neutral-900 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-300"
            >
              Buy It Now
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
    </div>
  );
}
