/**
 * Which optional pieces *inside* a homepage section render.
 *
 * The layout builder decides whether a whole section appears. This is the
 * level below: the parts within a section that a shop may or may not want,
 * where "just blank the text" either does not work or leaves a hole.
 *
 * Each of these exists because hiding it was previously impossible or ugly:
 *
 * - **heroSecondImage** — the hero is a two-column grid. Blanking the URL does
 *   not hide the image, it breaks it. Hidden, the grid collapses to one column
 *   so the remaining image fills the width rather than leaving dead space.
 * - **heroCta / campaignCta** — neither button is conditional on its label, so
 *   clearing the text renders an EMPTY button. That is a bug you can only work
 *   around by leaving copy you did not want.
 * - **seoCategories / seoFaqs** — self-contained blocks with their own
 *   headings. Emptying their lists leaves the heading behind.
 *
 * Absent means shown, for the same reason `resolveLayout` appends unknown
 * sections visible: a stored document written before a toggle existed must not
 * make that part of the page vanish on deploy.
 */

export const HOME_TOGGLES = [
  "heroSecondImage",
  "heroCta",
  "campaignCta",
  "seoCategories",
  "seoFaqs",
] as const;

export type HomeToggleId = (typeof HOME_TOGGLES)[number];
export type HomeToggles = Record<HomeToggleId, boolean>;

/** Human labels for the admin. Kept beside the ids so adding one cannot leave
 * the other half unnamed. */
export const HOME_TOGGLE_LABELS: Record<HomeToggleId, string> = {
  heroSecondImage: "Show the second hero image",
  heroCta: "Show the hero button",
  campaignCta: "Show the campaign button",
  seoCategories: "Show the category blurbs",
  seoFaqs: "Show the FAQ list",
};

export const ALL_SHOWN: HomeToggles = HOME_TOGGLES.reduce(
  (acc, id) => ({ ...acc, [id]: true }),
  {} as HomeToggles,
);

/**
 * Read the toggles out of whatever the document happens to hold.
 *
 * Only an explicit `false` hides anything. Every other value — absent, null,
 * a string, a number left by a hand-edit — reads as shown. That asymmetry is
 * deliberate: the cost of wrongly showing something is that a shop sees a
 * section it meant to hide and switches it off again, while the cost of
 * wrongly hiding is a silently missing piece of a live page that nobody
 * reports.
 */
export function resolveToggles(stored: unknown): HomeToggles {
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return ALL_SHOWN;

  const source = stored as Record<string, unknown>;
  return HOME_TOGGLES.reduce(
    (acc, id) => ({ ...acc, [id]: source[id] !== false }),
    {} as HomeToggles,
  );
}
