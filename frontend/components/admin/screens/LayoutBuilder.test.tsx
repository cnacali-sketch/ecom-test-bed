/** @vitest-environment jsdom */

/**
 * The layout builder saves through an endpoint that REPLACES the whole site
 * document. Most of what follows is about that: a screen which knows only
 * about the section order, talking to an API that will happily accept only the
 * section order and throw away brand, nav, footer and every policy page.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";

import { LayoutBuilder } from "./LayoutBuilder";

const apiFetch = vi.fn();
vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  apiBaseUrl: () => "https://api.example.com",
}));

/** A document shaped like the real one: the layout is one key among many, and
 * the others are what a bad save would destroy. */
function siteDocument(layout?: unknown) {
  return {
    key: "site",
    version: 7,
    document: {
      brand: { name: "Savvy In Teal" },
      nav: [{ label: "Shop", href: "/collections/all" }],
      footer: { note: "Handmade in Bengaluru" },
      policies: { privacy: { title: "Privacy" } },
      home: {
        newInHeading: "New in",
        campaign: { title: "The winter edit" },
        ...(layout === undefined ? {} : { layout }),
      },
    },
  };
}

function respondWith(body: unknown, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: async () => body });
}

beforeEach(() => {
  apiFetch.mockReset();
});

async function renderLoaded(doc = siteDocument()) {
  apiFetch.mockReturnValueOnce(respondWith(doc));
  render(<LayoutBuilder />);
  await screen.findByText("Hero banner");
}

function savedBody() {
  const call = apiFetch.mock.calls.find(([, init]) => init?.method === "PUT");
  if (!call) throw new Error("nothing was saved");
  return JSON.parse(call[1].body as string);
}

test("a document with no layout yet shows the shipped order", async () => {
  await renderLoaded();

  const labels = screen.getAllByRole("listitem").map((li) => li.textContent);
  expect(labels[0]).toContain("Hero banner");
  expect(labels.at(-1)).toContain("SEO copy");
});

test("saving keeps every other part of the document", async () => {
  /** The hazard this screen has to survive. PUT /api/content/site replaces the
   * document wholesale, so a builder that sent only what it knows about would
   * wipe the brand, the nav, the footer and every policy page -- and the
   * request would succeed. */
  await renderLoaded();
  apiFetch.mockReturnValueOnce(respondWith(siteDocument([])));

  await userEvent.click(screen.getByRole("button", { name: /save layout/i }));

  await waitFor(() => expect(savedBody()).toBeTruthy());
  const sent = savedBody().document;
  expect(sent.brand).toEqual({ name: "Savvy In Teal" });
  expect(sent.nav).toEqual([{ label: "Shop", href: "/collections/all" }]);
  expect(sent.footer).toEqual({ note: "Handmade in Bengaluru" });
  expect(sent.policies).toEqual({ privacy: { title: "Privacy" } });
});

test("saving keeps the rest of the home section, not just the layout", async () => {
  /** `home` is the key being edited, so it is the one most easily replaced
   * rather than updated -- taking the headings and campaign copy with it. */
  await renderLoaded();
  apiFetch.mockReturnValueOnce(respondWith(siteDocument([])));

  await userEvent.click(screen.getByRole("button", { name: /save layout/i }));

  await waitFor(() => expect(savedBody()).toBeTruthy());
  expect(savedBody().document.home.newInHeading).toBe("New in");
  expect(savedBody().document.home.campaign).toEqual({ title: "The winter edit" });
});

test("the version it read is sent back, so a concurrent save cannot be clobbered", async () => {
  await renderLoaded();
  apiFetch.mockReturnValueOnce(respondWith(siteDocument([])));

  await userEvent.click(screen.getByRole("button", { name: /save layout/i }));

  await waitFor(() => expect(savedBody().expected_version).toBe(7));
});

test("moving a section down changes the saved order", async () => {
  await renderLoaded();
  apiFetch.mockReturnValueOnce(respondWith(siteDocument([])));

  await userEvent.click(screen.getByRole("button", { name: /move hero banner down/i }));
  await userEvent.click(screen.getByRole("button", { name: /save layout/i }));

  await waitFor(() => expect(savedBody()).toBeTruthy());
  const order = savedBody().document.home.layout.map((e: { id: string }) => e.id);
  expect(order.slice(0, 2)).toEqual(["quickCtas", "hero"]);
});

test("hiding a section is what gets saved", async () => {
  await renderLoaded();
  apiFetch.mockReturnValueOnce(respondWith(siteDocument([])));

  await userEvent.click(screen.getByRole("button", { name: /hide campaign band/i }));
  await userEvent.click(screen.getByRole("button", { name: /save layout/i }));

  await waitFor(() => expect(savedBody()).toBeTruthy());
  const campaign = savedBody().document.home.layout.find(
    (e: { id: string }) => e.id === "campaign",
  );
  expect(campaign.visible).toBe(false);
});

test("the first section cannot be moved up and the last cannot be moved down", async () => {
  await renderLoaded();

  expect(screen.getByRole("button", { name: /move hero banner up/i })).toBeDisabled();
  expect(screen.getByRole("button", { name: /move seo copy down/i })).toBeDisabled();
});

test("the preview follows the draft rather than the saved layout", async () => {
  /** The whole point of the pane: it has to show what you are arranging, not
   * what is already live. */
  await renderLoaded();
  const before = screen.getByTitle("Homepage preview").getAttribute("src");

  await userEvent.click(screen.getByRole("button", { name: /move hero banner down/i }));

  const after = screen.getByTitle("Homepage preview").getAttribute("src");
  expect(after).not.toBe(before);
  expect(decodeURIComponent(after!)).toContain("quickCtas:1,hero:1");
});

test("a stale version says somebody else saved, rather than failing silently", async () => {
  await renderLoaded();
  apiFetch.mockReturnValueOnce(respondWith({ detail: "stale" }, false, 409));

  await userEvent.click(screen.getByRole("button", { name: /save layout/i }));

  expect(await screen.findByRole("alert")).toHaveTextContent(/somebody else saved/i);
});

test("a failed load does not render a layout that could then be saved over the real one", async () => {
  apiFetch.mockReturnValueOnce(respondWith(null, false, 500));
  render(<LayoutBuilder />);

  expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load/i);
  expect(screen.getByRole("button", { name: /save layout/i })).toBeDisabled();
});
