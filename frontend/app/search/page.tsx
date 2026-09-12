import type { Metadata } from "next";
import Link from "next/link";
import { ProductGrid } from "@/components/product/ProductGrid";
import { getSiteContent } from "@/lib/site-content";
import { fetchProductSearch, fetchProducts } from "@/lib/api";
import { MIN_QUERY_LENGTH, searchProducts } from "@/lib/search";

// Internal search results are deliberately kept out of the index. Google's own
// guidance is not to index them: they are thin, near-duplicate, and infinitely
// generatable from arbitrary query strings. `follow` still lets crawlers walk
// through to the real product pages. The page stays fully shareable.
export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const content = await getSiteContent();
  const query = (q ?? "").trim();

  // Searched in the database, which is what gives stemming and relevance
  // ordering. `null` means the backend could not answer -- not that nothing
  // matched -- so the bundled catalogue is matched in the browser instead and
  // the page still returns results rather than an empty shop.
  const live = query.length >= MIN_QUERY_LENGTH ? await fetchProductSearch(query) : [];
  const matches =
    live ??
    (query.length >= MIN_QUERY_LENGTH ? searchProducts(await fetchProducts(), query) : []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] text-ink-soft">
        <Link href="/" className="hover:text-teal">
          Home
        </Link>
        <span aria-hidden>/</span>
        <span className="text-ink" aria-current="page">
          Search
        </span>
      </nav>

      <h1 className="font-display mt-1 text-[34px] italic leading-[1.04] tracking-tight text-ink sm:text-[52px]">
        {query ? <>Results for “{query}”</> : "Search"}
      </h1>

      {query.length >= MIN_QUERY_LENGTH && (
        <p className="mt-3.5 text-sm text-ink-soft">
          {matches.length === 1 ? "1 product" : `${matches.length} products`}
        </p>
      )}

      {matches.length > 0 ? (
        <div className="mt-9">
          <ProductGrid products={matches} />
        </div>
      ) : (
        <div className="mt-9 border-t border-rule-soft pt-8">
          <p className="text-sm text-ink-soft">
            {query.length < MIN_QUERY_LENGTH
              ? "Type at least two characters to search."
              : `Nothing matches “${query}”.`}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {content.nav.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="border border-ink/15 px-4 py-2 text-xs uppercase tracking-[0.16em] text-ink transition-colors hover:border-teal hover:text-teal"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
