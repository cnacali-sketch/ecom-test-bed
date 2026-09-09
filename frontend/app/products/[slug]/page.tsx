import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product/ProductDetail";
import { JsonLd } from "@/components/seo/JsonLd";
import { fetchProducts } from "@/lib/api";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo";
import type { Product } from "@/lib/types";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

async function findProduct(slug: string): Promise<Product | undefined> {
  const allProducts = await fetchProducts();
  return allProducts.find((candidate) => candidate.slug === slug);
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await findProduct(slug);
  if (!product) return { title: "Product not found" };

  const canonical = `/products/${product.slug}`;
  const description =
    product.description?.trim() ||
    `${product.name} — ${product.type} by ${product.brand}. Shop at Savvy In Teal.`;
  // Live products can have no images at all; emitting an empty images array
  // is better than a broken og:image URL.
  const images = product.images.map((image) => image.url);

  return {
    title: product.name,
    description,
    alternates: { canonical },
    // The internal payment-verification products are real catalogue rows and
    // are reachable, but must never enter a search index.
    ...(product.isTestProduct && { robots: { index: false, follow: false } }),
    openGraph: {
      type: "website",
      title: product.name,
      description,
      url: canonical,
      ...(images.length > 0 && { images }),
    },
    twitter: {
      card: images.length > 0 ? "summary_large_image" : "summary",
      title: product.name,
      description,
      ...(images.length > 0 && { images }),
    },
  };
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

  return (
    <>
      <JsonLd data={productJsonLd(product)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: product.name, path: `/products/${product.slug}` },
        ])}
      />
      <ProductDetail product={product} relatedProducts={relatedProducts} />
    </>
  );
}
