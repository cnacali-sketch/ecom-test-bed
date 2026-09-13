import { describe, expect, test } from "vitest";

import { moveEntry } from "./reorder";

/**
 * Reordering is the whole feature for four admin lists and the homepage
 * layout, so the ends and the no-mutation rule matter more than the happy path.
 */

describe("moveEntry", () => {
  test("moves an item down", () => {
    expect(moveEntry(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
  });

  test("moves an item up", () => {
    expect(moveEntry(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
  });

  test("up then down returns the original order", () => {
    const start = ["a", "b", "c", "d"];

    expect(moveEntry(moveEntry(start, 2, -1), 1, 1)).toEqual(start);
  });

  test("the ends do nothing rather than wrapping", () => {
    /** A list that teleports its first item to the bottom on one press too
     * many is a worse answer than one that does nothing. */
    expect(moveEntry(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moveEntry(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });

  test("the original array is not mutated", () => {
    const start = ["a", "b"];
    moveEntry(start, 0, 1);

    expect(start).toEqual(["a", "b"]);
  });
});
