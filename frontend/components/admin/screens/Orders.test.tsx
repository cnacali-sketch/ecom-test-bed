/** @vitest-environment jsdom */

/**
 * The Orders screen is where money and shipping meet, so it is the second
 * place worth rendering in a test. These cover the behaviour a mistake would
 * be expensive in: deleting the wrong order, a paid order being destroyed, a
 * search quietly falling back to the full list, and the address an operator
 * copies into a courier's form.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { Orders } from "./Orders";

const apiFetch = vi.fn();
vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  apiBaseUrl: () => "https://api.example.com",
}));

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: "295b817f-e50a-4cdc-a371-7b5afd4b88c1",
    user_id: "praveen@example.com",
    status: "pending",
    payment_status: "unpaid",
    payment_method: "cod",
    courier: null,
    tracking_number: null,
    shipping_address: {
      full_name: "Praveen Kumar",
      line1: "12 MG Road",
      city: "Bangalore",
      state: "Karnataka",
      postcode: "560025",
      country: "India",
      phone: "9738281596",
    },
    total_amount: "449.00",
    flagged: false,
    flag_reason: null,
    ip_address: "24.239.131.213",
    device: "Android · Chrome (Mobile)",
    created_at: "2026-09-05T04:04:24Z",
    items: [
      {
        id: "i1",
        product_id: "p1",
        quantity: 2,
        unit_price: "224.50",
        product: {
          id: "p1",
          name: "Classic French Barrette",
          sku: "SIT-BAR-001",
          slug: "classic-french-barrette",
          images: [],
        },
      },
    ],
    ...overrides,
  };
}

/** Minimal Response stand-in — apiFetch's callers only use these. */
function ok(body: unknown, status = 200) {
  return { ok: true, status, json: async () => body };
}
function fail(status: number, detail?: string) {
  return { ok: false, status, json: async () => (detail ? { detail } : null) };
}

/** Route each call by URL so tests describe data, not call order. */
function routeApi(handlers: { orders?: unknown[]; onDelete?: () => unknown }) {
  const rows = handlers.orders ?? [order()];
  apiFetch.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (init?.method === "DELETE") return handlers.onDelete?.() ?? ok(null, 204);
    if (path.startsWith("/api/returns")) return ok([]);
    if (path.startsWith("/api/orders/all")) return ok(rows);
    // Every mutating order endpoint answers with the updated order, the way
    // the real API does. Returning a bare null here once corrupted the list
    // and crashed the screen — worth mirroring the real contract.
    if (path.startsWith("/api/orders/")) return ok(rows[0]);
    return ok(null);
  });
}

beforeEach(() => {
  apiFetch.mockReset();
  Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => undefined) } });
});
afterEach(() => vi.restoreAllMocks());

describe("Orders screen", () => {
  test("lists orders with what was actually bought, not just a count", async () => {
    routeApi({});
    render(<Orders />);

    expect(await screen.findByText("praveen@example.com")).toBeInTheDocument();
    // The Items column used to print "1" with no way to learn what "1" was.
    expect(screen.getByText("2 × Classic French Barrette")).toBeInTheDocument();
    expect(screen.getByText("₹449")).toBeInTheDocument();
  });

  test("shows the date an order was placed", async () => {
    routeApi({});
    render(<Orders />);
    await screen.findByText("praveen@example.com");

    // Scoped to the cells rather than matched as free text: every ancestor of
    // the date also contains it, and the exact string is locale- and
    // ICU-dependent ("Sep" vs "Sept"). What is being covered is that a date
    // appears at all -- orders previously showed none anywhere.
    const dated = screen.getAllByRole("cell").some((cell) => {
      const text = cell.textContent ?? "";
      // Two plain substring checks rather than one clever pattern: the month
      // abbreviation varies by ICU build ("Sep" / "Sept"), and a regex buys
      // nothing over asking whether a month and a year are both present.
      return text.includes("Sep") && text.includes("2026");
    });

    expect(dated).toBe(true);
    expect(screen.getByRole("columnheader", { name: "Placed" })).toBeInTheDocument();
  });

  test("expanding an order reveals line items, device and the address", async () => {
    routeApi({});
    render(<Orders />);
    await screen.findByText("praveen@example.com");

    await userEvent.click(screen.getByRole("button", { name: /expand/i }));

    expect(screen.getByText("SIT-BAR-001")).toBeInTheDocument();
    expect(screen.getByText("Android · Chrome (Mobile)")).toBeInTheDocument();
    expect(screen.getByText(/Praveen Kumar/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "9738281596" })).toBeInTheDocument();
  });

  test("copies a courier-shaped address, one field per line", async () => {
    routeApi({});
    render(<Orders />);
    await screen.findByText("praveen@example.com");
    await userEvent.click(screen.getByRole("button", { name: /expand/i }));

    await userEvent.click(screen.getByRole("button", { name: /copy the full shipping address/i }));

    const copied = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(copied).toContain("Praveen Kumar");
    expect(copied).toContain("Bangalore, Karnataka");
    expect(copied).toContain("Phone: 9738281596");
    // Multi-line, because Delhivery and Shiprocket take separate fields and a
    // comma-run has to be re-split by hand.
    expect(copied.split("\n").length).toBeGreaterThan(4);
  });

  test("warns when an order has no recipient name", async () => {
    const nameless = order({
      shipping_address: { line1: "12 MG Road", city: "Bangalore", postcode: "560025" },
    });
    routeApi({ orders: [nameless] });
    render(<Orders />);
    await screen.findByText("praveen@example.com");

    await userEvent.click(screen.getByRole("button", { name: /expand/i }));

    // A courier will not accept a waybill without a consignee.
    expect(screen.getByText(/No recipient name on this order/i)).toBeInTheDocument();
  });

  describe("search", () => {
    test("sends the query to the server rather than filtering on screen", async () => {
      routeApi({});
      render(<Orders />);
      await screen.findByText("praveen@example.com");

      await userEvent.type(screen.getByLabelText(/search orders/i), "AWB123");

      await waitFor(() =>
        expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("/api/orders/all?q=AWB123")),
      );
    });

    test("a search matching nothing says so instead of looking empty", async () => {
      apiFetch.mockImplementation(async (path: string) => {
        if (path.startsWith("/api/returns")) return ok([]);
        if (path.includes("q=")) return ok([]);
        return ok([order()]);
      });
      render(<Orders />);
      await screen.findByText("praveen@example.com");

      await userEvent.type(screen.getByLabelText(/search orders/i), "zzzz");

      // "No orders yet" on a live shop reads as data loss.
      expect(await screen.findByText(/No order matches/i)).toBeInTheDocument();
      expect(screen.queryByText("No orders yet.")).not.toBeInTheDocument();
    });
  });

  describe("deleting", () => {
    test("asks first, and names the customer and total", async () => {
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
      routeApi({});
      render(<Orders />);
      await screen.findByText("praveen@example.com");
      await userEvent.click(screen.getByRole("button", { name: /expand/i }));

      await userEvent.click(screen.getByRole("button", { name: /delete order/i }));

      const prompt = confirm.mock.calls[0][0] as string;
      expect(prompt).toContain("praveen@example.com");
      expect(prompt).toContain("₹449");
      expect(prompt).toMatch(/stock it reserved goes back/i);
      // Declining must not delete.
      expect(apiFetch).not.toHaveBeenCalledWith(expect.any(String), { method: "DELETE" });
      expect(screen.getByText("praveen@example.com")).toBeInTheDocument();
    });

    test("removes the order from the list once confirmed", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      routeApi({});
      render(<Orders />);
      await screen.findByText("praveen@example.com");
      await userEvent.click(screen.getByRole("button", { name: /expand/i }));

      await userEvent.click(screen.getByRole("button", { name: /delete order/i }));

      await waitFor(() =>
        expect(screen.queryByText("praveen@example.com")).not.toBeInTheDocument(),
      );
    });

    test("shows the server's reason when a paid order is refused", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      const detail =
        "This order is marked paid. Refund it and set payment to refunded before deleting, " +
        "so the payment record is not lost.";
      routeApi({ onDelete: () => fail(409, detail) });
      render(<Orders />);
      await screen.findByText("praveen@example.com");
      await userEvent.click(screen.getByRole("button", { name: /expand/i }));

      await userEvent.click(screen.getByRole("button", { name: /delete order/i }));

      // The server's own wording, not a generic failure — it tells the
      // operator what to do instead.
      expect(await screen.findByText(new RegExp("Refund it and set payment", "i"))).toBeInTheDocument();
      expect(screen.getByText("praveen@example.com")).toBeInTheDocument();
    });
  });


  describe("refunds", () => {
    async function openPaidOrder(overrides: Record<string, unknown> = {}) {
      routeApi({
        orders: [order({ payment_status: "paid", total_amount: "1000.00", ...overrides })],
      });
      render(<Orders />);
      await screen.findByText("praveen@example.com");
      await userEvent.click(screen.getByRole("button", { name: /expand/i }));
    }

    test("shows what was charged and the payment reference", async () => {
      await openPaidOrder({ razorpay_payment_id: "pay_ABC123" });

      expect(screen.getByText(/Charged/)).toBeInTheDocument();
      // The id a bank settlement line refers to, without which money in the
      // account cannot be tied back to an order.
      expect(screen.getByText("pay_ABC123")).toBeInTheDocument();
    });

    test("records a partial refund with its reference", async () => {
      await openPaidOrder();

      await userEvent.type(screen.getByLabelText("Refund amount"), "250");
      await userEvent.type(screen.getByLabelText("Refund reference"), "rfnd_X1");
      await userEvent.click(screen.getByRole("button", { name: /record refund/i }));

      await waitFor(() =>
        expect(apiFetch).toHaveBeenCalledWith(
          expect.stringContaining("/refund"),
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ amount: "250.00", reference: "rfnd_X1" }),
          }),
        ),
      );
    });

    test("will not submit more than is still refundable", async () => {
      await openPaidOrder({ refund_amount: "900.00", payment_status: "partially_refunded" });

      await userEvent.type(screen.getByLabelText("Refund amount"), "500");

      // Guarded in the UI as well as the API: a typo should not need a
      // round-trip to be told it is impossible.
      expect(screen.getByRole("button", { name: /record refund/i })).toBeDisabled();
    });

    test("an unpaid order offers no refund form", async () => {
      await openPaidOrder({ payment_status: "unpaid" });

      expect(screen.queryByLabelText("Refund amount")).not.toBeInTheDocument();
      expect(screen.getByText(/Nothing to refund until this order is marked paid/i)).toBeInTheDocument();
    });

    test("a fully refunded order says so and offers no form", async () => {
      await openPaidOrder({ refund_amount: "1000.00", payment_status: "refunded" });

      expect(screen.getByText("Fully refunded.")).toBeInTheDocument();
      expect(screen.queryByLabelText("Refund amount")).not.toBeInTheDocument();
    });

    test("shows the server's arithmetic when a refund is refused", async () => {
      const detail = "Refund of 5000.00 exceeds the 1000.00 still refundable on this order.";
      apiFetch.mockImplementation(async (path: string, init?: { method?: string }) => {
        if (init?.method === "POST" && path.includes("/refund")) return fail(422, detail);
        if (path.startsWith("/api/returns")) return ok([]);
        return ok([order({ payment_status: "paid", total_amount: "1000.00" })]);
      });
      render(<Orders />);
      await screen.findByText("praveen@example.com");
      await userEvent.click(screen.getByRole("button", { name: /expand/i }));

      await userEvent.type(screen.getByLabelText("Refund amount"), "999");
      await userEvent.click(screen.getByRole("button", { name: /record refund/i }));

      expect(await screen.findByText(/still refundable/i)).toBeInTheDocument();
    });
  });

  test("a flagged order is called out with its reason", async () => {
    routeApi({ orders: [order({ flagged: true, flag_reason: "Price mismatch at checkout" })] });
    render(<Orders />);

    const row = await screen.findByText("praveen@example.com");
    expect(within(row.closest("tr") as HTMLElement).getByText(/flagged/i)).toBeInTheDocument();
  });
});
