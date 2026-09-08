import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/product/ProductGrid";
import { SeoDescription } from "@/components/product/SeoDescription";
import { fetchCollectionBySlug, fetchProductsByCollectionSlug } from "@/lib/api";

interface CollectionPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { slug } = await params;
  const collection = await fetchCollectionBySlug(slug);

  if (!collection) {
    notFound();
  }

  const products = await fetchProductsByCollectionSlug(slug);

  return (
    <div>
      {/* heroImage was defined end-to-end (types/catalog/api/tests) but never
          rendered by any component — this is its first real consumer. */}
      <div className="relative h-[240px] w-full sm:h-[300px]">
        <Image
          src={collection.heroImage}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-ink/35" />
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] text-ink-soft">
          <Link href="/" className="hover:text-teal">
            Home
          </Link>
          <span aria-hidden>/</span>
          <span className="text-ink" aria-current="page">
            {collection.name}
          </span>
        </nav>

        <h1 className="font-display mt-1 text-[34px] italic leading-[1.04] tracking-tight text-ink sm:text-[52px]">
          {collection.name}
        </h1>
        {/* description was authored for all collections and mapped end-to-end
            but never rendered anywhere — used here as the short lede.
            seoDescription (longer, collapsible) stays below the grid. */}
        <p className="mt-3.5 max-w-[56ch] text-sm leading-relaxed text-ink-soft">{collection.description}</p>

        <div className="mt-9">
          <ProductGrid products={products} />
        </div>

        <div className="mt-12 border-t border-rule-soft pt-8">
          <SeoDescription text={collection.seoDescription} />
        </div>
      </div>
    </div>
  );
}
