/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { siteConfig } from "@/content/site.config";
import type { SiteContent } from "./site-content";
import { SiteContentProvider, useSiteContent } from "./site-content-context";

/**
 * The channel that carries live content into components running in the
 * browser. Its one dangerous property is what happens when it is absent:
 * a client component with no provider above it must still render the shop,
 * not throw and take the page with it.
 */

function ShowsBrand() {
  const { brand } = useSiteContent();
  return <p>{brand.name}</p>;
}

function ShowsFirstNavLabel() {
  const { nav } = useSiteContent();
  return <p>{nav[0]?.label ?? "(no nav)"}</p>;
}

/** A document shaped like the real one, with one field moved.
 *
 * The cast is the point of the test, not a shortcut: `siteConfig.brand.name`
 * is inferred as its own literal type, so a different name is genuinely not
 * assignable to it. The live document is a different string every time the
 * shop edits it, which is exactly what this stands in for. */
function contentWith(name: string): SiteContent {
  return { ...siteConfig, brand: { ...siteConfig.brand, name: name as SiteContent["brand"]["name"] } };
}

test("a component reads the live content from the provider", () => {
  render(
    <SiteContentProvider value={contentWith("Renamed In Teal")}>
      <ShowsBrand />
    </SiteContentProvider>,
  );

  expect(screen.getByText("Renamed In Teal")).toBeInTheDocument();
});

test("without a provider it falls back to the shipped copy instead of throwing", () => {
  /** Deliberately unlike useAuth, which throws outside its provider. Being
   * logged out is a state the app must handle; missing content is not --
   * site.config.ts is bundled, so there is always an answer. A component in a
   * test, or in some future tree that forgot the provider, should render the
   * shop rather than crash the page it sits on. */
  render(<ShowsBrand />);

  expect(screen.getByText(siteConfig.brand.name)).toBeInTheDocument();
});

test("the fallback carries the whole document, not just a stub", () => {
  /** A fallback that resolved to `{}` would satisfy the type and then throw on
   * the first `nav[0]` — the failure would move rather than disappear. */
  render(<ShowsFirstNavLabel />);

  expect(screen.getByText(siteConfig.nav[0].label)).toBeInTheDocument();
});

test("nested components all see the same value", () => {
  render(
    <SiteContentProvider value={contentWith("Shared")}>
      <div>
        <ShowsBrand />
      </div>
    </SiteContentProvider>,
  );

  expect(screen.getByText("Shared")).toBeInTheDocument();
});

test("the provider wins over the bundled config", () => {
  /** The whole point: an admin edit has to beat the shipped default, or the
   * storefront goes on rendering the file the migration exists to demote. */
  render(
    <SiteContentProvider value={contentWith("From The Database")}>
      <ShowsBrand />
    </SiteContentProvider>,
  );

  expect(screen.queryByText(siteConfig.brand.name)).not.toBeInTheDocument();
  expect(screen.getByText("From The Database")).toBeInTheDocument();
});
