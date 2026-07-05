"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/lib/types";
import { PriceBlock } from "./PriceBlock";

interface ProductCardProps {
  product: Product;
}

/**
 * Shared spine component: image + hover-swap alt image, swatch-toggle
 * (France Luxe pattern), title, PriceBlock, Sale/NEW badge, Sold Out state.
 */
export function ProductCard({ product }: ProductCardProps) {
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const activeVariant = product.variants[activeVariantIndex];
  const primaryImage = activeVariant?.image ?? product.images[0]?.url;
  const secondaryImage = product.images[1]?.url ?? primaryImage;
  const displayImage = isHovered ? secondaryImage : primaryImage;

  return (
    <div className="group flex flex-col">
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-[4/5] overflow-hidden bg-paper-tint"
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
          {product.isSale && (
            <span className="bg-sale px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-white">
              Sale
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
    </div>
  );
}
