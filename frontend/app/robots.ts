import type { MetadataRoute } from "next";
import { siteConfig } from "@/content/site.config";

// Everything here is either private (an account or admin surface), a step in a
// funnel that means nothing without session state (cart/checkout), or an
// internal search result. /search is excluded on Google's own guidance: search
// results are thin, near-duplicate and infinitely generatable from arbitrary
// query strings.
const PRIVATE_PATHS = [
  "/admin",
  "/account",
  "/checkout",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/track-order",
  "/search",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: PRIVATE_PATHS,
    },
    sitemap: `${siteConfig.brand.url}/sitemap.xml`,
    host: siteConfig.brand.url,
  };
}
