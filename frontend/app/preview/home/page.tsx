import type { Metadata } from "next";

import { HomeSections } from "@/components/home/HomeSections";
import { fetchProducts } from "@/lib/api";
import { decodeLayout } from "@/lib/home-layout";

/**
 * The homepage as it would look with a layout that has not been saved yet.
 *
 * This is what makes the admin's builder a builder rather than a viewer: the
 * iframe's `src` carries the draft arrangement, so moving a section moves it on
 * screen before anything is committed.
 *
 * It renders through `HomeSections`, the same component the real homepage uses.
 * Duplicating the composition here would let the preview and the page drift,
 * and a preview is only worth having if it is the page.
 *
 * **Not a leak, and worth saying why.** The parameter can only reorder and
 * toggle sections whose content `GET /api/content/site` already serves to
 * anybody who asks. Hiding a section is a layout choice, not a secret, so a
 * hand-typed URL here reveals nothing the storefront does not.
 */
export const metadata: Metadata = {
  // Kept out of the index: this renders the same content as `/` in a different
  // order, which is exactly the kind of near-duplicate that should never
  // compete with the real homepage in search results.
  robots: { index: false, follow: false },
};

export default async function HomeLayoutPreview({
  searchParams,
}: {
  searchParams: Promise<{ layout?: string }>;
}) {
  const [{ layout }, products] = await Promise.all([searchParams, fetchProducts()]);

  return <HomeSections layout={decodeLayout(layout)} products={products} />;
}
