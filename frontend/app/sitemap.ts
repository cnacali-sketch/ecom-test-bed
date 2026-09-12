import type { MetadataRoute } from "next";
import { getSiteContent } from "@/lib/site-content";
import { fetchCollections, fetchProducts } from "@/lib/api";

/** Static pages worth indexing. Anything behind auth or mid-funnel is in
 * robots.ts's disallow list instead. */
const STATIC_PATHS = [
  { path: "/", priority: 1 },
  { path: "/contact", priority: 0.5 },
  { path: "/policies/terms", priority: 0.3 },
  { path: "/policies/privacy", priority: 0.3 },
  { path: "/policies/refund", priority: 0.3 },
  { path: "/policies/returns", priority: 0.3 },
];

// Deliberately no `lastModified`. The backend does not expose an updated_at
// on products or collections, so the only value available is "now" — which
// would claim every page changed on every crawl. Google discounts a lastmod
// it finds untrustworthy, so an absent one is worth more than a wrong one.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, collections, content] = await Promise.all([
    fetchProducts(),
    fetchCollections(),
    getSiteContent(),
  ]);
  const base = content.brand.url;

  return [
    ...STATIC_PATHS.map(({ path, priority }) => ({
      url: `${base}${path}`,
      priority,
    })),
    ...collections.map((collection) => ({
      url: `${base}/collections/${collection.slug}`,
      priority: 0.8,
      ...(collection.heroImage && { images: [collection.heroImage] }),
    })),
    // Internal payment-verification products are live catalogue rows but must
    // never be submitted for indexing.
    ...products
      .filter((product) => !product.isTestProduct)
      .map((product) => ({
        url: `${base}/products/${product.slug}`,
        priority: 0.7,
        // Declaring images here is how product photography becomes eligible
        // for Google Images, which is a real traffic source for accessories.
        ...(product.images.length > 0 && { images: product.images.map((image) => image.url) }),
      })),
  ];
}
