"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { products as bundledProducts } from "@/content/catalog";
import { trackEvent } from "@/lib/analytics";
import { formatPrice } from "@/lib/format";
import { MIN_QUERY_LENGTH, searchProducts } from "@/lib/search";
import type { Product } from "@/lib/types";

/** Results shown in the dropdown before it tells you to go to /search. */
const PREVIEW_LIMIT = 6;

interface SearchOverlayProps {
  /** Live catalogue, fetched once by Header. `null` while it is still loading
   * or if the backend was unreachable — the bundled catalogue covers both. */
  catalog: Product[] | null;
  isCatalogLoading: boolean;
  onClose: () => void;
}

/**
 * Modal search over the catalogue (name, type, material, description, tags).
 *
 * Matching lives in `lib/search.ts`, shared with `/search`, so the dropdown and
 * the full results page can never disagree about what matches.
 */
export function SearchOverlay({ catalog, isCatalogLoading, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const activeCatalog = catalog ?? bundledProducts;
  const matches = useMemo(() => searchProducts(activeCatalog, query), [activeCatalog, query]);
  const preview = matches.slice(0, PREVIEW_LIMIT);
  const isSearching = query.trim().length >= MIN_QUERY_LENGTH;
  const resultsUrl = `/search?q=${encodeURIComponent(query.trim())}`;

  // Suggest terms the live catalogue actually contains. The old hardcoded
  // "clip, silk, gold" could suggest a term that matches nothing.
  const suggestions = useMemo(() => {
    const types = new Set<string>();
    for (const product of activeCatalog) {
      if (product.type) types.add(product.type);
      if (types.size >= 3) break;
    }
    return [...types];
  }, [activeCatalog]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced: track the settled query (including zero-result ones — those
  // are the most useful signal for catalog/copy gaps), not every keystroke.
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) return;
    const id = setTimeout(() => trackEvent("search", { query: q }), 600);
    return () => clearTimeout(id);
  }, [query]);

  function goToResults() {
    if (!isSearching) return;
    router.push(resultsUrl);
    onClose();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key === "ArrowDown" && preview.length > 0) {
      event.preventDefault();
      setHighlight((current) => (current + 1) % preview.length);
      return;
    }
    if (event.key === "ArrowUp" && preview.length > 0) {
      event.preventDefault();
      setHighlight((current) => (current <= 0 ? preview.length - 1 : current - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      // Enter on a highlighted row opens it; Enter with nothing highlighted
      // means "show me everything", which is the results page.
      const chosen = preview[highlight];
      if (chosen) {
        router.push(`/products/${chosen.slug}`);
        onClose();
        return;
      }
      goToResults();
    }
  }

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
            onChange={(event) => {
              setQuery(event.target.value);
              // Reset here rather than in an effect on `query`: this is the
              // only thing that changes the query, so the old highlight index
              // is stale the moment it does.
              setHighlight(-1);
            }}
            onKeyDown={onKeyDown}
            placeholder={
              suggestions.length > 0 ? `Search ${suggestions.join(", ").toLowerCase()}…` : "Search products…"
            }
            aria-label="Search products"
            role="combobox"
            aria-expanded={isSearching}
            aria-controls="search-results"
            aria-autocomplete="list"
            aria-activedescendant={highlight >= 0 ? `search-result-${highlight}` : undefined}
            className="w-full bg-transparent text-base text-ink placeholder:text-ink-soft/60 focus:outline-none"
          />
          <button type="button" onClick={onClose} className="eyebrow hover:text-teal">
            Close
          </button>
        </div>

        {isSearching && (
          <>
            <ul id="search-results" role="listbox" aria-label="Search results" className="mt-4 flex flex-col divide-y divide-ink/10">
              {preview.length === 0 && (
                <li className="py-6 text-sm text-ink-soft">
                  {isCatalogLoading ? (
                    "Searching…"
                  ) : (
                    <>
                      Nothing matches “{query}” yet
                      {suggestions.length > 0 && <> — try “{suggestions.join("”, “").toLowerCase()}”</>}.
                    </>
                  )}
                </li>
              )}
              {preview.map((product, index) => (
                <li key={product.id} id={`search-result-${index}`} role="option" aria-selected={index === highlight}>
                  <Link
                    href={`/products/${product.slug}`}
                    onClick={onClose}
                    onMouseEnter={() => setHighlight(index)}
                    className={`flex items-center gap-4 py-3 transition-colors ${
                      index === highlight ? "bg-paper-tint" : "hover:bg-paper-tint"
                    }`}
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

            {matches.length > 0 && (
              <Link
                href={resultsUrl}
                onClick={onClose}
                className="mt-3 block border-t border-ink/10 pt-3 text-sm font-medium text-teal hover:underline"
              >
                {matches.length > PREVIEW_LIMIT
                  ? `See all ${matches.length} results →`
                  : "Open in full results →"}
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
