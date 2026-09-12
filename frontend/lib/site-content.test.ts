import { describe, expect, test } from "vitest";

import { siteConfig } from "@/content/site.config";
import { mergeSiteContent } from "./site-content";

/**
 * Every page of the storefront renders through this merge, so its failure mode
 * is "the shop shows the wrong thing" rather than an error anybody sees. The
 * cases below are the ways a live document can disagree with the config it is
 * being laid over.
 */

describe("falling back", () => {
  test("an unreachable API leaves the shipped content untouched", () => {
    /** The most important case. `fetchSiteContent` returns null when the
     * backend cannot be reached, and the storefront has to keep rendering. */
    expect(mergeSiteContent(undefined)).toEqual(siteConfig);
    expect(mergeSiteContent(null)).toEqual(siteConfig);
  });

  test("an empty document changes nothing", () => {
    expect(mergeSiteContent({})).toEqual(siteConfig);
  });

  test("a section the document omits keeps its shipped copy", () => {
    /** The admin has never opened the footer editor; the footer still renders. */
    const merged = mergeSiteContent({ brand: { name: "Renamed" } });

    expect(merged.brand.name).toBe("Renamed");
    expect(merged.footer).toEqual(siteConfig.footer);
    expect(merged.policies).toEqual(siteConfig.policies);
  });

  test("a field the document omits within an edited section keeps its default", () => {
    const merged = mergeSiteContent({ brand: { name: "Renamed" } });

    expect(merged.brand.url).toBe(siteConfig.brand.url);
    expect(merged.brand.tagline).toBe(siteConfig.brand.tagline);
  });
});

describe("overriding", () => {
  test("a live value wins over the shipped one", () => {
    const merged = mergeSiteContent({
      home: { hero: { headline: "A new headline" } },
    });

    expect(merged.home.hero.headline).toBe("A new headline");
  });

  test("nesting is followed rather than flattened", () => {
    /** Replacing `home` wholesale would drop quickCtas, campaign and the rest
     * the moment somebody edited one hero field. */
    const merged = mergeSiteContent({
      home: { hero: { headline: "Changed" } },
    });

    expect(merged.home.quickCtas).toEqual(siteConfig.home.quickCtas);
    expect(merged.home.hero.image).toBe(siteConfig.home.hero.image);
  });

  test("an empty string is a real edit, not an absence", () => {
    /** `taxLine` is documented as "empty string hides it". Treating "" as
     * missing would make that setting impossible to express. */
    expect(mergeSiteContent({ brand: { taxLine: "" } }).brand.taxLine).toBe("");
  });

  test("false is a real edit too", () => {
    /** Turning the announcement ribbon off is the whole point of the flag. */
    const merged = mergeSiteContent({ announcement: { enabled: false } });

    expect(merged.announcement.enabled).toBe(false);
  });
});

describe("arrays replace rather than blend", () => {
  test("a shorter live list does not leave stale entries behind", () => {
    /** Merging index by index would keep the tail of the default: a live nav
     * of two would render five, with three items no admin screen can see or
     * remove. */
    const merged = mergeSiteContent({
      announcement: { messages: ["Only this one"] },
    });

    expect(merged.announcement.messages).toEqual(["Only this one"]);
  });

  test("an empty live list means the shop deleted everything", () => {
    expect(mergeSiteContent({ trustBadges: [] }).trustBadges).toEqual([]);
  });

  test("a list of objects is taken whole", () => {
    const merged = mergeSiteContent({
      home: { quickCtas: [{ label: "One", href: "/one", image: "/a.webp" }] },
    });

    expect(merged.home.quickCtas).toHaveLength(1);
    expect(merged.home.quickCtas[0].label).toBe("One");
  });
});

describe("refusing a value of the wrong kind", () => {
  test("an object where the config expects a string is ignored", () => {
    /** Taking it would render "[object Object]" on a live page. A stale
     * headline is recoverable; a broken render is not. */
    const merged = mergeSiteContent({ brand: { name: { oops: true } } });

    expect(merged.brand.name).toBe(siteConfig.brand.name);
  });

  test("a string where the config expects an array is ignored", () => {
    /** Otherwise the next `.map` throws and takes the page down. */
    const merged = mergeSiteContent({ nav: "not-an-array" });

    expect(merged.nav).toEqual(siteConfig.nav);
  });

  test("a number where the config expects a string is ignored", () => {
    expect(mergeSiteContent({ brand: { tagline: 42 } }).brand.tagline).toBe(
      siteConfig.brand.tagline,
    );
  });

  test("a scalar where the config expects an object is ignored", () => {
    const merged = mergeSiteContent({ brand: "nonsense" });

    expect(merged.brand).toEqual(siteConfig.brand);
  });
});

describe("what the document adds", () => {
  test("a key the config does not have is not invented", () => {
    /** The returned value claims to be the config's type. Copying unknown keys
     * onto it would make that claim false, and nothing typed could read them
     * anyway. */
    const merged = mergeSiteContent({ somethingNew: { a: 1 } }) as Record<string, unknown>;

    expect(merged.somethingNew).toBeUndefined();
  });

  test("the config object itself is never mutated", () => {
    /** It is a module singleton shared by every render on the server. */
    const before = siteConfig.brand.name;

    mergeSiteContent({ brand: { name: "Temporary" } });

    expect(siteConfig.brand.name).toBe(before);
  });
});
