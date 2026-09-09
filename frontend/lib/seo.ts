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

/** Stable @id anchors so Organization / WebSite / Product form one linked
 * graph instead of four disconnected islands. Google follows these to
 * attribute a product to the selling organisation. */
export const ORG_ID = `${siteConfig.brand.url}/#organization`;
export const SITE_ID = `${siteConfig.brand.url}/#website`;

/** Google requires an explicit validity date on merchant offers; without one
 * it may treat the price as indefinitely valid and flag a mismatch later.
 * A rolling year is the conventional answer for a store with no scheduled
 * price changes. */
function priceValidUntil(): string {
  const oneYearOut = new Date();
  oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);
  return oneYearOut.toISOString().split("T")[0];
}

/** Return policy, from the same 15-day window the trust badges and the
 * Returns page state. */
function returnPolicy() {
  const { merchant } = siteConfig.seo;
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: merchant.shipsToCountry,
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: merchant.returnDays,
    returnMethod: "https://schema.org/ReturnByMail",
    returnFees: "https://schema.org/FreeReturn",
  };
}

/**
 * Delivery terms — omitted entirely unless a real shipping rate is configured.
 *
 * Google suspends merchant listings when structured data disagrees with the
 * actual offer, so publishing a guessed rate is strictly worse than
 * publishing nothing. Set seo.merchant.shippingRate to switch this on.
 */
function shippingDetails() {
  const { merchant } = siteConfig.seo;
  if (merchant.shippingRate === null) return undefined;
  return {
    "@type": "OfferShippingDetails",
    shippingRate: {
      "@type": "MonetaryAmount",
      value: merchant.shippingRate,
      currency: siteConfig.brand.currency,
    },
    shippingDestination: {
      "@type": "DefinedRegion",
      addressCountry: merchant.shipsToCountry,
    },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: {
        "@type": "QuantitativeValue",
        minValue: merchant.handlingDays.min,
        maxValue: merchant.handlingDays.max,
        unitCode: "DAY",
      },
      transitTime: {
        "@type": "QuantitativeValue",
        minValue: merchant.transitDays.min,
        maxValue: merchant.transitDays.max,
        unitCode: "DAY",
      },
    },
  };
}

export function productJsonLd(product: Product) {
  const shipping = shippingDetails();
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": absoluteUrl(`/products/${product.slug}#product`),
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
      priceValidUntil: priceValidUntil(),
      availability: isPurchasable(product)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": ORG_ID },
      hasMerchantReturnPolicy: returnPolicy(),
      ...(shipping && { shippingDetails: shipping }),
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

  const { address, phone, email } = siteConfig.contact;

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name: brand.name,
    url: brand.url,
    description: brand.description,
    logo: absoluteUrl(brand.logo.srcLarge),
    email,
    telephone: phone,
    // The real studio address, already published on /contact and in the
    // policies — it is what lets Google associate the store with a place.
    address: {
      "@type": "PostalAddress",
      streetAddress: [address.line1, address.line2].filter(Boolean).join(", "),
      addressLocality: address.city,
      addressRegion: address.state,
      postalCode: address.postcode,
      addressCountry: siteConfig.seo.merchant.shipsToCountry,
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email,
      telephone: phone,
      areaServed: siteConfig.seo.merchant.shipsToCountry,
      availableLanguage: ["en"],
    },
    ...(sameAs.length > 0 && { sameAs }),
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": SITE_ID,
    name: siteConfig.brand.name,
    url: siteConfig.brand.url,
    publisher: { "@id": ORG_ID },
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
