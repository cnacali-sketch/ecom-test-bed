/** @vitest-environment jsdom */

/**
 * Analytics reported on all time and nothing else, which cannot answer the
 * question a shop actually asks — "did last week work?". These cover the
 * period control and, more importantly, the ways a period can lie: a heading
 * that names a window the figures do not cover, or an off-by-one that turns
 * "last 7 days" into eight.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { Analytics } from "./Analytics";

const apiFetch = vi.fn();
vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  apiBaseUrl: () => "https://api.example.com",
}));

function summary(overrides: Record<string, unknown> = {}) {
  return {
    start: "2026-08-14",
    end: "2026-09-12",
    counts: { page_view: 400, product_view: 120, add_to_cart: 30, checkout_started: 12, order_placed: 6 },
    top_products: [{ product_id: "p1", name: "Signature Teal Pendant", views: 40 }],
    total_events: 568,
    device_counts: { Desktop: 300, Mobile: 268 },
    browser_counts: { Chrome: 400, Safari: 168 },
    top_locations: [{ city: "Bengaluru", state: "Karnataka", order_count: 4 }],
    state_counts: { Karnataka: 4 },
    country_counts: { IN: 4 },
    ...overrides,
  };
}

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

/** Last query string apiFetch was called with. */
function lastUrl(): string {
  return String(apiFetch.mock.calls.at(-1)?.[0]);
}

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockResolvedValue(ok(summary()));
  // Fixed clock: these tests are about which dates get requested, and a real
  // clock makes that unassertable. `shouldAdvanceTime` keeps the clock frozen
  // at a known date while still letting timers actually fire — without it,
  // waitFor and userEvent both hang, because they wait on real ones.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 8, 12, 10, 0, 0)); // 12 Sep 2026, local
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("defaults to a recent window, not to all time", async () => {
  /** An all-time total stops moving once a shop has any history, so it is the
   * wrong thing to open on. */
  render(<Analytics />);

  await waitFor(() => expect(apiFetch).toHaveBeenCalled());
  expect(lastUrl()).toContain("start=");
  expect(screen.getByRole("button", { name: "Last 30 days" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("last 7 days asks for seven days, not eight", async () => {
  /** Inclusive of both ends: today and the six before it. The off-by-one here
   * is invisible on screen and quietly inflates every comparison. */
  render(<Analytics />);
  await waitFor(() => expect(apiFetch).toHaveBeenCalled());

  await userEvent.click(screen.getByRole("button", { name: "Last 7 days" }));

  await waitFor(() => expect(lastUrl()).toContain("start=2026-09-06"));
  expect(lastUrl()).toContain("end=2026-09-12");
});

test("dates are built in local time, not UTC", async () => {
  /** toISOString() converts to UTC first, which in IST lands on the previous
   * day for anything before 05:30 — so the window would silently shift by a
   * day for five and a half hours each morning. */
  vi.setSystemTime(new Date(2026, 8, 12, 2, 0, 0)); // 02:00 local
  render(<Analytics />);

  await waitFor(() => expect(lastUrl()).toContain("end=2026-09-12"));
});

test("all time sends no dates at all", async () => {
  render(<Analytics />);
  await waitFor(() => expect(apiFetch).toHaveBeenCalled());

  await userEvent.click(screen.getByRole("button", { name: "All time" }));

  await waitFor(() => expect(lastUrl()).not.toContain("start="));
  expect(lastUrl()).not.toContain("end=");
});

test("the heading names the window the server actually reported on", async () => {
  /** Taken from the response rather than from local state: if the two ever
   * disagree, the figures are the truth and the label must follow them. */
  apiFetch.mockResolvedValue(ok(summary({ start: "2026-01-01", end: "2026-01-31" })));
  render(<Analytics />);

  expect(await screen.findByText("2026-01-01 to 2026-01-31")).toBeInTheDocument();
});

test("an all-time response is labelled as such", async () => {
  apiFetch.mockResolvedValue(ok(summary({ start: null, end: null })));
  render(<Analytics />);

  // "All time" is also the name of a period button, so the label has to be
  // picked out by not being one.
  const label = (await screen.findAllByText("All time")).find((el) => el.tagName !== "BUTTON");
  expect(label).toBeDefined();
});

test("a quiet period says the period was quiet, not that tracking never started", async () => {
  /** "No behavior data yet" on a filtered view reads as a broken tracker.
   * The shop would go looking for a bug instead of widening the window. */
  apiFetch.mockResolvedValue(
    ok(summary({ total_events: 0, counts: {}, top_products: [], start: "2026-01-01", end: "2026-01-31" })),
  );
  render(<Analytics />);

  expect(await screen.findByText("No behavior data in this period.")).toBeInTheDocument();
  expect(screen.queryByText("No behavior data yet.")).not.toBeInTheDocument();
});

test("an unfiltered empty shop still reads as never-started", async () => {
  apiFetch.mockResolvedValue(
    ok(summary({ total_events: 0, counts: {}, top_products: [], start: null, end: null })),
  );
  render(<Analytics />);

  expect(await screen.findByText("No behavior data yet.")).toBeInTheDocument();
});

test("changing the period refetches rather than filtering what is already loaded", async () => {
  /** The server owns the window — the browser only ever holds one period's
   * worth of aggregates, so there is nothing here to filter. */
  render(<Analytics />);
  await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));

  await userEvent.click(screen.getByRole("button", { name: "Last 90 days" }));

  await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
  expect(lastUrl()).toContain("start=2026-06-15");
});

test("only one period reads as selected", async () => {
  render(<Analytics />);
  await waitFor(() => expect(apiFetch).toHaveBeenCalled());

  await userEvent.click(screen.getByRole("button", { name: "All time" }));

  expect(screen.getByRole("button", { name: "All time" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Last 30 days" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("a failed load says so instead of showing an empty period", async () => {
  apiFetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
  render(<Analytics />);

  expect(await screen.findByText(/Couldn't load analytics/)).toBeInTheDocument();
});
