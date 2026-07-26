import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/archivo";
import { ConsentBanner } from "@/components/analytics/ConsentBanner";
import { PageViewTracker } from "@/components/analytics/PageViewTracker";
import { AddedToast } from "@/components/layout/AddedToast";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { siteConfig } from "@/content/site.config";
import { fetchHomepageContent } from "@/lib/api";
import { AuthProvider } from "@/lib/auth-context";
import { CartProvider } from "@/lib/cart-context";
import { WishlistProvider } from "@/lib/wishlist-context";
import "./globals.css";

// Without this, Next prerenders every page with no dynamic API (most of the
// site) once at build time and serves that same snapshot to every visitor
// afterward — a plain `fetch()` with no cache directive doesn't force
// per-request rendering on its own. That silently broke live-editability:
// an admin's Homepage editor save (GET /api/sections, fetched here) would
// never reach a real visitor without a full rebuild + redeploy. Forcing the
// whole tree dynamic is the correct tradeoff for a live storefront with an
// admin CMS — the alternative (leaving pages static) means admin edits
// don't take effect, which is a correctness bug, not a performance one.
export const dynamic = "force-dynamic";

// Typefaces: Fraunces (display serif, echoes the gold-script logo) +
// Archivo (grotesk body/UI), self-hosted via @fontsource-variable so
// builds never depend on Google Fonts at compile time. To re-typeset
// the store: install another @fontsource-variable package, swap the
// imports above, and update --font-* in app/globals.css.

export const metadata: Metadata = {
  title: `${siteConfig.brand.name} — ${siteConfig.brand.tagline}`,
  description: siteConfig.brand.description,
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
