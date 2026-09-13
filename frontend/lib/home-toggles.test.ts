import { describe, expect, test } from "vitest";

import { ALL_SHOWN, HOME_TOGGLES, resolveToggles } from "./home-toggles";

/**
 * These decide whether parts of a live homepage render. The asymmetry is the
 * whole design: wrongly showing something gets noticed and switched off,
 * wrongly hiding something is a silently missing piece of the page that nobody
 * reports. So everything except an explicit `false` must read as shown.
 */

describe("resolveToggles", () => {
  test("an explicit false hides that piece and nothing else", () => {
    const resolved = resolveToggles({ heroCta: false });

    expect(resolved.heroCta).toBe(false);
    expect(resolved.heroSecondImage).toBe(true);
    expect(resolved.seoFaqs).toBe(true);
  });

  test("a toggle the document has never heard of is shown", () => {
    /** The rule that matters. A toggle added in code against a document saved
     * before it existed would otherwise hide that part of the page on deploy —
     * the build would succeed and the section would just be gone. */
    const savedBeforeToggles = {};

    expect(resolveToggles(savedBeforeToggles)).toEqual(ALL_SHOWN);
  });

  test.each([
    ["null", null],
    ["undefined", undefined],
    ["an array", []],
    ["a string", "heroCta"],
    ["a number", 7],
  ])("%s falls back to showing everything", (_label, value) => {
    expect(resolveToggles(value)).toEqual(ALL_SHOWN);
  });

  test.each([
    ["0", 0],
    ["an empty string", ""],
    ["null", null],
    ["the string 'false'", "false"],
  ])("%s does not hide anything — only a real false does", (_label, value) => {
    /** Falsy is not the same as off. A hand-edited document holding 0 or "" must
     * not silently delete part of the page. */
    expect(resolveToggles({ heroCta: value }).heroCta).toBe(true);
  });

  test("every toggle is always present, whatever went in", () => {
    for (const input of [null, {}, { nope: false }, "junk"]) {
      const resolved = resolveToggles(input);
      expect(Object.keys(resolved).sort()).toEqual([...HOME_TOGGLES].sort());
    }
  });
});
