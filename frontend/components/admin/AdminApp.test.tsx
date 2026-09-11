/** @vitest-environment jsdom */

/**
 * The admin shell decides what a signed-in back-office account can see at
 * all. For a staff session that matters more than it does for the owner: the
 * server refuses most of this console to them, so a nav entry pointing at an
 * endpoint that will 403 reads as the console being broken rather than as the
 * role working.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { AdminApp } from "./AdminApp";

const apiFetch = vi.fn();
vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  apiBaseUrl: () => "https://api.example.com",
}));

const auth = { user: { id: "u1", email: "priya@savvyinteal.com", role: "staff" }, isAdmin: false };
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ ...auth, logout: vi.fn() }),
}));

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

function asStaff() {
  auth.user = { id: "u1", email: "priya@savvyinteal.com", role: "staff" };
  auth.isAdmin = false;
}

function asOwner() {
  auth.user = { id: "u2", email: "owner@savvyinteal.com", role: "admin" };
  auth.isAdmin = true;
}

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockImplementation(async (path: string) => {
    if (path.startsWith("/api/products")) return ok({ items: [] });
    return ok([]);
  });
  asStaff();
});
afterEach(() => vi.restoreAllMocks());

/** The sidebar is rendered twice (desktop aside + mobile drawer); read the
 * desktop one so a match is not ambiguous. */
function sidebar() {
  return screen.getAllByRole("navigation")[0];
}

test("a staff session sees only the screens it can actually use", async () => {
  render(<AdminApp />);

  const nav = within(sidebar());
  expect(nav.getByRole("button", { name: /Orders/ })).toBeInTheDocument();
  expect(nav.getByRole("button", { name: /Messages/ })).toBeInTheDocument();

  for (const hidden of ["Dashboard", "Products", "Customers", "Coupons", "Analytics", "Activity"]) {
    expect(nav.queryByRole("button", { name: new RegExp(hidden) })).not.toBeInTheDocument();
  }
});

test("a staff session lands on Orders, not on an empty Dashboard", async () => {
  /** Staff have no Dashboard nav entry, so defaulting there would strand them
   * on a blank screen with no way to leave it. */
  render(<AdminApp />);
  expect(await screen.findByRole("heading", { name: "Orders" })).toBeInTheDocument();
});

test("a staff session does not request data it is not allowed to have", async () => {
  /** /api/categories is admin-only. Fetching it here would 403 and paint an
   * error banner about data this session has no screen for. */
  render(<AdminApp />);

  await waitFor(() => expect(apiFetch).toHaveBeenCalled());
  const requested = apiFetch.mock.calls.map((c) => String(c[0]));
  expect(requested.some((p) => p.startsWith("/api/categories"))).toBe(false);
  expect(requested.some((p) => p.startsWith("/api/products"))).toBe(false);
  expect(requested.some((p) => p.startsWith("/api/orders/all"))).toBe(true);
});

test("the header says which role is signed in", async () => {
  /** Two people with different powers use the same console; which one you are
   * should not be a guess. */
  render(<AdminApp />);
  expect(await screen.findByText("Staff")).toBeInTheDocument();
  expect(screen.getByText("priya@savvyinteal.com")).toBeInTheDocument();
});

test("the owner still gets the full console", async () => {
  /** The guard against the role check being wired the wrong way round. */
  asOwner();
  render(<AdminApp />);

  const nav = within(sidebar());
  for (const shown of ["Dashboard", "Products", "Customers", "Coupons", "Activity"]) {
    expect(nav.getByRole("button", { name: new RegExp(shown) })).toBeInTheDocument();
  }
  expect(await screen.findByText("Owner")).toBeInTheDocument();
});

test("the owner's catalogue still loads", async () => {
  asOwner();
  render(<AdminApp />);

  await waitFor(() => {
    const requested = apiFetch.mock.calls.map((c) => String(c[0]));
    expect(requested.some((p) => p.startsWith("/api/categories"))).toBe(true);
    expect(requested.some((p) => p.startsWith("/api/products"))).toBe(true);
  });
});
