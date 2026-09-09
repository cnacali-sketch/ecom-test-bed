import { siteConfig } from "@/content/site.config";
import { fetchProducts } from "@/lib/api";
import { isPurchasable } from "@/lib/seo";
import type { Product } from "@/lib/types";

// Product feed in Google Merchant Center's RSS 2.0 dialect, which Meta
// Commerce Manager ingests from the same URL. This is the piece that lets
// Google Shopping / Free listings and Instagram + Facebook Shopping read real
// products, rather than the marketing site only.
//
// Connect later with no code change:
//   Google  -> Merchant Center > Products > Feeds > Scheduled fetch
//   Meta    -> Commerce Manager > Catalogue > Data sources > Scheduled feed
//   both pointing at https://savvyinteal.com/feed.xml
//
// Revalidated hourly: a scheduled fetch runs at most daily, so serving this
// fresh on every request would be wasted work.
export const revalidate = 3600;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function tag(name: string, value: string | number): string {
  return `<${name}>${escapeXml(String(value))}</${name}>`;
}

function feedItem(product: Product): string {
  const { brand, seo } = siteConfig;
  const url = `${brand.url}/products/${product.slug}`;
  const parts: string[] = [
    // Must stay stable for the life of the product: both platforms key
    // performance history off it. The SKU is the store's own identity key.
    tag("g:id", product.variants[0]?.sku || product.slug),
    tag("g:title", product.name),
    tag("g:description", product.description || `${product.name} — ${product.type}`),
    tag("g:link", url),
    tag("g:condition", "new"),
    tag("g:availability", isPurchasable(product) ? "in_stock" : "out_of_stock"),
    tag("g:price", `${product.price.toFixed(2)} ${product.currency}`),
  ];

  // mrp > price is a genuine markdown, which is what sale_price means.
  if (product.mrp > product.price) {
    parts.push(tag("g:sale_price", `${product.price.toFixed(2)} ${product.currency}`));
    parts[parts.length - 2] = tag("g:price", `${product.mrp.toFixed(2)} ${product.currency}`);
  }

  if (product.images[0]) parts.push(tag("g:image_link", product.images[0].url));
  for (const image of product.images.slice(1, 11)) {
    parts.push(tag("g:additional_image_link", image.url));
  }

  if (product.brand) parts.push(tag("g:brand", product.brand));
  if (product.type) parts.push(tag("g:product_type", product.type));
  if (product.material) parts.push(tag("g:material", product.material));
  if (seo.merchant.googleProductCategory) {
    parts.push(tag("g:google_product_category", seo.merchant.googleProductCategory));
  }

  // No barcodes are recorded anywhere in this catalogue. Saying so explicitly
  // is required — omitting it makes both platforms reject the item for a
  // missing GTIN instead of accepting it as an own-brand product.
  parts.push(tag("g:identifier_exists", "no"));
  parts.push(tag("g:mpn", product.variants[0]?.sku || product.slug));

  if (seo.merchant.shippingRate !== null) {
    parts.push(
      `<g:shipping>${tag("g:country", seo.merchant.shipsToCountry)}${tag(
        "g:price",
        `${seo.merchant.shippingRate.toFixed(2)} ${brand.currency}`,
      )}</g:shipping>`,
    );
  }

  return `<item>${parts.join("")}</item>`;
}

export async function GET(): Promise<Response> {
  const products = await fetchProducts();
  // Internal payment-verification rows must never reach a shopping surface.
  const sellable = products.filter((product) => !product.isTestProduct);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
${tag("title", `${siteConfig.brand.name} — product feed`)}
${tag("link", siteConfig.brand.url)}
${tag("description", siteConfig.brand.description)}
${sellable.map(feedItem).join("\n")}
</channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
