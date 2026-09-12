/**
 * Export content/site.config.ts to JSON for the backend to seed from.
 *
 * The storefront's content has always lived in a 584-line TypeScript file
 * inside the frontend, which is the single thing stopping a second storefront
 * reusing this backend: a new frontend would have to copy that file, and from
 * then on the two would drift.
 *
 * This turns the config into data. The backend seeds a `site` document from
 * the result, and from that point the database is the source of truth -- the
 * JSON is a starting point, not a live dependency. Re-running this after the
 * seed has happened changes nothing in production; it only refreshes the
 * defaults a *fresh* install would begin from.
 *
 * Run:  node scripts/export-site-content.mjs
 *
 * Uses jiti (already a transitive dependency, via Next) to import a TypeScript
 * module from plain node without adding a build step.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url);

const { siteConfig } = await jiti.import(resolve(here, "../content/site.config.ts"));

const out = resolve(here, "../../backend/app/content/site_defaults.json");
mkdirSync(dirname(out), { recursive: true });

// No replacer argument. Passing an array there filters keys at *every* depth
// rather than ordering the top level, which silently cut this file down to a
// handful of stubs the first time it ran. Insertion order is stable and
// matches the order the config is authored in, which is the readable one.
writeFileSync(out, JSON.stringify(siteConfig, null, 2) + "\n", "utf8");

const keys = Object.keys(siteConfig).sort();
console.log(`wrote ${out}`);
console.log(`top-level keys (${keys.length}): ${keys.join(", ")}`);
