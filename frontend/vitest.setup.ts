// Test setup shared by every suite.
//
// The pure-logic tests in lib/ run in Node and the component tests run in
// jsdom (opted into per-file with a `@vitest-environment jsdom` docblock), so
// everything here has to be safe in both. Anything that touches the DOM is
// guarded on `document` existing rather than assumed.
//
// Importing the /vitest entry point rather than /matchers does two jobs at
// once: it registers toBeInTheDocument, toBeDisabled and the rest on `expect`,
// and it augments vitest's Assertion type so `tsc` accepts them. Wiring up
// only the matchers leaves the tests passing but the type-check failing.
import "@testing-library/jest-dom/vitest";

import { afterEach } from "vitest";

afterEach(async () => {
  if (typeof document === "undefined") return;
  // Unmount anything a component test rendered. Without this, one test's
  // markup stays in the document and the next test's getByText finds two
  // matches — a failure that reads as a bug in the component under test.
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});
