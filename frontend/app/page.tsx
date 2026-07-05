import { CampaignBand } from "@/components/home/CampaignBand";
import { EditorialTiles } from "@/components/home/EditorialTiles";
import { HeroBanner } from "@/components/home/HeroBanner";
import { QuickCtaRow } from "@/components/home/QuickCtaRow";
import { SeoContentBlock } from "@/components/home/SeoContentBlock";
import { ProductCard } from "@/components/product/ProductCard";
import { Reveal } from "@/components/ui/Reveal";
import { siteConfig } from "@/content/site.config";
import { fetchProducts } from "@/lib/api";

export default async function HomePage() {
  const products = await fetchProducts();
  const newInProducts = products.filter((product) => product.isNew);

  return (
    <>
      <HeroBanner />
      <QuickCtaRow />

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <Reveal>
          <p className="eyebrow">{siteConfig.home.newInSub}</p>
          <h2 className="font-display mt-1 text-3xl italic text-ink">{siteConfig.home.newInHeading}</h2>
        </Reveal>
        {/* Staggered "shelf" grid: alternating tiles are offset downward on desktop */}
        <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-10 lg:grid-cols-4 lg:gap-x-6">
          {newInProducts.map((product, index) => (
            <Reveal key={product.id} delay={(index % 4) * 70} className={index % 2 === 1 ? "lg:mt-10" : ""}>
              <ProductCard product={product} />
            </Reveal>
          ))}
        </div>
      </section>

      <CampaignBand />
      <EditorialTiles />
      <SeoContentBlock />
    </>
  );
}
