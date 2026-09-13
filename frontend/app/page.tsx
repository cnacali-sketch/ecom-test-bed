import { HomeSections } from "@/components/home/HomeSections";
import { JsonLd } from "@/components/seo/JsonLd";
import { fetchProducts } from "@/lib/api";
import { resolveLayout } from "@/lib/home-layout";
import { resolveToggles } from "@/lib/home-toggles";
import { getSiteContent } from "@/lib/site-content";
import { faqJsonLd } from "@/lib/seo";

export default async function HomePage() {
  const [products, content] = await Promise.all([fetchProducts(), getSiteContent()]);
  // Already authored and admin-editable (Homepage editor -> seo_faqs); this
  // just makes them machine-readable for the FAQ rich result.
  //
  // Gated on the SEO layout section AND the FAQ toggle, because structured
  // data has to describe what is actually on the page. Declaring FAQPage
  // markup for questions a visitor cannot see is precisely the mismatch
  // Google penalises, and it would happen silently -- the page would look
  // fine and the rich result would be the thing that broke.
  const layout = resolveLayout(content.home.layout);
  const show = resolveToggles(content.home.show);
  const seoSectionVisible = layout.some((entry) => entry.id === "seo" && entry.visible);
  const faqs = seoSectionVisible && show.seoFaqs ? content.home.seo.faqs : [];

  return (
    <>
      {faqs.length > 0 && <JsonLd data={faqJsonLd(faqs)} />}
      <HomeSections layout={layout} products={products} />
    </>
  );
}
