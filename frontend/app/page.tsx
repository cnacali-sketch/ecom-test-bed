import { HomeSections } from "@/components/home/HomeSections";
import { JsonLd } from "@/components/seo/JsonLd";
import { fetchProducts } from "@/lib/api";
import { resolveLayout } from "@/lib/home-layout";
import { getSiteContent } from "@/lib/site-content";
import { faqJsonLd } from "@/lib/seo";

export default async function HomePage() {
  const [products, content] = await Promise.all([fetchProducts(), getSiteContent()]);
  // Already authored and admin-editable (Homepage editor -> seo_faqs); this
  // just makes them machine-readable for the FAQ rich result.
  const faqs = content.home.seo.faqs;

  return (
    <>
      {faqs.length > 0 && <JsonLd data={faqJsonLd(faqs)} />}
      <HomeSections layout={resolveLayout(content.home.layout)} products={products} />
    </>
  );
}
