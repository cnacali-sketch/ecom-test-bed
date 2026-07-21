"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { calculateDiscountPercent } from "@/lib/format";
import type { Product } from "@/lib/types";
import { useWishlist } from "@/lib/wishlist-context";
import { PriceBlock } from "./PriceBlock";

interface ProductCardProps {
  product: Product;
}

const LOW_STOCK_THRESHOLD = 5;

/**
 * Shared spine component: image + hover-swap alt image, swatch-toggle
 * (France Luxe pattern), title, PriceBlock, Sale/NEW badge, Sold Out state.
 * Also carries the commerce-polish layer ported from the ProductCard demo:
 * wishlist toggle, animated discount badge, gold card frame, and stock
 * messaging modes.
 */
export function ProductCard({ product }: ProductCardProps) {
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isCtaHovered, setIsCtaHovered] = useState(false);
  const { isWished, toggleWish } = useWishlist();

  const activeVariant = product.variants[activeVariantIndex];
  const primaryImage = activeVariant?.image ?? product.images[0]?.url;
  const secondaryImage = product.images[1]?.url ?? primaryImage;
  const displayImage = isHovered ? secondaryImage : primaryImage;

  const wished = isWished(product.id);
  const discountPercent = calculateDiscountPercent(product.mrp, product.price);
  const showDiscountBadge = product.isSale && discountPercent > 0;
  const badgeAnimation = product.badgeAnimation ?? "shine";
  const badgeAnimClass = badgeAnimation !== "none" ? `badge-anim-${badgeAnimation}` : "";

  const stockMode = product.stockMode ?? "hidden";
  const stock = product.stock;
  const isLowStock = stockMode === "lowOnly" && stock !== undefined && stock > 0 && stock <= LOW_STOCK_THRESHOLD;

  return (
    <div className="group flex h-full flex-col">
      <div className="relative">
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            toggleWish(product.id);
          }}
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          aria-pressed={wished}
          className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-card/90 shadow-sm transition hover:bg-card"
        >
          <span className={wished ? "text-sale" : "text-ink-soft"} aria-hidden>
            {wished ? "♥" : "♡"}
          </span>
        </button>

        <Link
          href={`/products/${product.slug}`}
          className="product-frame relative block aspect-[4/5] overflow-hidden bg-paper-tint"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <Image
            src={displayImage}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-all duration-500 group-hover:scale-[1.03]"
          />

          <div className="absolute left-2 top-2 flex flex-col gap-1">
            {product.isNew && (
              <span className="bg-teal px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-white">
                New
              </span>
            )}
            {showDiscountBadge && (
              <span className={`bg-sale px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-white ${badgeAnimClass}`}>
                {discountPercent}% off
              </span>
            )}
          </div>

          {!product.inStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-paper/70">
              <span className="bg-ink px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-white">
                Sold Out
              </span>
            </div>
          )}
        </Link>
      </div>

      {product.variants.length > 1 && (
        <div className="mt-2 flex gap-1.5" role="group" aria-label={`Colors for ${product.name}`}>
          {product.variants.map((variant, index) => (
            <button
              key={variant.id}
              type="button"
              onClick={() => setActiveVariantIndex(index)}
              aria-label={`View ${variant.color}`}
              aria-pressed={index === activeVariantIndex}
              className={`h-4 w-4 rounded-full border transition ${
                index === activeVariantIndex
                  ? "ring-2 ring-teal ring-offset-1"
                  : "border-ink/20"
              }`}
              style={{ backgroundColor: variant.colorHex }}
            />
          ))}
        </div>
      )}

      <Link href={`/products/${product.slug}`} className="mt-2">
        <p className="eyebrow">{product.type}</p>
        <h3 className="text-[13px] uppercase tracking-[0.06em] text-ink transition-colors group-hover:text-teal">{product.name}</h3>
      </Link>

      <div className="mt-1">
        <PriceBlock price={product.price} mrp={product.mrp} currency={product.currency} size="sm" />
      </div>

      {stockMode !== "hidden" && product.inStock && stock !== undefined && (
        <p className="mt-1 text-[11px] font-medium text-ink-soft">
          {stockMode === "lowOnly"
            ? isLowStock
              ? `Only ${stock} left`
              : "In stock"
            : `${stock} in stock`}
        </p>
      )}

      <button
        type="button"
        disabled={!product.inStock}
        onMouseEnter={() => setIsCtaHovered(true)}
        onMouseLeave={() => setIsCtaHovered(false)}
        className={`product-cta mt-auto w-full border py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors ${
          product.inStock
            ? `border-teal bg-teal text-white hover:bg-teal-deep ${isCtaHovered ? "is-gold" : ""}`
            : "cursor-not-allowed border-ink/20 bg-paper-tint text-ink-soft"
        }`}
      >
        {product.inStock ? "Add to cart" : "Sold out"}
      </button>
    </div>
  );
}
