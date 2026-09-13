import { Fragment } from "react";

import { CampaignBand } from "@/components/home/CampaignBand";
import { EditorialTiles } from "@/components/home/EditorialTiles";
import { HeroBanner } from "@/components/home/HeroBanner";
import { QuickCtaRow } from "@/components/home/QuickCtaRow";
import { SeoContentBlock } from "@/components/home/SeoContentBlock";
import { SpecimenRanges } from "@/components/home/SpecimenRanges";
import { ProductCard } from "@/components/product/ProductCard";
import { Reveal } from "@/components/ui/Reveal";
import type { HomeLayoutEntry, HomeSectionId } from "@/lib/home-layout";
import { getSiteContent } from "@/lib/site-content";
import type { Product } from "@/lib/types";

/**
 * The homepage's sections, in the order the shop chose.
 *
 * **This is the only renderer.** The live homepage and the admin's preview both
 * go through it, rather than the preview keeping its own copy of the
 * composition. A preview that had drifted from the real page would be worse
 * than no preview at all, because somebody would arrange a page against it and
 * believe the result -- the same reason the webhook replay runs the live
 * `apply_event` instead of a second implementation of it.
 *
 * The six components need nothing from here: each already calls
 * `getSiteContent()` for itself, and `cache()` collapses those into one
 * request. Only the two that render products take anything at all.
 */
export async function HomeSections({
  layout,
  products,
}: {
  layout: HomeLayoutEntry[];
  products: Product[];
}) {
  const content = await getSiteContent();
  const newInProducts = products.filter((product) => product.isNew);
  const { newInHeading, newInSub } = content.home;

  /** "New in" is written out here rather than extracted into a component of
   * its own: it is the one part of the page built from `products` and two
   * headings, with no content of its own to fetch. Being a branch of this
   * switch is what lets it be reordered and hidden like the rest. */
  const section = (id: HomeSectionId) => {
    switch (id) {
      case "hero":
        return <HeroBanner />;
      case "quickCtas":
        return <QuickCtaRow />;
      case "newIn":
        return (
          <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <Reveal>
              <p className="eyebrow">{newInSub}</p>
              <h2 className="font-display mt-1 text-3xl italic text-ink">{newInHeading}</h2>
            </Reveal>
            <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-10 lg:grid-cols-4 lg:gap-x-6">
              {newInProducts.map((product, index) => (
                <Reveal key={product.id} delay={(index % 4) * 70} className="h-full">
                  <ProductCard product={product} />
                </Reveal>
              ))}
            </div>
          </section>
        );
      case "ranges":
        return <SpecimenRanges products={products} />;
      case "campaign":
        return <CampaignBand />;
      case "editorial":
        return <EditorialTiles />;
      case "seo":
        return <SeoContentBlock />;
    }
  };

  return (
    <>
      {layout
        .filter((entry) => entry.visible)
        .map((entry) => (
          <Fragment key={entry.id}>{section(entry.id)}</Fragment>
        ))}
    </>
  );
}
