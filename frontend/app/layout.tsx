import type { Metadata, Viewport } from "next";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/archivo";
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
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
              <CartDrawer />
            </CartProvider>
          </WishlistProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
