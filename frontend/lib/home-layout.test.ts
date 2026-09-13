import { describe, expect, test } from "vitest";

import {
  DEFAULT_HOME_LAYOUT,
  HOME_SECTIONS,
  decodeLayout,
  encodeLayout,
  resolveLayout,
} from "./home-layout";

/**
 * The layout decides what a visitor sees. Everything here is about the gap
 * between what the code knows and what somebody saved months ago -- which is
 * the only way this breaks, and it breaks silently.
 */

const ids = (layout: { id: string }[]) => layout.map((entry) => entry.id);

describe("resolveLayout", () => {
  test("a saved order is honoured", () => {
    const saved = [
      { id: "campaign", visible: true },
      { id: "hero", visible: true },
      ...HOME_SECTIONS.filter((id) => id !== "campaign" && id !== "hero").map((id) => ({
        id,
        visible: true,
      })),
    ];

    expect(ids(resolveLayout(saved))).toEqual([
      "campaign",
      "hero",
      "quickCtas",
      "newIn",
      "ranges",
      "editorial",
      "seo",
    ]);
  });

  test("hidden stays hidden", () => {
    const resolved = resolveLayout([{ id: "campaign", visible: false }]);

    expect(resolved.find((entry) => entry.id === "campaign")?.visible).toBe(false);
  });

  test("a section the code no longer has is dropped", () => {
    /** Otherwise deleting a component means every shop with a saved layout
     * renders a section that does not exist. */
    const resolved = resolveLayout([
      { id: "hero", visible: true },
      { id: "instagramWall", visible: true },
    ]);

    expect(ids(resolved)).not.toContain("instagramWall");
    expect(ids(resolved)).toContain("hero");
  });

  test("a section the saved layout has never heard of is added, visible", () => {
    /** The rule that matters most. A new section shipped against an old saved
     * layout would otherwise be invisible on the live shop -- the deploy would
     * succeed, the page would not change, and nothing would say why. */
    const savedBeforeSeoExisted = HOME_SECTIONS.filter((id) => id !== "seo").map((id) => ({
      id,
      visible: true,
    }));

    const resolved = resolveLayout(savedBeforeSeoExisted);

    expect(ids(resolved)).toContain("seo");
    expect(resolved.find((entry) => entry.id === "seo")?.visible).toBe(true);
  });

  test("an appended section goes last, not first", () => {
    /** Appending is the safe end: a section nobody has positioned yet should
     * not push itself above the hero. */
    const resolved = resolveLayout([{ id: "campaign", visible: true }]);

    expect(resolved[0].id).toBe("campaign");
  });

  test("a duplicate collapses to its first appearance", () => {
    const resolved = resolveLayout([
      { id: "hero", visible: true },
      { id: "hero", visible: false },
    ]);

    expect(resolved.filter((entry) => entry.id === "hero")).toHaveLength(1);
    expect(resolved[0].visible).toBe(true);
  });

  test("an entry with no visible flag is shown", () => {
    /** It was named, so it was meant to be placed. Defaulting to hidden would
     * let one malformed entry delete part of the page. */
    const resolved = resolveLayout([{ id: "hero" }]);

    expect(resolved.find((entry) => entry.id === "hero")?.visible).toBe(true);
  });

  test.each([
    ["null", null],
    ["undefined", undefined],
    ["an object", { hero: true }],
    ["a string", "hero,campaign"],
    ["a number", 7],
  ])("%s falls back to the shipped order", (_label, value) => {
    expect(resolveLayout(value)).toEqual(DEFAULT_HOME_LAYOUT);
  });

  test("an empty array resolves to every section, visible", () => {
    /** Not an empty page. An empty list is "nothing positioned", and every
     * section is then appended by the rule above. */
    expect(resolveLayout([])).toEqual(DEFAULT_HOME_LAYOUT);
  });

  test("junk entries are skipped without taking the rest with them", () => {
    const resolved = resolveLayout([null, 5, { id: "campaign", visible: false }, "hero"]);

    expect(resolved[0]).toEqual({ id: "campaign", visible: false });
    expect(resolved).toHaveLength(HOME_SECTIONS.length);
  });

  test("every section always appears exactly once, whatever went in", () => {
    /** The invariant the renderer depends on: it maps this list straight to
     * components, so a missing or repeated id is a missing or repeated
     * section on a live shop. */
    for (const input of [[], null, [{ id: "hero" }, { id: "hero" }], [{ id: "nope" }]]) {
      const resolved = resolveLayout(input);
      expect(new Set(ids(resolved)).size).toBe(HOME_SECTIONS.length);
    }
  });
});

describe("encode / decode", () => {
  test("a layout survives the round trip", () => {
    const layout = resolveLayout([
      { id: "campaign", visible: false },
      { id: "hero", visible: true },
    ]);

    expect(decodeLayout(encodeLayout(layout))).toEqual(layout);
  });

  test("the encoding is URL-safe as written", () => {
    const encoded = encodeLayout(DEFAULT_HOME_LAYOUT);

    expect(encodeURIComponent(encoded)).toBe(encoded.replace(/,/g, "%2C").replace(/:/g, "%3A"));
    expect(encoded).not.toMatch(/[?&#=+ ]/);
  });

  test("an empty or absent param is the shipped order", () => {
    expect(decodeLayout("")).toEqual(DEFAULT_HOME_LAYOUT);
    expect(decodeLayout(undefined)).toEqual(DEFAULT_HOME_LAYOUT);
  });

  test("a hand-mangled param cannot produce a broken page", () => {
    /** This value arrives in a query string, so it is whatever anyone types. */
    const resolved = decodeLayout("hero:1,,garbage,::,campaign:0");

    expect(new Set(ids(resolved)).size).toBe(HOME_SECTIONS.length);
    expect(resolved.find((entry) => entry.id === "campaign")?.visible).toBe(false);
  });
});
