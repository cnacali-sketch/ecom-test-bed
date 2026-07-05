import { EditorialTiles } from "@/components/home/EditorialTiles";
import { HeroBanner } from "@/components/home/HeroBanner";
import { QuickCtaRow } from "@/components/home/QuickCtaRow";
import { SeoContentBlock } from "@/components/home/SeoContentBlock";
import { ProductCard } from "@/components/product/ProductCard";
import { fetchProducts } from "@/lib/api";

export default async function HomePage() {
  const products = await fetchProducts();
  const newInProducts = products.filter((product) => product.isNew);

  return (
    <>
      <HeroBanner />
      <QuickCtaRow />

      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="mb-6 text-lg font-semibold text-neutral-900">New In</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {newInProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <EditorialTiles />
      <SeoContentBlock />
    </>
  );
}
