/** @vitest-environment jsdom */

/**
 * Granting back-office access is the highest-consequence control in the
 * console: it is the one change that hands somebody else the ability to make
 * every other change. These cover the ways it could go wrong quietly —
 * a role changed without the owner meaning to, or an owner demoting
 * themselves and locking the shop out of its own admin.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { Customers } from "./Customers";

const apiFetch = vi.fn();
vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  apiBaseUrl: () => "https://api.example.com",
}));

const SIGNED_IN = { id: "owner-1", email: "owner@savvyinteal.com", role: "admin" };
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: SIGNED_IN }),
}));

function customer(overrides: Record<string, unknown> = {}) {
  return {
    id: "cust-1",
    email: "priya@example.com",
    role: "customer",
    is_verified: true,
    created_at: "2026-09-01T10:00:00Z",
    full_name: "Priya Nair",
    phone: "9738281596",
    postal_address: { line1: "12 MG Road", city: "Bangalore" },
    billing_address: {},
    billing_same: true,
    is_blocked: false,
    blocked_reason: null,
    ...overrides,
  };
}

function ok(body: unknown, status = 200) {
  return { ok: true, status, json: async () => body };
}

beforeEach(() => {
  apiFetch.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => vi.restoreAllMocks());

test("an account's role can be changed from the directory", async () => {
  apiFetch.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (init?.method === "PATCH") return ok(customer({ role: "staff" }));
    return ok([customer()]);
  });
  render(<Customers />);

  const picker = await screen.findByLabelText("Role for priya@example.com");
  await userEvent.selectOptions(picker, "staff");

  await waitFor(() =>
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/customers/cust-1/role",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ role: "staff" }) }),
    ),
  );
  expect(await screen.findByDisplayValue("staff")).toBeInTheDocument();
});

test("the change is confirmed first, and abandoning it sends nothing", async () => {
  /** A role picker sits one stray click away from every other row's. */
  vi.spyOn(window, "confirm").mockReturnValue(false);
  apiFetch.mockResolvedValue(ok([customer()]));
  render(<Customers />);

  await userEvent.selectOptions(
    await screen.findByLabelText("Role for priya@example.com"),
    "admin",
  );

  expect(apiFetch).toHaveBeenCalledTimes(1); // the initial load, nothing else
});

test("the confirmation says what the role actually allows", async () => {
  /** "staff" on its own does not tell the owner whether that person can
   * issue a refund. */
  const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
  apiFetch.mockResolvedValue(ok([customer()]));
  render(<Customers />);

  await userEvent.selectOptions(
    await screen.findByLabelText("Role for priya@example.com"),
    "staff",
  );

  expect(confirmSpy.mock.calls[0][0]).toContain("No money");
});

test("removing access is worded as removal, not as a grant", async () => {
  const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
  apiFetch.mockResolvedValue(ok([customer({ role: "staff" })]));
  render(<Customers />);

  await userEvent.selectOptions(
    await screen.findByLabelText("Role for priya@example.com"),
    "customer",
  );

  expect(confirmSpy.mock.calls[0][0]).toContain("Remove back-office access");
});

test("the signed-in admin cannot change their own role", async () => {
  /** The server refuses this, and there is no way back from it except the
   * database — so the control is not offered at all. */
  apiFetch.mockResolvedValue(
    ok([customer({ id: "owner-1", email: "owner@savvyinteal.com", role: "admin" })]),
  );
  render(<Customers />);

  expect(await screen.findByText(/admin \(you\)/)).toBeInTheDocument();
  expect(
    screen.queryByLabelText("Role for owner@savvyinteal.com"),
  ).not.toBeInTheDocument();
});

test("a refusal from the server is shown, not swallowed", async () => {
  apiFetch.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (init?.method === "PATCH")
      return { ok: false, status: 422, json: async () => ({ detail: "role must be one of customer, staff, admin" }) };
    return ok([customer()]);
  });
  render(<Customers />);

  await userEvent.selectOptions(
    await screen.findByLabelText("Role for priya@example.com"),
    "staff",
  );

  expect(await screen.findByText(/role must be one of/)).toBeInTheDocument();
});

test("every assignable role is offered", async () => {
  apiFetch.mockResolvedValue(ok([customer()]));
  render(<Customers />);

  const picker = await screen.findByLabelText("Role for priya@example.com");
  expect([...picker.querySelectorAll("option")].map((o) => o.textContent)).toEqual([
    "customer",
    "staff",
    "admin",
  ]);
});
