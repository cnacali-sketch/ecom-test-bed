/** @vitest-environment jsdom */

/**
 * The Activity screen exists to answer "who did this". These cover the ways
 * it could answer wrongly: hiding the actor, showing a diff backwards, or
 * quietly appending a page onto itself when the filter changes.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { Activity } from "./Activity";

const apiFetch = vi.fn();
vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  apiBaseUrl: () => "https://api.example.com",
}));

function entry(overrides: Record<string, unknown> = {}) {
  return {
    id: "a1",
    actor_email: "priya@savvyinteal.com",
    actor_role: "staff",
    action: "order.status",
    entity_type: "order",
    entity_id: "295b817f-e50a-4cdc-a371-7b5afd4b88c1",
    entity_label: "#295b817f",
    summary: "Marked as shipped",
    changes: { status: { from: "pending", to: "shipped" } },
    ip: "24.239.131.213",
    created_at: "2026-09-11T04:04:24Z",
    ...overrides,
  };
}

function ok(body: unknown, status = 200) {
  return { ok: true, status, json: async () => body };
}

const CHAIN_OK = {
  ok: true,
  checked: 1,
  first_broken_id: null,
  unverifiable: 0,
  detail: "All 1 hashed entries verify.",
};

/** Answer by URL rather than by call order.
 *
 * The screen makes two requests on mount -- the page of entries and the chain
 * integrity check -- so a queue of `mockResolvedValueOnce` responses gets
 * consumed by whichever lands first, and the test silently asserts against the
 * wrong reply. Routing on the path removes the race. */
function routeAudit(...pages: unknown[][]) {
  let call = 0;
  apiFetch.mockImplementation(async (path: string) => {
    if (String(path).startsWith("/api/audit/verify")) return ok(CHAIN_OK);
    const page = pages[Math.min(call, pages.length - 1)];
    call += 1;
    return ok(page);
  });
}

beforeEach(() => {
  apiFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("names the person who took the action, not just the action", async () => {
  apiFetch.mockResolvedValue(ok([entry()]));
  render(<Activity />);

  expect(await screen.findByText("Marked as shipped")).toBeInTheDocument();
  expect(screen.getByText(/priya@savvyinteal\.com/)).toBeInTheDocument();
  expect(screen.getByText("#295b817f")).toBeInTheDocument();
});

test("shows the before value and the after value in that order", async () => {
  /** A diff rendered backwards is worse than no diff: it reads as fact. */
  apiFetch.mockResolvedValue(
    ok([entry({ changes: { refund_amount: { from: "0.00", to: "200.50" } } })]),
  );
  render(<Activity />);

  await userEvent.click(await screen.findByRole("button", { name: /Marked as shipped/ }));

  const before = screen.getByText("0.00");
  const after = screen.getByText("200.50");
  expect(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("renders a null in a diff as a dash, not the word null", async () => {
  apiFetch.mockResolvedValue(
    ok([entry({ changes: { courier: { from: null, to: "Delhivery" } } })]),
  );
  render(<Activity />);

  await userEvent.click(await screen.findByRole("button", { name: /Marked as shipped/ }));
  expect(screen.getByText("—")).toBeInTheDocument();
  expect(screen.queryByText("null")).not.toBeInTheDocument();
});

test("an entry with no recorded changes does not pretend to expand", async () => {
  apiFetch.mockResolvedValue(ok([entry({ changes: {} })]));
  render(<Activity />);

  expect(await screen.findByRole("button", { name: /Marked as shipped/ })).toBeDisabled();
});

test("searching matches the actor as well as the summary", async () => {
  apiFetch.mockResolvedValue(
    ok([
      entry(),
      entry({ id: "a2", actor_email: "owner@savvyinteal.com", summary: "Refunded ₹200.00" }),
    ]),
  );
  render(<Activity />);
  await screen.findByText("Marked as shipped");

  await userEvent.type(screen.getByLabelText("Search the activity log"), "owner@");

  expect(screen.getByText("Refunded ₹200.00")).toBeInTheDocument();
  expect(screen.queryByText("Marked as shipped")).not.toBeInTheDocument();
});

test("changing the filter replaces the list instead of appending to it", async () => {
  /** Both requests start at offset 0, so treating the second as another page
   * would show every order entry twice under the Customers filter. */
  routeAudit(
    [entry()],
    [entry({ id: "c1", action: "customer.block", summary: "Blocked a@b.com" })],
  );
  render(<Activity />);
  await screen.findByText("Marked as shipped");

  await userEvent.click(screen.getByRole("button", { name: "Customers" }));

  expect(await screen.findByText("Blocked a@b.com")).toBeInTheDocument();
  expect(screen.queryByText("Marked as shipped")).not.toBeInTheDocument();
  expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("entity_type=customer"));
});

test("a short page means there is nothing older to load", async () => {
  apiFetch.mockResolvedValue(ok([entry()]));
  render(<Activity />);
  await screen.findByText("Marked as shipped");

  expect(screen.queryByRole("button", { name: /Load older activity/ })).not.toBeInTheDocument();
});

test("a full page offers the next one, and appends it", async () => {
  const page = Array.from({ length: 100 }, (_, i) => entry({ id: `p${i}` }));
  routeAudit(page, [entry({ id: "older", summary: "Refunded ₹200.00" })]);
  render(<Activity />);

  await userEvent.click(await screen.findByRole("button", { name: /Load older activity/ }));

  expect(await screen.findByText("Refunded ₹200.00")).toBeInTheDocument();
  expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("offset=100"));
});

test("an expired session says so instead of showing an empty log", async () => {
  /** "No admin actions recorded yet" on a 403 is the dangerous reading: it
   * says nothing happened when the truth is nothing was fetched. */
  apiFetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
  render(<Activity />);

  expect(await screen.findByText(/admin session has expired/)).toBeInTheDocument();
});

test("an unknown action still renders, labelled by its raw name", async () => {
  /** A new backend action must not vanish from the log just because this
   * screen has no friendly name for it yet. */
  apiFetch.mockResolvedValue(ok([entry({ action: "coupon.disable" })]));
  render(<Activity />);

  expect(await screen.findByText("coupon.disable")).toBeInTheDocument();
});

test("a deletion is visually distinguished from routine fulfilment", async () => {
  apiFetch.mockResolvedValue(
    ok([
      entry(),
      entry({ id: "d1", action: "order.delete", summary: "Deleted the order" }),
    ]),
  );
  render(<Activity />);

  const deleted = await screen.findByText("Deleted");
  const routine = screen.getByText("Status");
  expect(deleted.className).not.toEqual(routine.className);
});

test("the count reflects what is on screen after filtering", async () => {
  apiFetch.mockResolvedValue(
    ok([entry(), entry({ id: "a2", summary: "Refunded ₹200.00" })]),
  );
  render(<Activity />);
  await screen.findByText("Marked as shipped");
  expect(screen.getByRole("heading")).toHaveTextContent("Activity (2)");

  await userEvent.type(screen.getByLabelText("Search the activity log"), "Refunded");

  await waitFor(() => expect(screen.getByRole("heading")).toHaveTextContent("Activity (1)"));
});

test("search is hidden from paging so a filtered view cannot request a wrong offset", async () => {
  const page = Array.from({ length: 100 }, (_, i) => entry({ id: `p${i}` }));
  apiFetch.mockResolvedValue(ok(page));
  render(<Activity />);
  await screen.findByRole("button", { name: /Load older activity/ });

  await userEvent.type(screen.getByLabelText("Search the activity log"), "priya");

  expect(screen.queryByRole("button", { name: /Load older activity/ })).not.toBeInTheDocument();
});

test("the actor's role is shown, so a staff action is not mistaken for the owner's", async () => {
  apiFetch.mockResolvedValue(ok([entry()]));
  render(<Activity />);

  const row = (await screen.findByText(/priya@savvyinteal\.com/)).closest("p");
  // Asserted as adjacent text rather than "contains staff": the word has to
  // sit next to the actor it describes, not merely somewhere on the row.
  expect(row).toHaveTextContent(/priya@savvyinteal\.com\s*·\s*staff/);
});


/**
 * The tamper warning. An audit log that has been edited is worse than no log,
 * because it is believed -- so the screen has to say so loudly rather than
 * carry on rendering the rows as if they were an account of what happened.
 */

test("a broken chain is reported as tampering, not as a loading error", async () => {
  apiFetch.mockImplementation(async (path: string) => {
    if (String(path).startsWith("/api/audit/verify")) {
      return ok({
        ok: false,
        checked: 12,
        first_broken_id: "a1",
        unverifiable: 0,
        detail: "An entry's contents do not match its recorded hash.",
      });
    }
    return ok([entry()]);
  });

  render(<Activity />);

  expect(await screen.findByText(/This log has been tampered with/)).toBeInTheDocument();
  expect(screen.getByText(/do not match its recorded hash/)).toBeInTheDocument();
});

test("an intact chain is shown as verified", async () => {
  routeAudit([entry()]);
  render(<Activity />);

  expect(await screen.findByText("Verified")).toBeInTheDocument();
  expect(screen.queryByText(/tampered with/)).not.toBeInTheDocument();
});

test("entries still render when the integrity check itself fails", async () => {
  /** A verify endpoint that 500s must not blank the log. Losing the rows
   * because the extra check failed would turn a minor fault into the same
   * outcome as the tampering it exists to detect. */
  apiFetch.mockImplementation(async (path: string) => {
    if (String(path).startsWith("/api/audit/verify")) {
      return { ok: false, status: 500, json: async () => ({}) };
    }
    return ok([entry()]);
  });

  render(<Activity />);

  expect(await screen.findByText("Marked as shipped")).toBeInTheDocument();
  expect(screen.queryByText(/tampered with/)).not.toBeInTheDocument();
  expect(screen.queryByText("Verified")).not.toBeInTheDocument();
});
