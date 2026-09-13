"use client";

/**
 * The site content, for components that run in the browser.
 *
 * Server components call `getSiteContent()` directly. Client components cannot
 * — they have no `await` and no server fetch — so the already-merged document
 * is handed down from `app/layout.tsx`, which is an async Server Component and
 * already resolves it there.
 *
 * This replaces a workaround rather than adding a new one. `Header` needed the
 * announcement ribbon, so `layout.tsx` threaded a bespoke `announcementOverride`
 * prop into it for that one field. Every other piece of live content a client
 * component wanted would have needed its own prop of the same kind.
 */
import { createContext, useContext } from "react";

import { siteConfig } from "@/content/site.config";
import type { SiteContent } from "./site-content";

const SiteContentContext = createContext<SiteContent | null>(null);

export function SiteContentProvider({
  value,
  children,
}: {
  value: SiteContent;
  children: React.ReactNode;
}) {
  return <SiteContentContext.Provider value={value}>{children}</SiteContentContext.Provider>;
}

/**
 * The live content, or the shipped copy when there is no provider above.
 *
 * Deliberately unlike `useAuth`, which throws when used outside its provider.
 * Being logged out is a state the app must handle explicitly; missing content
 * is not — there is always an answer, because `site.config.ts` is bundled. A
 * component rendered in a test, in isolation, or in some future tree that
 * forgot the provider should render the shop's real copy rather than crash the
 * page it sits on.
 *
 * The value is a plain object of strings, arrays and nested objects, so it
 * crosses the server/client boundary without any serialisation work.
 */
export function useSiteContent(): SiteContent {
  return useContext(SiteContentContext) ?? siteConfig;
}
