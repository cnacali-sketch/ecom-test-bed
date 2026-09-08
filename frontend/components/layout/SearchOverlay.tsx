"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { products as bundledProducts } from "@/content/catalog";
import { trackEvent } from "@/lib/analytics";
import { apiBaseUrl } from "@/lib/api-client";
import { adaptProduct, type BackendProduct } from "@/lib/backend-adapter";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

interface SearchOverlayProps {
  onClose: () => void;
}

/**
 * Modal search over the catalog (name, type, material, tags).
 *
 * Searches the LIVE catalogue, falling back to the bundled one. It used to
 * search only `content/catalog.ts`, which meant search results were a
 * hardcoded snapshot: anything created, renamed, repriced or deleted through
 * the admin stayed invisible to search until someone edited that file and
 * redeployed. The bundled list is still the initial value so typing works
 * instantly and still works if the backend is unreachable.
 */
export function SearchOverlay({ onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<Product[]>(bundledProducts);
  const inputRef = useRef<HTMLInputElement>(null);

  // Public endpoint -- no credentials, same data the PLP renders from.
  useEffect(() => {
    const baseUrl = apiBaseUrl();
    if (!baseUrl) return;
    let cancelled = false;
    fetch(`${baseUrl}/api/products?limit=200`, { headers: { Accept: "application/json" } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        setCatalog((data as BackendProduct[]).map(adaptProduct));
      })
      .catch(() => {
        // Keep the bundled catalogue -- stale beats a search box that
        // silently returns nothing.
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    // Every word must appear, in any order. A single `includes(q)` made the
    // whole query one contiguous substring, so "1 rs" missed "... Rs 1" and
    // "gold clip" missed "Clip, Gold" -- word order silently decided the hit.
    const terms = q.split(/\s+/);
    return catalog
      .filter((product) => {
        const haystack = [product.name, product.type, product.material, ...product.tags]
          .join(" ")
          .toLowerCase();
        return terms.every((term) => haystack.includes(term));
      })
      .slice(0, 6);
  }, [query, catalog]);

  // Debounced: track the settled query (including zero-result ones — those
  // are the most useful signal for catalog/copy gaps), not every keystroke.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const id = setTimeout(() => trackEvent("search", { query: q }), 600);
    return () => clearTimeout(id);
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
                  {/* A live product can have no images at all (the bundled
                      catalogue always had one, so this used to be safe to
                      index blindly -- it would now throw). */}
                  <span className="relative block h-14 w-11 shrink-0 overflow-hidden bg-paper-tint">
                    {product.images[0] && (
                      <Image src={product.images[0].url} alt="" fill sizes="44px" className="object-cover" />
                    )}
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
