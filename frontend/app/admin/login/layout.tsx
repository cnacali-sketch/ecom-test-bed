import type { Metadata } from "next";

// Metadata lives in this layout, not in page.tsx: every one of these pages is
// a Client Component ("use client"), and Next silently ignores a `metadata`
// export there. A sibling server-component layout is the supported way to
// give a client page real <head> tags.
// Private surface: nothing here belongs in a search result, and some of it is
// per-account. noindex is the actual guarantee; robots.txt only asks politely
// and does not stop a URL being indexed if something links to it.
export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
