/**
 * Which homepage sections render, and in what order.
 *
 * The homepage was a fixed sequence of components in `app/page.tsx`. The admin
 * could edit every word inside them and could not move any of them, or turn any
 * of them off -- and five of the six rendered unconditionally, so "remove the
 * campaign band" meant blanking every field and being left with an empty
 * styled band rather than nothing.
 *
 * The order lives in the content document like everything else, so a second
 * storefront built against `GET /api/content/site` gets it for free.
 */

/**
 * Every section the homepage knows how to render, in the order it shipped.
 *
 * This list is the authority, not the stored layout. A saved layout is a
 * *preference* expressed against it, which is what makes the two rules in
 * `resolveLayout` necessary rather than defensive.
 */
export const HOME_SECTIONS = [
  "hero",
  "quickCtas",
  "newIn",
  "ranges",
  "campaign",
  "editorial",
  "seo",
] as const;

export type HomeSectionId = (typeof HOME_SECTIONS)[number];

export type HomeLayoutEntry = {
  id: HomeSectionId;
  visible: boolean;
};

/** Human labels for the admin builder. Kept beside the ids so adding a section
 * in one place cannot leave the other half unnamed. */
export const HOME_SECTION_LABELS: Record<HomeSectionId, string> = {
  hero: "Hero banner",
  quickCtas: "Quick links",
  newIn: "New in",
  ranges: "Shop by range",
  campaign: "Campaign band",
  editorial: "Editorial tiles",
  seo: "SEO copy",
};

export const DEFAULT_HOME_LAYOUT: HomeLayoutEntry[] = HOME_SECTIONS.map((id) => ({
  id,
  visible: true,
}));

const KNOWN = new Set<string>(HOME_SECTIONS);

function isSectionId(value: unknown): value is HomeSectionId {
  return typeof value === "string" && KNOWN.has(value);
}

/**
 * The layout to render, from whatever the document happens to hold.
 *
 * Four rules, each of them a decision about a way this can go wrong once the
 * code and a saved layout have drifted apart:
 *
 * **An unknown id is dropped.** A section deleted from the code must not take
 * the homepage down because somebody's saved layout still names it.
 *
 * **A missing id is appended, visible.** This is the important one. A section
 * *added* to the code would otherwise be invisible on every shop that had ever
 * saved a layout -- the feature would ship, the page would not change, and
 * nothing would report an error. Appending means a new section shows up at the
 * bottom and can be moved, rather than silently not existing.
 *
 * **A duplicate collapses to its first appearance**, so a section cannot render
 * twice and cannot be half-hidden by its own second entry.
 *
 * **Anything unparseable falls back to the shipped order** -- the same
 * structural fallback `lib/site-content.ts` uses, for the same reason: a stale
 * layout is recoverable and a blank homepage is not.
 */
export function resolveLayout(stored: unknown): HomeLayoutEntry[] {
  if (!Array.isArray(stored)) return DEFAULT_HOME_LAYOUT;

  const seen = new Set<HomeSectionId>();
  const resolved: HomeLayoutEntry[] = [];

  for (const entry of stored) {
    if (typeof entry !== "object" || entry === null) continue;
    const { id, visible } = entry as { id?: unknown; visible?: unknown };
    if (!isSectionId(id) || seen.has(id)) continue;
    seen.add(id);
    // Absent `visible` reads as shown. A layout that named a section at all
    // meant to place it, and defaulting to hidden would make a malformed entry
    // delete part of the page.
    resolved.push({ id, visible: visible === undefined ? true : Boolean(visible) });
  }

  for (const id of HOME_SECTIONS) {
    if (!seen.has(id)) resolved.push({ id, visible: true });
  }

  return resolved;
}

/**
 * A layout as a URL-safe string, for the admin's preview iframe.
 *
 * `hero:1,quickCtas:0,...` rather than JSON or base64 on purpose: it survives a
 * URL without escaping, it is readable in the address bar when the preview
 * looks wrong, and it cannot carry anything but section ids and a flag.
 */
export function encodeLayout(layout: HomeLayoutEntry[]): string {
  return layout.map((entry) => `${entry.id}:${entry.visible ? 1 : 0}`).join(",");
}

/** Read back what `encodeLayout` wrote, through the same rules as a stored one. */
export function decodeLayout(encoded: string | undefined | null): HomeLayoutEntry[] {
  if (!encoded) return DEFAULT_HOME_LAYOUT;
  return resolveLayout(
    encoded.split(",").map((part) => {
      const [id, flag] = part.split(":");
      return { id, visible: flag !== "0" };
    }),
  );
}
