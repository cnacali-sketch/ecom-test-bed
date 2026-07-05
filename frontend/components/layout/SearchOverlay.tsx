"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { products } from "@/content/catalog";
import { formatPrice } from "@/lib/format";

interface SearchOverlayProps {
  onClose: () => void;
}

/**
 * Modal search over the catalog (name, type, material, tags).
 * Client-side for now; swap the `results` memo for a backend call
 * when server search ships.
 */
export function SearchOverlay({ onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return products
      .filter((product) =>
        [product.name, product.type, product.material, ...product.tags]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 6);
  }, [query]);

  return (
    <div className="fixed inset-0 z-[95]">
      <button type="button" aria-label="Close search" onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <div className="animate-rise relative mx-auto mt-16 w-[min(92vw,640px)] bg-paper p-5 shadow-xl sm:p-7">
        <div className="flex items-center gap-3 border-b border-ink/20 pb-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-ink-soft">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search clips, silk, hoops…"
            aria-label="Search products"
            className="w-full bg-transparent text-base text-ink placeholder:text-ink-soft/60 focus:outline-none"
          />
          <button type="button" onClick={onClose} className="eyebrow hover:text-teal">
            Close
          </button>
        </div>

        {query.trim().length >= 2 && (
          <ul className="mt-4 flex flex-col divide-y divide-ink/10">
            {results.length === 0 && (
              <li className="py-6 text-sm text-ink-soft">
                Nothing matches “{query}” yet — try “clip”, “silk”, or “gold”.
              </li>
            )}
            {results.map((product) => (
              <li key={product.id}>
                <Link
                  href={`/products/${product.slug}`}
                  onClick={onClose}
                  className="flex items-center gap-4 py-3 transition-colors hover:bg-paper-tint"
                >
                  <span className="relative block h-14 w-11 shrink-0 overflow-hidden bg-paper-tint">
                    <Image src={product.images[0].url} alt="" fill sizes="44px" className="object-cover" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm uppercase tracking-wide text-ink">{product.name}</span>
                    <span className="block text-xs text-ink-soft">{product.type}</span>
                  </span>
                  <span className="text-sm text-ink">{formatPrice(product.price, product.currency)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
