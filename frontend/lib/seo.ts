// schema.org JSON-LD builders.
//
// Returned as plain objects and injected with a <script type="application/ld+json">
// so Google can read price, availability and site structure — none of which it
// could infer from the markup alone.
//
// Validate output with POST /api/recommendation/schema-inspector (the admin
// Tools screen), which checks a product dict against schema.org Product guidance.

import { siteConfig } from "@/content/site.config";
import type { Collection, Product } from "./types";

/** Absolute URL for a site-relative path. Schema.org and Open Graph both
 * require absolute URLs; a relative one is silently ignored by most consumers. */
export function absoluteUrl(path: string): string {
  return new URL(path, siteConfig.brand.url).toString();
}

/**
 * True when a shopper can actually buy this right now.
 *
 * Mirrors `canAddToCart` in ProductDetail.tsx exactly: a product with no
 * in-stock variant renders a disabled "Sold out" button, so claiming
 * InStock here would put the markup at odds with the page — the kind of
 * mismatch that gets rich results suppressed.
 */
export function isPurchasable(product: Product): boolean {
  return product.inStock && product.variants.some((variant) => variant.inStock);
}

export function productJsonLd(product: Product) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || siteConfig.brand.description,
    sku: product.variants[0]?.sku || product.slug,
    ...(product.images.length > 0 && { image: product.images.map((image) => image.url) }),
    ...(product.brand && { brand: { "@type": "Brand", name: product.brand } }),
    ...(product.material && { material: product.material }),
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/products/${product.slug}`),
      price: product.price.toFixed(2),
      priceCurrency: product.currency,
      availability: isPurchasable(product)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };
}

export function collectionJsonLd(collection: Collection, products: Product[]) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: collection.name,
    description: collection.description || collection.seoDescription,
    url: absoluteUrl(`/collections/${collection.slug}`),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: products.length,
      itemListElement: products.map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(`/products/${product.slug}`),
        name: product.name,
      })),
    },
  };
}

/** `trail` is ordered root-first, e.g. [{name:"Home",path:"/"}, …]. */
export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

export function organizationJsonLd() {
  const { brand, footer } = siteConfig;
  // Only real profile URLs. The configured socials are still placeholders
  // (https://instagram.com, https://wa.me/) — pointing sameAs at a network's
  // bare homepage asserts an identity that isn't ours, so drop anything
  // without a real path.
  const sameAs = footer.socials
    .map((social) => social.href)
    .filter((href) => {
      try {
        return new URL(href).pathname.replace(/\/+$/, "").length > 0;
      } catch {
        return false;
      }
    });

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brand.name,
    url: brand.url,
    description: brand.description,
    logo: absoluteUrl(brand.logo.srcLarge),
    ...(sameAs.length > 0 && { sameAs }),
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.brand.name,
    url: siteConfig.brand.url,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: absoluteUrl("/search?q={search_term_string}"),
      },
      "query-input": "required name=search_term_string",
    },
  };
}

// readonly: siteConfig is declared `as const`, so its authored FAQs arrive as a
// readonly tuple while the admin override arrives as a mutable array.
export function faqJsonLd(faqs: readonly { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };
}
