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
    <div className="mx-auto max-w-6xl px-6 py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-neutral-500">
        <Link href="/" className="hover:text-neutral-900">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-neutral-900">{collection.name}</span>
      </nav>

      <h1 className="mb-3 text-2xl font-semibold text-neutral-900">{collection.name}</h1>
      <div className="mb-8">
        <SeoDescription text={collection.seoDescription} />
      </div>

      <ProductGrid products={products} />
    </div>
  );
}
