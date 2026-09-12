import type { MetadataRoute } from "next";
import { getSiteContent } from "@/lib/site-content";

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
  "/search",
];

// Deliberately NOT disallowed: /track-order and /contact are public utility
// pages with real search intent ("savvy in teal track order") and no private
// data — the order id is the credential. Both carry their own canonical.

// Async because the canonical host now comes from the content document.
// A `robots` default export is allowed to return a Promise.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const { brand } = await getSiteContent();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: PRIVATE_PATHS,
    },
    sitemap: `${brand.url}/sitemap.xml`,
    host: brand.url,
  };
}
