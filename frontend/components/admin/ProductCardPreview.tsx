"use client";

// Live "what the shopper sees" preview for the product editor.
//
// The demo let each product pick one of five gold frames. That's gone: the
// storefront uses ONE uniform gold hover-ring for every card (the .product-frame
// class), so the preview shows that same treatment and there is no per-product
// frame control anywhere in the editor.

import { ImageIcon, Ruler, ShoppingBag, Star, EyeOff } from "lucide-react";
import { useState } from "react";

import { discount, dimStr, rupee } from "@/lib/admin/helpers";
import { LOW_STOCK, type AdminProduct } from "@/lib/admin/types";
import { DiscountBadge } from "./atoms";

export function ProductCardPreview({ p }: { p: AdminProduct }) {
  const off = discount(p.mrp, p.price);
  const out = p.stock <= 0;
  const low = p.stock > 0 && p.stock <= LOW_STOCK;
  const size = dimStr(p.dims);
  const badgeText = (p.badge.text || "").trim() || (off > 0 ? `${off}% OFF` : "");
  const showBadge = p.badge.on && p.show.price && badgeText;
  const [ctaActive, setCtaActive] = useState(false);

  let stockNode: React.ReactNode;
  if (out) stockNode = <span className="text-xs font-semibold text-sale">Out of stock</span>;
  else if (p.stockMode === "exact")
    stockNode = <span className="text-xs font-semibold text-teal">{p.stock} in stock</span>;
  else if (p.stockMode === "lowOnly")
    stockNode = low ? (
      <span className="text-xs font-semibold text-gold">Only {p.stock} left</span>
    ) : (
      <span className="text-xs font-semibold text-teal">In stock</span>
    );
  else stockNode = <span className="text-xs font-semibold text-teal">In stock</span>;

  return (
    <div className="product-frame mx-auto w-full max-w-xs">
      <div className="relative w-full overflow-hidden rounded-2xl bg-card shadow-sm">
        {!p.published && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-card/75 backdrop-blur-[1px]">
            <EyeOff className="mb-1.5 h-6 w-6 text-ink-soft" />
            <span className="text-sm font-bold text-ink">Not published</span>
            <span className="px-6 text-center text-xs text-ink-soft">Flip “Publish” on when ready.</span>
          </div>
        )}
        <div className="relative aspect-square w-full bg-gradient-to-br from-teal/10 to-gold/10">
          {p.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-teal/40">
              <ImageIcon className="h-10 w-10" strokeWidth={1.5} />
            </div>
          )}
          {showBadge && (
            <div className="absolute left-3 top-3">
              <DiscountBadge
                text={badgeText}
                anim={p.badge.anim}
                bg={p.badge.bg}
                fg={p.badge.fg}
                opacity={p.badge.opacity}
              />
            </div>
          )}
        </div>
        <div className="p-4">
          {p.show.category && (
            <span className="text-[11px] font-semibold uppercase tracking-wide text-teal">
              {p.category}
            </span>
          )}
          <h3 className="mt-1 font-display font-semibold leading-snug text-ink">
            {p.show.name ? p.name || "Untitled product" : "New arrival"}
          </h3>
          <div className="mt-2 flex items-center gap-1 text-gold">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-3.5 w-3.5 fill-current" />
            ))}
            <span className="ml-1 text-xs text-ink-soft/70">(new)</span>
          </div>
          {p.show.price ? (
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-xl font-bold text-ink">{rupee(p.price)}</span>
              {p.show.mrp && off > 0 && (
                <span className="text-sm text-ink-soft/60 line-through">{rupee(p.mrp)}</span>
              )}
            </div>
          ) : (
            <div className="mt-3 text-sm font-semibold text-teal">Price on request</div>
          )}
          {p.desc && (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-soft">{p.desc}</p>
          )}
          {p.show.dims && size && (
            <p className="mt-2 flex items-center gap-1 text-xs text-ink-soft">
              <Ruler className="h-3.5 w-3.5 text-ink-soft/60" /> Size: {size}
            </p>
          )}
          <div className="mt-3">{stockNode}</div>
          <button
            disabled={out}
            onMouseEnter={() => setCtaActive(true)}
            onMouseLeave={() => setCtaActive(false)}
            className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-colors ${out ? "cursor-not-allowed border-2 border-ink/20 bg-ink/10 text-ink-soft/60" : `product-cta text-white ${ctaActive ? "is-gold" : ""}`}`}
          >
            <ShoppingBag className="h-4 w-4" /> {out ? "Sold out" : "Add to cart"}
          </button>
        </div>
      </div>
    </div>
  );
}
