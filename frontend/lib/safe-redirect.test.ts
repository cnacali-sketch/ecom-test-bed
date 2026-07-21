import { describe, expect, test } from "vitest";

import { safeRedirectPath } from "./safe-redirect";

const FALLBACK = "/account";

describe("safeRedirectPath", () => {
  test("allows a same-site absolute path", () => {
    expect(safeRedirectPath("/orders", FALLBACK)).toBe("/orders");
  });

  test("allows a path with a query string", () => {
    expect(safeRedirectPath("/orders?page=2", FALLBACK)).toBe("/orders?page=2");
  });

  test("falls back when next is absent", () => {
    expect(safeRedirectPath(null, FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectPath("", FALLBACK)).toBe(FALLBACK);
  });

  test.each([
    ["https://evil.example", "absolute URL"],
    ["http://evil.example", "absolute URL"],
    ["//evil.example", "protocol-relative URL"],
    ["/\\evil.example", "backslash variant browsers normalise to //"],
    ["javascript:alert(1)", "javascript scheme"],
    ["evil.example", "bare host"],
  ])("refuses %s (%s)", (candidate) => {
    expect(safeRedirectPath(candidate, FALLBACK)).toBe(FALLBACK);
  });
});
