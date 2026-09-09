// Catalogue text search, shared by the header overlay and the /search page.
//
// Lives here rather than inside SearchOverlay so the two cannot drift: a query
// that matches in the dropdown must match the same products on the full
// results page, or "See all N results" lands on a different N.

import type { Product } from "./types";

/** Below this, a query matches so much of the catalogue that showing results
 * is noise. Both callers use it so they agree on when searching has started. */
export const MIN_QUERY_LENGTH = 2;

function haystack(product: Product): string {
  return [product.name, product.type, product.material, product.description, ...product.tags]
    .join(" ")
    .toLowerCase();
}

/**
 * Every whitespace-separated term must appear somewhere in the product's text,
 * in any order.
 *
 * This was originally one `haystack.includes(query)`, which made the whole
 * query a single contiguous substring and let word order silently decide the
 * result: "1 rs" missed "TEST Payment Verification Rs 1" while "rs 1" matched
 * it, and "gold clip" missed a product named "Clip, Gold".
 */
export function searchProducts(catalog: Product[], query: string): Product[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < MIN_QUERY_LENGTH) return [];
  const terms = normalized.split(/\s+/);
  return catalog.filter((product) => {
    const text = haystack(product);
    return terms.every((term) => text.includes(term));
  });
}
