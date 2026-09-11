import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Mirror the `@/*` path alias from tsconfig so tests resolve imports.
//
// The default environment stays `node`: the lib/ suites are pure functions and
// run in a few milliseconds there. Component suites opt into a browser-like
// environment per file with
//
//     /** @vitest-environment jsdom */
//
// at the top, so adding React tests never slows the logic tests down.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
  },
});
