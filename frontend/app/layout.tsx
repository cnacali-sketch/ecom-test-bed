import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "@fontsource-variable/fraunces";
// The base import above ships font-style:normal only, so every italic
// display heading up to now has been browser-synthesized (skewed) oblique.
// The new design uses real italic Fraunces for headings throughout.
import "@fontsource-variable/fraunces/wght-italic.css";
import "@fontsource-variable/archivo";
import { ConsentBanner } from "@/components/analytics/ConsentBanner";
import { PageViewTracker } from "@/components/analytics/PageViewTracker";
import { AddedToast } from "@/components/layout/AddedToast";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { JsonLd } from "@/components/seo/JsonLd";
import { siteConfig } from "@/content/site.config";
import { fetchHomepageContent } from "@/lib/api";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { AuthProvider } from "@/lib/auth-context";
import { CartProvider } from "@/lib/cart-context";
import { WishlistProvider } from "@/lib/wishlist-context";
import "./globals.css";

// Previously force-dynamic here (see git history) so an admin's Homepage
// editor save would reach visitors without a full rebuild. That worked but
// meant NOTHING was ever cached — every page view did a live SSR round-trip,
// measured live to cost 15-30s under real network conditions. Swapped for
// fetchHomepageContent()'s own revalidate: 30 (lib/api.ts): pages cache
// normally again, an admin edit shows up within ~30s instead of instantly.

// Typefaces: Fraunces (display serif, echoes the gold-script logo) +
// Archivo (grotesk body/UI), self-hosted via @fontsource-variable so
// builds never depend on Google Fonts at compile time. To re-typeset
// the store: install another @fontsource-variable package, swap the
// imports above, and update --font-* in app/globals.css.

/** Site-ownership tokens for Search Console / Meta Business / Pinterest /
 * Bing. Each is omitted while blank, so no empty meta tags ship before the
 * accounts are actually connected — fill them in content/site.config.ts under
 * seo.verification and they appear with no code change. */
function siteVerification(): Metadata["verification"] {
  const { google, facebook, pinterest, bing } = siteConfig.seo.verification;
  const other: Record<string, string> = {};
  if (facebook) other["facebook-domain-verification"] = facebook;
  if (pinterest) other["p:domain_verify"] = pinterest;
  if (bing) other["msvalidate.01"] = bing;

  const verification: Metadata["verification"] = {};
  if (google) verification.google = google;
  if (Object.keys(other).length > 0) verification.other = other;
  return verification;
}

export const metadata: Metadata = {
  // metadataBase is what lets every child page hand Next a relative OG image
  // path and still emit the absolute URL that crawlers require.
  metadataBase: new URL(siteConfig.brand.url),
  title: {
    default: `${siteConfig.brand.name} — ${siteConfig.brand.tagline}`,
    template: `%s — ${siteConfig.brand.name}`,
  },
  description: siteConfig.brand.description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: siteConfig.brand.name,
    locale: siteConfig.brand.locale.replace("-", "_"),
    url: siteConfig.brand.url,
    title: `${siteConfig.brand.name} — ${siteConfig.brand.tagline}`,
    description: siteConfig.brand.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.brand.name} — ${siteConfig.brand.tagline}`,
    description: siteConfig.brand.description,
  },
  icons: { icon: siteConfig.brand.logo.src, apple: siteConfig.brand.logo.src },
  verification: siteVerification(),
};

// viewport-fit=cover lets the layout extend under the notch / gesture bar so
// env(safe-area-inset-*) padding on sticky bars actually resolves to > 0.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const homepageContent = await fetchHomepageContent();
  return (
    <html
      lang={siteConfig.brand.locale.split("-")[0]}
      className="h-full antialiased"
    >
      <body className="flex min-h-full flex-col">
        {/* Site-wide identity + the search action that lets Google offer a
            sitelinks search box. Emitted once here, not per page. */}
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={websiteJsonLd()} />
        <AuthProvider>
          <WishlistProvider>
            <CartProvider>
              <PageViewTracker />
              <Header
                announcementOverride={{
                  enabled: homepageContent?.announcement_enabled ?? null,
                  messages: homepageContent?.announcement_messages ?? null,
                }}
              />
              <main className="flex-1">{children}</main>
              <Footer />
              <CartDrawer />
              <AddedToast />
              <ConsentBanner />
            </CartProvider>
          </WishlistProvider>
        </AuthProvider>
        <Script
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token": "4ca450c993164d0aab91be3ef4491f83"}'
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
