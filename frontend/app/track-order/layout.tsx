import type { Metadata } from "next";

// Metadata lives in this layout, not in page.tsx: every one of these pages is
// a Client Component ("use client"), and Next silently ignores a `metadata`
// export there. A sibling server-component layout is the supported way to
// give a client page real <head> tags.
export const metadata: Metadata = {
  title: "Track your order",
  description: "Look up the status of a Savvy In Teal order with your order number.",
  alternates: { canonical: "/track-order" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
