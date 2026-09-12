import { CampaignBand } from "@/components/home/CampaignBand";
import { EditorialTiles } from "@/components/home/EditorialTiles";
import { HeroBanner } from "@/components/home/HeroBanner";
import { QuickCtaRow } from "@/components/home/QuickCtaRow";
import { SeoContentBlock } from "@/components/home/SeoContentBlock";
import { SpecimenRanges } from "@/components/home/SpecimenRanges";
import { ProductCard } from "@/components/product/ProductCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { Reveal } from "@/components/ui/Reveal";
import { fetchProducts } from "@/lib/api";
import { getSiteContent } from "@/lib/site-content";
import { faqJsonLd } from "@/lib/seo";

export default async function HomePage() {
  const [products, content] = await Promise.all([fetchProducts(), getSiteContent()]);
  const newInProducts = products.filter((product) => product.isNew);
  const { newInHeading, newInSub } = content.home;
  // Already authored and admin-editable (Homepage editor -> seo_faqs); this
  // just makes them machine-readable for the FAQ rich result.
  const faqs = content.home.seo.faqs;

  return (
    <>
      {faqs.length > 0 && <JsonLd data={faqJsonLd(faqs)} />}
      <HeroBanner />
      <QuickCtaRow />

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

      <SpecimenRanges products={products} />
      <CampaignBand />
      <EditorialTiles />
      <SeoContentBlock />
    </>
  );
}
