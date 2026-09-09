import type { MetadataRoute } from "next";
import { siteConfig } from "@/content/site.config";
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, collections] = await Promise.all([fetchProducts(), fetchCollections()]);
  const lastModified = new Date();
  const base = siteConfig.brand.url;

  return [
    ...STATIC_PATHS.map(({ path, priority }) => ({
      url: `${base}${path}`,
      lastModified,
      priority,
    })),
    ...collections.map((collection) => ({
      url: `${base}/collections/${collection.slug}`,
      lastModified,
      priority: 0.8,
    })),
    // Internal payment-verification products are live catalogue rows but must
    // never be submitted for indexing.
    ...products
      .filter((product) => !product.isTestProduct)
      .map((product) => ({
        url: `${base}/products/${product.slug}`,
        lastModified,
        priority: 0.7,
      })),
  ];
}
