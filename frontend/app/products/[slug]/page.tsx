import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product/ProductDetail";
import { fetchProducts } from "@/lib/api";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const allProducts = await fetchProducts();
  const product = allProducts.find((candidate) => candidate.slug === slug);

  if (!product) {
    notFound();
  }

  const relatedProducts = allProducts
    .filter(
      (candidate) =>
        candidate.id !== product.id &&
        candidate.collectionSlugs.some((collectionSlug) =>
          product.collectionSlugs.includes(collectionSlug),
        ),
    )
    .slice(0, 4);

  return <ProductDetail product={product} relatedProducts={relatedProducts} />;
}
