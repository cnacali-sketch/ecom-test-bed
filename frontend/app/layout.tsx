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
import { AuthProvider } from "@/lib/auth-context";
import { CartProvider } from "@/lib/cart-context";
import { WishlistProvider } from "@/lib/wishlist-context";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
              <Header />
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
