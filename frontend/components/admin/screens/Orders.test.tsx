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


  describe("fulfilment at batch size", () => {
    test("a status tab asks the server for that queue", async () => {
      routeApi({});
      render(<Orders />);
      await screen.findByText("praveen@example.com");

      await userEvent.click(screen.getByRole("button", { name: "Open" }));

      // Server-side, so it filters every order rather than the page on screen.
      await waitFor(() =>
        expect(apiFetch).toHaveBeenCalledWith(
          expect.stringContaining("status=pending%2Cconfirmed"),
        ),
      );
    });

    test("selecting orders reveals the bulk actions", async () => {
      routeApi({});
      render(<Orders />);
      await screen.findByText("praveen@example.com");

      expect(screen.queryByLabelText(/set status for selected/i)).not.toBeInTheDocument();
      await userEvent.click(screen.getByLabelText(/select order 295b817f/i));

      expect(screen.getByText("1 selected")).toBeInTheDocument();
      expect(screen.getByLabelText(/set status for selected/i)).toBeInTheDocument();
    });

    test("select-all ticks every visible order", async () => {
      routeApi({ orders: [order(), order({ id: "aaaaaaaa-0000-0000-0000-000000000001" })] });
      render(<Orders />);
      await screen.findAllByText("praveen@example.com");

      await userEvent.click(screen.getByLabelText("Select all orders"));

      expect(screen.getByText("2 selected")).toBeInTheDocument();
    });

    test("a bulk status change sends one request for the whole batch", async () => {
      routeApi({ orders: [order(), order({ id: "aaaaaaaa-0000-0000-0000-000000000001" })] });
      render(<Orders />);
      await screen.findAllByText("praveen@example.com");
      await userEvent.click(screen.getByLabelText("Select all orders"));

      await userEvent.selectOptions(screen.getByLabelText(/set status for selected/i), "shipped");

      // One request, not one per order — the whole point of the batch.
      await waitFor(() =>
        expect(apiFetch).toHaveBeenCalledWith(
          "/api/orders/bulk/status",
          expect.objectContaining({ method: "PATCH" }),
        ),
      );
      const call = apiFetch.mock.calls.find((c: unknown[]) => c[0] === "/api/orders/bulk/status");
      const body = JSON.parse((call![1] as { body: string }).body);
      expect(body.order_ids).toHaveLength(2);
      expect(body.status).toBe("shipped");
    });

    test("changing the filter clears a stale selection", async () => {
      routeApi({});
      render(<Orders />);
      await screen.findByText("praveen@example.com");
      await userEvent.click(screen.getByLabelText(/select order 295b817f/i));
      expect(screen.getByText("1 selected")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Shipped" }));

      // Acting on orders that are no longer on screen is how the wrong parcel
      // gets marked shipped.
      expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
    });

    test("a failed bulk update shows the server's reason and keeps the selection", async () => {
      apiFetch.mockImplementation(async (path: string) => {
        if (path === "/api/orders/bulk/status") return fail(409, "Cannot reinstate this order: not enough stock");
        if (path.startsWith("/api/returns")) return ok([]);
        return ok([order()]);
      });
      render(<Orders />);
      await screen.findByText("praveen@example.com");
      await userEvent.click(screen.getByLabelText(/select order 295b817f/i));

      await userEvent.selectOptions(screen.getByLabelText(/set status for selected/i), "confirmed");

      expect(await screen.findByText(/not enough stock/i)).toBeInTheDocument();
      expect(screen.getByText("1 selected")).toBeInTheDocument();
    });
  });

  describe("packing slips", () => {
    test("prints a slip carrying what the packer and courier each need", async () => {
      const print = vi.spyOn(window, "print").mockImplementation(() => {});
      routeApi({ orders: [order({ payment_method: "cod", total_amount: "449.00" })] });
      render(<Orders />);
      await screen.findByText("praveen@example.com");
      await userEvent.click(screen.getByLabelText(/select order 295b817f/i));

      await userEvent.click(screen.getByRole("button", { name: /packing slips/i }));

      const slips = await screen.findByText(/COLLECT ON DELIVERY/);
      expect(slips).toBeInTheDocument();
      // The cash figure is the one number nobody at the door can work out.
      expect(slips.textContent).toContain("449");
      await waitFor(() => expect(print).toHaveBeenCalled());
    });

    test("a prepaid order tells the courier to collect nothing", async () => {
      const print = vi.spyOn(window, "print").mockImplementation(() => {});
      routeApi({ orders: [order({ payment_method: "prepaid", payment_status: "paid" })] });
      render(<Orders />);
      await screen.findByText("praveen@example.com");
      await userEvent.click(screen.getByLabelText(/select order 295b817f/i));

      await userEvent.click(screen.getByRole("button", { name: /packing slips/i }));

      expect(await screen.findByText(/collect nothing/i)).toBeInTheDocument();
      // Awaited so the queued print lands inside the test rather than after
      // its mocks are restored, where it would hit jsdom's real stub.
      await waitFor(() => expect(print).toHaveBeenCalled());
    });

    test("a COD deposit is subtracted from what is collected at the door", async () => {
      const print = vi.spyOn(window, "print").mockImplementation(() => {});
      routeApi({
        orders: [
          order({
            payment_method: "cod",
            total_amount: "449.00",
            deposit_amount: "200.00",
            deposit_paid: true,
          }),
        ],
      });
      render(<Orders />);
      await screen.findByText("praveen@example.com");
      await userEvent.click(screen.getByLabelText(/select order 295b817f/i));

      await userEvent.click(screen.getByRole("button", { name: /packing slips/i }));

      // 449 - 200 already paid online.
      const slip = await screen.findByText(/COLLECT ON DELIVERY/);
      expect(slip.textContent).toContain("249");
      await waitFor(() => expect(print).toHaveBeenCalled());
    });
  });


  describe("invoicing", () => {
    const invoice = {
      id: "inv-1",
      order_id: "295b817f-e50a-4cdc-a371-7b5afd4b88c1",
      number: "SIT/26-27/0001",
      issued_at: "2026-09-11T10:00:00Z",
      is_tax_invoice: true,
      seller_name: "Savvy In Teal",
      seller_gstin: "29ABCDE1234F1Z5",
      seller_address: "12 Agah Abdullah Street",
      seller_state: "Karnataka",
      buyer_name: "Praveen Kumar",
      buyer_address: "12 MG Road",
      place_of_supply: "Kerala",
      intra_state: false,
      taxable_value: "422.88",
      cgst: "0.00",
      sgst: "0.00",
      igst: "76.12",
      total: "499.00",
      lines: [
        {
          description: "Tortoise Grip Claw Clip",
          sku: "SIT-CLIP-1",
          hsn: "9615",
          quantity: 1,
          unit_price: "499.00",
          gross: "499.00",
          gst_rate: "18",
          taxable_value: "422.88",
          cgst: "0.00",
          sgst: "0.00",
          igst: "76.12",
        },
      ],
    };

    function routeWithInvoice(inv: unknown | null, paid = true) {
      apiFetch.mockImplementation(async (path: string, init?: { method?: string }) => {
        if (path.startsWith("/api/returns")) return ok([]);
        if (path.endsWith("/invoice")) {
          if (init?.method === "POST") return ok(inv ?? invoice, 201);
          return inv ? ok(inv) : fail(404);
        }
        return ok([order({ payment_status: paid ? "paid" : "unpaid" })]);
      });
    }

    test("an uninvoiced order offers to issue one", async () => {
      routeWithInvoice(null);
      render(<Orders />);
      await screen.findByText("praveen@example.com");

      await userEvent.click(screen.getByRole("button", { name: /expand/i }));

      expect(await screen.findByRole("button", { name: /issue invoice/i })).toBeEnabled();
    });

    test("an unpaid order cannot be invoiced", async () => {
      routeWithInvoice(null, false);
      render(<Orders />);
      await screen.findByText("praveen@example.com");

      await userEvent.click(screen.getByRole("button", { name: /expand/i }));

      // The sale has not happened yet, so there is nothing to invoice.
      expect(await screen.findByRole("button", { name: /issue invoice/i })).toBeDisabled();
    });

    test("issuing shows the number that was allocated", async () => {
      routeWithInvoice(null);
      render(<Orders />);
      await screen.findByText("praveen@example.com");
      await userEvent.click(screen.getByRole("button", { name: /expand/i }));

      await userEvent.click(await screen.findByRole("button", { name: /issue invoice/i }));

      expect(await screen.findByText("SIT/26-27/0001")).toBeInTheDocument();
      expect(screen.getByText(/Tax invoice/)).toBeInTheDocument();
    });

    test("an already-invoiced order offers to print, never to issue again", async () => {
      routeWithInvoice(invoice);
      render(<Orders />);
      await screen.findByText("praveen@example.com");

      await userEvent.click(screen.getByRole("button", { name: /expand/i }));

      // A second number against one sale would put a hole in the series.
      expect(await screen.findByRole("button", { name: /print invoice/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /issue invoice/i })).not.toBeInTheDocument();
    });

    test("the printed invoice shows IGST for an inter-state sale", async () => {
      const print = vi.spyOn(window, "print").mockImplementation(() => {});
      routeWithInvoice(invoice);
      render(<Orders />);
      await screen.findByText("praveen@example.com");
      await userEvent.click(screen.getByRole("button", { name: /expand/i }));

      await userEvent.click(await screen.findByRole("button", { name: /print invoice/i }));

      expect(await screen.findByText("TAX INVOICE")).toBeInTheDocument();
      // Rendered as "GSTIN: 29ABCDE…", so matched loosely rather than exactly.
      expect(screen.getByText(/29ABCDE1234F1Z5/)).toBeInTheDocument();
      expect(screen.getByText(/Place of supply: Kerala/)).toBeInTheDocument();
      // hidden: true because the invoice is display:none on screen by design —
      // it exists for the printer. Without it these queries would search an
      // empty accessibility tree and pass no matter what rendered.
      expect(screen.getByRole("columnheader", { name: "IGST", hidden: true })).toBeInTheDocument();
      expect(
        screen.queryByRole("columnheader", { name: "CGST", hidden: true }),
      ).not.toBeInTheDocument();
      // HSN per line is not optional on a tax invoice.
      expect(screen.getByRole("cell", { name: "9615", hidden: true })).toBeInTheDocument();
      await waitFor(() => expect(print).toHaveBeenCalled());
    });

    test("an unregistered shop prints a bill of supply with no tax columns", async () => {
      const print = vi.spyOn(window, "print").mockImplementation(() => {});
      routeWithInvoice({
        ...invoice,
        is_tax_invoice: false,
        seller_gstin: null,
        igst: "0.00",
        taxable_value: "499.00",
        lines: [{ ...invoice.lines[0], gst_rate: "0", igst: "0.00", taxable_value: "499.00" }],
      });
      render(<Orders />);
      await screen.findByText("praveen@example.com");
      await userEvent.click(screen.getByRole("button", { name: /expand/i }));

      await userEvent.click(await screen.findByRole("button", { name: /print invoice/i }));

      // Claiming a registration the shop does not have would be worse than
      // showing no tax at all.
      expect(await screen.findByText("BILL OF SUPPLY")).toBeInTheDocument();
      expect(
        screen.queryByRole("columnheader", { name: "IGST", hidden: true }),
      ).not.toBeInTheDocument();
      expect(screen.getByText(/Not registered for GST/)).toBeInTheDocument();
      await waitFor(() => expect(print).toHaveBeenCalled());
    });
  });

  test("a flagged order is called out with its reason", async () => {
    routeApi({ orders: [order({ flagged: true, flag_reason: "Price mismatch at checkout" })] });
    render(<Orders />);

    const row = await screen.findByText("praveen@example.com");
    expect(within(row.closest("tr") as HTMLElement).getByText(/flagged/i)).toBeInTheDocument();
  });
});

describe("a staff session", () => {
  /**
   * Staff pick, pack and dispatch. The server refuses payment, refunds,
   * invoicing, deletion and return decisions for them outright, so every one
   * of those controls would 403 on click. Painting a button that always fails
   * reads as the console being broken rather than as the role working.
   *
   * These assert the painting only. The boundary itself is
   * backend/tests/test_roles_staff.py.
   */
  test("can still move an order through dispatch", async () => {
    routeApi({});
    render(<Orders canManageMoney={false} />);
    await screen.findByText("praveen@example.com");

    const statuses = screen.getAllByRole("combobox");
    expect(statuses).toHaveLength(1);
    await userEvent.selectOptions(statuses[0], "shipped");

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        expect.stringContaining("/status?status=shipped"),
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
  });

  test("sees whether an order is paid, but cannot change it", async () => {
    /** Whether the money arrived decides whether it should be packed at all,
     * so hiding the payment state entirely would break the actual job. */
    routeApi({ orders: [order({ payment_status: "paid" })] });
    render(<Orders canManageMoney={false} />);
    await screen.findByText("praveen@example.com");

    expect(screen.getByText("paid")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "refunded" })).not.toBeInTheDocument();
  });

  test("is not offered refunds, invoicing or deletion", async () => {
    routeApi({ orders: [order({ payment_status: "paid" })] });
    render(<Orders canManageMoney={false} />);
    await userEvent.click(await screen.findByRole("button", { name: /expand/i }));

    expect(screen.queryByRole("button", { name: /Delete order/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record refund" })).not.toBeInTheDocument();
    // The whole invoice panel, not just its button: issuing burns a number in
    // a legal series, and reading one is no more a packer's job than issuing.
    expect(screen.queryByText("Invoice")).not.toBeInTheDocument();
  });

  test("can still flag an order for the owner", async () => {
    /** Without this, somebody who spots a problem has no way to raise it. */
    routeApi({});
    render(<Orders canManageMoney={false} />);
    await userEvent.click(await screen.findByRole("button", { name: /expand/i }));

    expect(screen.getByRole("button", { name: /Flag for review/ })).toBeInTheDocument();
  });

  test("an owner still gets every money control", async () => {
    /** The gate defaults to open, so this is the guard against it being wired
     * the wrong way round and quietly hiding the owner's own buttons. */
    routeApi({ orders: [order({ payment_status: "paid" })] });
    render(<Orders />);
    await userEvent.click(await screen.findByRole("button", { name: /expand/i }));

    // Asserted by the same names the staff test queries for, so those
    // negatives cannot pass by simply naming a button that never existed.
    expect(screen.getByRole("button", { name: /Delete order/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record refund" })).toBeInTheDocument();
    expect(screen.getByText("Invoice")).toBeInTheDocument();
    expect(screen.getAllByRole("combobox").length).toBeGreaterThan(1);
  });
});

describe("the abandoned payment tab", () => {
  /**
   * "Abandoned" is not a fulfilment status, and that is the whole point: a
   * prepaid order left unpaid is a sale that did not happen, while a COD
   * order left unpaid is a sale that did and still needs packing. Both sit at
   * pending/unpaid. The server draws the line; these cover the screen asking
   * for it correctly and saying what it is showing.
   */
  test("asks the server for abandoned checkouts, not for a status", async () => {
    routeApi({});
    render(<Orders />);
    await screen.findByText("praveen@example.com");

    await userEvent.click(screen.getByRole("button", { name: "Abandoned payment" }));

    await waitFor(() => {
      const asked = apiFetch.mock.calls.map((c) => String(c[0]));
      expect(asked.some((p) => p.includes("abandoned=true"))).toBe(true);
    });
    const last = String(apiFetch.mock.calls.at(-1)?.[0]);
    expect(last).not.toContain("status=");
  });

  test("leaving the tab drops the filter instead of stacking it", async () => {
    /** Sending both would ask for orders that are shipped and never paid
     * for — a set that should always be empty. */
    routeApi({});
    render(<Orders />);
    await screen.findByText("praveen@example.com");

    await userEvent.click(screen.getByRole("button", { name: "Abandoned payment" }));
    await waitFor(() =>
      expect(String(apiFetch.mock.calls.at(-1)?.[0])).toContain("abandoned=true"),
    );

    await userEvent.click(screen.getByRole("button", { name: "Shipped" }));

    await waitFor(() => {
      const last = String(apiFetch.mock.calls.at(-1)?.[0]);
      expect(last).toContain("status=shipped");
      expect(last).not.toContain("abandoned");
    });
  });

  test("explains what the list is and what to do with it", async () => {
    /** The label alone does not tell the reader there is nothing to pack. */
    routeApi({});
    render(<Orders />);
    await screen.findByText("praveen@example.com");

    await userEvent.click(screen.getByRole("button", { name: "Abandoned payment" }));

    expect(await screen.findByText(/Nothing\s+to pack/)).toBeInTheDocument();
  });

  test("an empty tab does not claim the shop has no orders", async () => {
    /** Working the list down to zero should read as success, not as an empty
     * shop — which is what the default "No orders yet" would say. */
    apiFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/returns")) return ok([]);
      if (path.includes("abandoned=true")) return ok([]);
      if (path.startsWith("/api/orders/all")) return ok([order()]);
      return ok(null);
    });
    render(<Orders />);
    await screen.findByText("praveen@example.com");

    await userEvent.click(screen.getByRole("button", { name: "Abandoned payment" }));

    expect(await screen.findByText("No abandoned payments.")).toBeInTheDocument();
    expect(screen.queryByText("No orders yet.")).not.toBeInTheDocument();
  });

  test("only one tab reads as selected at a time", async () => {
    routeApi({});
    render(<Orders />);
    await screen.findByText("praveen@example.com");

    await userEvent.click(screen.getByRole("button", { name: "Abandoned payment" }));

    expect(screen.getByRole("button", { name: "Abandoned payment" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // "All" is the empty status value, so a naive check would show it pressed
    // alongside the abandoned tab.
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
