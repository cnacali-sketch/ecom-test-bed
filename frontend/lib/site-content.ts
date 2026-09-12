/**
 * The shop's content, live from the API, shaped exactly like the config file.
 *
 * `GET /api/content/site` has served the whole document since the content was
 * moved into the database -- brand, navigation, footer, policy copy, homepage,
 * SEO defaults -- and nothing consumed it. Twenty files still imported
 * `content/site.config.ts` directly, so an admin could edit a headline, the
 * database would change, and the storefront would go on rendering the file.
 *
 * The API returns `document: Record<string, unknown>`. Handing that to twenty
 * call sites would mean twenty narrowing casts and twenty chances of a runtime
 * error on a live storefront, so it is narrowed once, here, and everything
 * downstream keeps the config object's own type.
 *
 * `site.config.ts` is now what it should always have been: the offline
 * fallback. Merging *over* it rather than replacing it is what makes the
 * failure modes boring -- an unreachable API, a half-filled document, a
 * section nobody has ever edited all resolve to the shipped copy.
 */
import { cache } from "react";

import { siteConfig } from "@/content/site.config";
import { fetchSiteContent } from "./api";

export type SiteContent = typeof siteConfig;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Overlay `override` onto `base`, keeping `base`'s shape.
 *
 * Three rules, each of them a decision rather than an accident:
 *
 * **Only keys that exist in the config are read.** The config is what the
 * storefront's types are built from, so a key the document adds could not be
 * rendered by typed code anyway. Iterating the base keeps the returned value
 * honestly the shape it claims to be.
 *
 * **Arrays replace; they never blend.** Merging a live three-entry `nav` into
 * a five-entry default would produce a menu nobody authored, with two stale
 * items no admin screen can see or remove.
 *
 * **A value of a different kind is refused.** If the config says a field is a
 * string and the document offers an object, taking it would put `[object
 * Object]` on a page -- or crash a `.map`. The shipped value is used instead,
 * because a stale headline is recoverable and a broken render is not.
 */
function merge<T>(base: T, override: unknown): T {
  if (override === undefined || override === null) return base;

  if (Array.isArray(base)) {
    return (Array.isArray(override) ? override : base) as T;
  }

  if (isPlainObject(base)) {
    if (!isPlainObject(override)) return base;
    const out: Record<string, unknown> = { ...base };
    for (const key of Object.keys(base as Record<string, unknown>)) {
      out[key] = merge((base as Record<string, unknown>)[key], override[key]);
    }
    return out as T;
  }

  return (typeof override === typeof base ? override : base) as T;
}

/** Exported for its tests: the merge rules are the whole substance here. */
export const mergeSiteContent = (override: unknown): SiteContent =>
  merge(siteConfig, override);

/**
 * The content to render, live where the shop has edited it.
 *
 * `cache()` for the same reason `fetchHomepageContent` uses it: every server
 * component that needs content calls this independently, and without it a
 * single page render would make one backend request per section.
 */
export const getSiteContent = cache(async (): Promise<SiteContent> => {
  const live = await fetchSiteContent();
  return mergeSiteContent(live?.document);
});
