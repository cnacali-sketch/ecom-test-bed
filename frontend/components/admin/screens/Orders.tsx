"use client";

// Orders screen: every order from GET /api/orders/all, with admin controls for
// fulfilment status, payment status (paid / refunded), and shipping (courier +
// tracking number). All PATCH the backend and reflect immediately. Data is
// admin-gated server-side.

import { Fragment, useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Printer,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";

import { siteConfig } from "@/content/site.config";
import { rupee } from "@/lib/admin/helpers";
import { apiFetch } from "@/lib/api-client";

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: string;
  /** Eager-loaded by the API. Null only if the product was deleted after the
   * order was placed — the order still has to render. */
  product: { id: string; name: string; sku: string; slug: string; images: string[] } | null;
}
interface ShippingAddress {
  full_name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  phone?: string;
}
interface Order {
  id: string;
  user_id: string;
  status: string;
  payment_status: string;
  payment_method: string;
  courier: string | null;
  tracking_number: string | null;
  shipping_address: ShippingAddress;
  total_amount: string;
  flagged: boolean;
  flag_reason: string | null;
  ip_address: string | null;
  /** "Android · Chrome (Mobile)". Derived server-side from the User-Agent. */
  device?: string;
  /** The payment Razorpay actually captured — what a bank settlement line
   * refers to, and what Razorpay's own refund needs. */
  razorpay_payment_id?: string | null;
  /** Cumulative across partial refunds. "0.00" means nothing refunded. */
  refund_amount?: string;
  refunded_at?: string | null;
  refund_reference?: string | null;
  /** COD collects a deposit online; the balance is owed at the door. The
   * packing slip has to show the courier what to collect. */
  deposit_amount?: string;
  deposit_paid?: boolean;
  created_at: string;
  items: OrderItem[];
}
interface InvoiceLine {
  description: string;
  sku: string;
  hsn: string;
  quantity: number;
  unit_price: string;
  gross: string;
  gst_rate: string;
  taxable_value: string;
  cgst: string;
  sgst: string;
  igst: string;
}
interface Invoice {
  id: string;
  order_id: string;
  number: string;
  issued_at: string;
  /** False means a bill of supply — the shop has no GSTIN, so no tax was
   * charged and none is shown. */
  is_tax_invoice: boolean;
  seller_name: string;
  seller_gstin: string | null;
  seller_address: string;
  seller_state: string;
  buyer_name: string;
  buyer_address: string;
  place_of_supply: string;
  intra_state: boolean;
  taxable_value: string;
  cgst: string;
  sgst: string;
  igst: string;
  total: string;
  lines: InvoiceLine[];
}
interface ReturnRequest {
  id: string;
  order_id: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  pickup_requested: boolean;
}

const STATUS = ["pending", "confirmed", "shipped", "delivered", "cancelled", "returned"];
// "partially_refunded" is set by recording a refund, never chosen from the
// dropdown — picking it by hand would claim money went back without saying how
// much. It still has to appear here so the select can display an order that is
// already in that state.
const PAYMENT = ["unpaid", "paid", "partially_refunded", "refunded"];

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-ink/10 text-ink-soft",
  confirmed: "bg-teal/10 text-teal",
  shipped: "bg-teal/10 text-teal",
  delivered: "bg-emerald-600/10 text-emerald-700",
  cancelled: "bg-sale/10 text-sale",
  returned: "bg-gold/15 text-gold",
};
const PAYMENT_STYLE: Record<string, string> = {
  unpaid: "bg-ink/10 text-ink-soft",
  paid: "bg-emerald-600/10 text-emerald-700",
  // Gold, not the full refund red: part of the money is still the shop's, and
  // the two states need to be distinguishable at a glance down the column.
  partially_refunded: "bg-gold/15 text-gold",
  refunded: "bg-sale/10 text-sale",
};

/** "partially_refunded" -> "Partly refunded". */
const PAYMENT_LABEL: Record<string, string> = {
  partially_refunded: "Partly refunded",
};

function addressLine(a: ShippingAddress): string {
  return [a.line1, a.line2, a.city, a.state, a.postcode, a.country].filter(Boolean).join(", ") || "—";
}

/**
 * The address block as a courier's form wants it: recipient, street, city,
 * pincode, phone — one field per line.
 *
 * Deliberately not the comma-joined one-liner above. Delhivery and Shiprocket
 * both take a multi-line address, and pasting a single comma-run means
 * re-splitting it by hand for every shipment.
 */
function addressForCopy(order: Order): string {
  const a = order.shipping_address;
  return [
    a.full_name,
    a.line1,
    a.line2,
    [a.city, a.state].filter(Boolean).join(", "),
    a.postcode,
    a.country,
    a.phone && `Phone: ${a.phone}`,
    `Order: #${order.id.slice(0, 8)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** "2 x Tortoise Claw Clip" / "Claw Clip + 2 more" — readable at a glance. */
function itemSummary(order: Order): string {
  if (order.items.length === 0) return "—";
  const [first, ...rest] = order.items;
  const name = first.product?.name ?? "Deleted product";
  const head = first.quantity > 1 ? `${first.quantity} × ${name}` : name;
  return rest.length > 0 ? `${head} + ${rest.length} more` : head;
}

/** "11 Sep 2026, 5:41 pm" — local time, which is what the owner reasons in. */
function formatPlaced(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function Orders({
  deepLinkOrderId,
  onDeepLinkConsumed,
  canManageMoney = true,
}: {
  /** Set when a notification click asked for a specific order — expand and
   * scroll to it once loaded, instead of landing on the unfiltered list. */
  deepLinkOrderId?: string | null;
  onDeepLinkConsumed?: () => void;
  /** False for a staff session: hides payment, refunds, invoicing, deletion
   * and return decisions. This only decides what is painted — the server
   * refuses all five for staff regardless (see require_admin in
   * backend/app/routers/orders.py). */
  canManageMoney?: boolean;
} = {}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // A PATCH (status/payment/shipping) can fail silently otherwise — a stale
  // session or CSRF mismatch would 401/403 and the dropdown would just
  // snap back with no explanation. Surface it instead of guessing why.
  const [patchError, setPatchError] = useState<string | null>(null);
  // Support search. Sent to the server rather than filtered here: filtering in
  // the browser would only ever search the orders already fetched, and the
  // whole point is to find the one order a caller is asking about.
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  // The morning work queue. Server-side like the search, so it filters every
  // order rather than the page already on screen.
  const [statusFilter, setStatusFilter] = useState("");
  // Not a status — see FILTERS. Kept separate so it composes with search
  // the same way the status tabs do.
  const [abandonedOnly, setAbandonedOnly] = useState(false);
  /** Orders ticked for a bulk action. Ids, not indexes — the list reloads. */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  /** Orders whose packing slips are staged for printing. */
  const [slips, setSlips] = useState<Order[] | null>(null);
  /** Invoices already fetched or issued, keyed by order id. */
  const [invoices, setInvoices] = useState<Record<string, Invoice>>({});
  /** The invoice staged for printing, if any. */
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    let cancelled = false;
    const term = query.trim();
    // Debounced so typing an AWB doesn't fire a request per keystroke. The
    // first load has an empty query, so it runs immediately.
    const delay = term ? 250 : 0;
    const timer = setTimeout(() => {
      if (cancelled) return;
      if (term) setSearching(true);
      const params = new URLSearchParams();
      if (term) params.set("q", term);
      if (statusFilter) params.set("status", statusFilter);
      if (abandonedOnly) params.set("abandoned", "true");
      const qs = params.toString();
      apiFetch(`/api/orders/all${qs ? `?${qs}` : ""}`)
        .then(async (res) => {
          if (cancelled) return;
          if (!res?.ok) return setError(true);
          setOrders((await res.json()) as Order[]);
          setError(false);
        })
        .catch(() => !cancelled && setError(true))
        .finally(() => {
          if (cancelled) return;
          setLoading(false);
          setSearching(false);
        });
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, statusFilter, abandonedOnly]);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/returns")
      .then(async (res) => {
        if (cancelled) return;
        // Swallowed, a failed load hid the whole Returns section as though
        // there were none pending -- the one case an admin must not miss.
        if (!res?.ok) return setPatchError("Return requests couldn't be loaded. Reload to try again.");
        setReturnRequests((await res.json()) as ReturnRequest[]);
      })
      .catch(() => !cancelled && setPatchError("Return requests couldn't be loaded. Reload to try again."));
    return () => {
      cancelled = true;
    };
  }, []);

  // Expand + scroll to a notification's specific order once the list has
  // loaded. Runs once per deep-link (consumed via the callback) rather than
  // on every render, so manually collapsing the row afterward sticks.
  useEffect(() => {
    if (!deepLinkOrderId || orders.length === 0) return;
    const target = orders.find((o) => o.id === deepLinkOrderId);
    if (!target) return;
    setExpandedId(target.id);
    document.getElementById(`order-row-${target.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    onDeepLinkConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deep-link is a one-shot action, not a value to keep syncing on
  }, [deepLinkOrderId, orders]);

  // PATCH a single field and swap the returned order into local state.
  async function patchOrder(id: string, path: string, params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await apiFetch(`/api/orders/${id}/${path}${query ? `?${query}` : ""}`, { method: "PATCH" });
    if (res?.ok) {
      // Guarded because the consequence is out of all proportion to the cause:
      // splicing a null into the list makes the next render throw on
      // `o.flagged` and takes the whole Orders screen down. A 200 whose body
      // is not an order means the change was applied but the response was
      // unusable, so say so rather than corrupt the list.
      const updated = (await res.json().catch(() => null)) as Order | null;
      if (!updated?.id) {
        setPatchError("The change was saved, but the order couldn't be refreshed. Reload to confirm.");
        return true;
      }
      setOrders((cur) => cur.map((o) => (o.id === id ? updated : o)));
      setPatchError(null);
      return true;
    }
    if (!res) {
      setPatchError("Couldn't reach the server. Check your connection and try again.");
    } else if (res.status === 401 || res.status === 403) {
      setPatchError("Your admin session has expired. Please log out and log back in.");
    } else {
      const body = await res.json().catch(() => null);
      setPatchError(body?.detail ?? `Update failed (HTTP ${res.status}).`);
    }
    return false;
  }
  const setStatus = (id: string, status: string) => patchOrder(id, "status", { status });
  const setPayment = (id: string, payment_status: string) => patchOrder(id, "payment", { payment_status });
  const setShipping = (id: string, courier: string, tracking_number: string) =>
    patchOrder(id, "shipping", { courier, tracking_number });

  /**
   * Permanently delete an order.
   *
   * Confirmed twice over: the browser prompt here, and the server's own refusal
   * to delete anything marked paid. Deleting also returns the stock the order
   * reserved, which is why the prompt says so — clearing out test orders
   * otherwise leaks that inventory silently.
   */
  async function deleteOrder(order: Order) {
    const label = `#${order.id.slice(0, 8)}`;
    const confirmed = window.confirm(
      `Delete order ${label} permanently?\n\n` +
        `Customer: ${order.user_id}\n` +
        `Total: ${rupee(Number(order.total_amount))}\n\n` +
        `The stock it reserved goes back to inventory. This cannot be undone.`,
    );
    if (!confirmed) return;

    const res = await apiFetch(`/api/orders/${order.id}`, { method: "DELETE" });
    if (res?.ok || res?.status === 204) {
      setOrders((cur) => cur.filter((o) => o.id !== order.id));
      setExpandedId((cur) => (cur === order.id ? null : cur));
      setPatchError(null);
      return;
    }
    if (!res) {
      setPatchError("Couldn't reach the server. Check your connection and try again.");
    } else if (res.status === 401 || res.status === 403) {
      setPatchError("Your admin session has expired. Please log out and log back in.");
    } else {
      // A 409 carries the "this order is paid, refund it first" explanation —
      // show the server's own wording rather than a generic failure.
      const body = await res.json().catch(() => null);
      setPatchError(body?.detail ?? `Couldn't delete order ${label} (HTTP ${res.status}).`);
    }
  }

  /**
   * Record money going back to the customer.
   *
   * This writes the ledger entry; it does not move money. The refund itself is
   * issued in the Razorpay dashboard, or handed back in cash for COD — which is
   * why the reference field matters, since it is the only link between the two.
   */
  async function refundOrder(id: string, amount: string, reference: string): Promise<boolean> {
    const res = await apiFetch(`/api/orders/${id}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, reference: reference.trim() || null }),
    });
    if (res?.ok) {
      // Guarded because the consequence is out of all proportion to the cause:
      // splicing a null into the list makes the next render throw on
      // `o.flagged` and takes the whole Orders screen down. A 200 whose body
      // is not an order means the change was applied but the response was
      // unusable, so say so rather than corrupt the list.
      const updated = (await res.json().catch(() => null)) as Order | null;
      if (!updated?.id) {
        setPatchError("The change was saved, but the order couldn't be refreshed. Reload to confirm.");
        return true;
      }
      setOrders((cur) => cur.map((o) => (o.id === id ? updated : o)));
      setPatchError(null);
      return true;
    }
    if (!res) {
      setPatchError("Couldn't reach the server. Check your connection and try again.");
    } else if (res.status === 401 || res.status === 403) {
      setPatchError("Your admin session has expired. Please log out and log back in.");
    } else {
      // 422 carries the "exceeds what is still refundable" arithmetic and 409
      // the "this order was never paid" reason — both are worth showing
      // verbatim rather than flattening into a generic failure.
      const body = await res.json().catch(() => null);
      setPatchError(body?.detail ?? `Couldn't record the refund (HTTP ${res.status}).`);
    }
    return false;
  }

  /**
   * Move every ticked order to one status in a single request.
   *
   * The server applies them in one transaction, so a batch that would oversell
   * on reinstatement is refused whole rather than half-applied — nothing on
   * screen could say which half had moved.
   */
  async function bulkStatus(status: string) {
    const ids = [...selected];
    if (ids.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    try {
      const res = await apiFetch("/api/orders/bulk/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_ids: ids, status }),
      });
      if (res?.ok) {
        const updated = (await res.json().catch(() => null)) as Order[] | null;
        if (Array.isArray(updated)) {
          const byId = new Map(updated.map((o) => [o.id, o]));
          setOrders((cur) => cur.map((o) => byId.get(o.id) ?? o));
        }
        setSelected(new Set());
        setPatchError(null);
        // A status filter is a live queue: orders that just moved out of it
        // should leave the list rather than linger as stale rows.
        if (statusFilter && !statusFilter.split(",").includes(status)) {
          setOrders((cur) => cur.filter((o) => !ids.includes(o.id)));
        }
        return;
      }
      if (!res) {
        setPatchError("Couldn't reach the server. Check your connection and try again.");
      } else if (res.status === 401 || res.status === 403) {
        setPatchError("Your admin session has expired. Please log out and log back in.");
      } else {
        const body = await res.json().catch(() => null);
        setPatchError(body?.detail ?? `Couldn't update those orders (HTTP ${res.status}).`);
      }
    } finally {
      setBulkBusy(false);
    }
  }

  /**
   * Issue the invoice for an order, or fetch the one it already has.
   *
   * Issuing is deliberately a decision someone makes, not something that
   * happens on payment: an invoice number is a legal record, and one raised
   * against a test order cannot be quietly removed without leaving a hole in
   * the series.
   */
  async function loadInvoice(orderId: string, issue: boolean): Promise<void> {
    const res = await apiFetch(
      `/api/orders/${orderId}/invoice`,
      issue ? { method: "POST" } : undefined,
    );
    if (res?.ok) {
      const invoice = (await res.json().catch(() => null)) as Invoice | null;
      if (invoice?.id) {
        setInvoices((cur) => ({ ...cur, [orderId]: invoice }));
        setPatchError(null);
      }
      return;
    }
    // A 404 on the fetch just means none has been issued yet — that is the
    // normal state of a new order, not a failure worth shouting about.
    if (!issue && res?.status === 404) return;
    if (!res) {
      setPatchError("Couldn't reach the server. Check your connection and try again.");
    } else if (res.status === 401 || res.status === 403) {
      setPatchError("Your admin session has expired. Please log out and log back in.");
    } else {
      const body = await res.json().catch(() => null);
      setPatchError(body?.detail ?? `Couldn't issue the invoice (HTTP ${res.status}).`);
    }
  }

  function printOneInvoice(invoice: Invoice) {
    setPrintInvoice(invoice);
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }

  /** Stage the ticked orders' slips, then hand the browser its print dialog. */
  function printSlips() {
    const chosen = orders.filter((o) => selected.has(o.id));
    if (chosen.length === 0) return;
    setSlips(chosen);
    // One frame so React has committed the slips before the dialog captures
    // the page — printing an empty container is the classic failure here.
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }

  const toggleOne = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  function toggleFlag(order: Order) {
    if (order.flagged) {
      patchOrder(order.id, "flag", { flagged: "false" });
      return;
    }
    const reason = prompt(`Reason for flagging order #${order.id.slice(0, 8)}?`, "");
    if (reason === null) return; // cancelled
    patchOrder(order.id, "flag", { flagged: "true", reason: reason.trim() || "Flagged for review" });
  }

  // Approving/rejecting also mutates the order (refund + restock on approve),
  // so re-fetch both lists rather than trying to hand-patch order state here.
  async function resolveReturn(requestId: string, status: "approved" | "rejected") {
    const res = await apiFetch(`/api/returns/${requestId}?status=${status}`, { method: "PATCH" });
    if (!res?.ok) {
      if (res && (res.status === 401 || res.status === 403)) {
        setPatchError("Your admin session has expired. Please log out and log back in.");
      } else {
        const body = await res?.json().catch(() => null);
        setPatchError(body?.detail ?? "Couldn't resolve the return request. Please try again.");
      }
      return;
    }
    setPatchError(null);
    const [ordersRes, returnsRes] = await Promise.all([apiFetch("/api/orders/all"), apiFetch("/api/returns")]);
    if (ordersRes?.ok) setOrders((await ordersRes.json()) as Order[]);
    if (returnsRes?.ok) setReturnRequests((await returnsRes.json()) as ReturnRequest[]);
  }

  if (loading) return <p className="p-8 text-sm text-ink-soft">Loading orders…</p>;
  if (error)
    return <p className="p-8 text-sm text-sale">Couldn&apos;t load orders. Check you&apos;re signed in as an admin.</p>;

  // Hoisted so the zero-orders branch below can show it too — a failed
  // returns fetch on a shop with no orders yet would otherwise be invisible.
  const errorBanner = patchError && (
    <div className="flex items-center justify-between gap-3 border-b border-sale/30 bg-sale/5 px-5 py-3 text-xs text-sale">
      <span className="flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {patchError}
      </span>
      <button type="button" onClick={() => setPatchError(null)} className="font-semibold uppercase tracking-wide hover:underline">
        Dismiss
      </button>
    </div>
  );

  // "Open" is the working queue: everything still owed to a customer. The rest
  // map one-to-one onto a fulfilment status.
  const FILTERS: { value: string; label: string; abandoned?: boolean }[] = [
    { value: "", label: "All" },
    { value: "pending,confirmed", label: "Open" },
    { value: "pending", label: "Pending" },
    { value: "shipped", label: "Shipped" },
    { value: "delivered", label: "Delivered" },
    { value: "cancelled,returned", label: "Cancelled / returned" },
    // Not a status, which is the point of it. A prepaid order left unpaid is
    // a sale that did not happen; a COD order left unpaid is a sale that did
    // and still needs packing. Both sit at pending/unpaid and are
    // indistinguishable under "Pending".
    { value: "abandoned", label: "Abandoned payment", abandoned: true },
  ];

  const filterTabs = (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Filter orders by status">
      {FILTERS.map((f) => {
        const active = f.abandoned ? abandonedOnly : !abandonedOnly && statusFilter === f.value;
        return (
          <button
            key={f.value || "all"}
            type="button"
            aria-pressed={active}
            onClick={() => {
              // The two are mutually exclusive: "abandoned" already implies
              // pending, and sending both would ask for orders that are
              // shipped and never paid for.
              setAbandonedOnly(Boolean(f.abandoned));
              setStatusFilter(f.abandoned ? "" : f.value);
              // Selection is meaningless once the visible set changes.
              setSelected(new Set());
            }}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              active
                ? "bg-teal text-white"
                : "bg-ink/5 text-ink-soft hover:bg-ink/10 hover:text-ink"
            }`}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );

  const searchBox = (
    <label className="relative block w-full sm:w-80">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft/60" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        // Spelling out what is searchable matters more than brevity here: an
        // admin on a support call needs to know they can paste the AWB.
        placeholder="Search AWB, phone, email, order #…"
        aria-label="Search orders by tracking number, phone, email or order id"
        className="w-full border border-ink/15 bg-card py-1.5 pl-8 pr-8 text-sm text-ink outline-none focus:border-teal"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-soft/60 hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </label>
  );

  // A search that matches nothing must not read as "this shop has no orders".
  if (orders.length === 0)
    return (
      <div className="overflow-hidden rounded-2xl border border-dashed border-ink/20 bg-card">
        {errorBanner}
        <div className="flex flex-col gap-3 border-b border-ink/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
            <ShoppingBag className="h-4 w-4 text-teal" /> Orders
          </h3>
          {searchBox}
        </div>
        <div className="border-b border-ink/10 px-5 py-3">{filterTabs}</div>
        <div className="p-16 text-center">
          <ShoppingBag className="mx-auto h-8 w-8 text-ink-soft/40" />
          {query.trim() ? (
            <>
              <p className="mt-3 text-sm text-ink-soft">
                No order matches “{query.trim()}”.
              </p>
              <p className="mt-1 text-xs text-ink-soft/60">
                Tracking number, courier, phone, pincode, email or order number all work.
              </p>
            </>
          ) : (
            abandonedOnly ? (
            <>
              <p className="mt-3 text-sm text-ink-soft">No abandoned payments.</p>
              <p className="mt-1 text-xs text-ink-soft/60">
                Every prepaid checkout either completed or has been closed off.
              </p>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm text-ink-soft">No orders yet.</p>
              <p className="mt-1 text-xs text-ink-soft/60">
                Orders appear here once customers check out.
              </p>
            </>
          )
          )}
        </div>
      </div>
    );

  return (
    <div className="rounded-2xl border border-ink/10 bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-ink/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
          <ShoppingBag className="h-4 w-4 text-teal" />
          {query.trim() ? `Orders (${orders.length} found)` : `Orders (${orders.length})`}
          {searching && <span className="text-xs font-normal text-ink-soft">searching…</span>}
          {orders.some((o) => o.flagged) && (
            <span className="flex items-center gap-1 rounded-full bg-sale/10 px-2 py-0.5 text-xs font-semibold text-sale">
              <AlertTriangle className="h-3 w-3" /> {orders.filter((o) => o.flagged).length} flagged
            </span>
          )}
        </h3>
        {searchBox}
      </div>
      {abandonedOnly && (
        <p className="border-b border-gold/20 bg-gold/5 px-5 py-2.5 text-xs text-ink-soft">
          Checkouts where the customer opened the payment page and left. Nothing
          to pack — either chase them, or cancel the order to close it off.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-5 py-3">
        {filterTabs}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-ink">{selected.size} selected</span>
            <select
              value=""
              disabled={bulkBusy}
              onChange={(e) => e.target.value && bulkStatus(e.target.value)}
              aria-label="Set status for selected orders"
              className="cursor-pointer border border-ink/15 bg-card px-2 py-1 text-xs font-semibold text-ink outline-none focus:border-teal"
            >
              <option value="">Set status…</option>
              {STATUS.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={printSlips}
              className="flex items-center gap-1.5 border border-ink/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ink-soft hover:border-teal hover:text-teal"
            >
              <Printer className="h-3.5 w-3.5" /> Packing slips
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-xs font-semibold uppercase tracking-wide text-ink-soft hover:text-ink"
            >
              Clear
            </button>
          </div>
        )}
      </div>
      {errorBanner}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-[11px] uppercase tracking-wide text-ink-soft">
              <th className="w-8 px-3 py-3" />
              <th className="w-8 px-1 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all orders"
                  className="accent-teal"
                  checked={orders.length > 0 && selected.size === orders.length}
                  // Indeterminate is the honest state for a partial selection:
                  // an unticked box would imply clicking it selects nothing new.
                  ref={(el) => {
                    if (el) el.indeterminate = selected.size > 0 && selected.size < orders.length;
                  }}
                  onChange={(e) =>
                    setSelected(e.target.checked ? new Set(orders.map((o) => o.id)) : new Set())
                  }
                />
              </th>
              <th className="px-2 py-3 font-semibold">Order</th>
              <th className="px-3 py-3 font-semibold">Customer</th>
              <th className="px-3 py-3 font-semibold">Placed</th>
              <th className="px-3 py-3 font-semibold">Items</th>
              <th className="px-3 py-3 font-semibold">Total</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Payment</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const expanded = expandedId === o.id;
              const returnRequest = returnRequests.find((r) => r.order_id === o.id) ?? null;
              return (
                <Fragment key={o.id}>
                  <tr
                    id={`order-row-${o.id}`}
                    className={`border-b border-ink/5 last:border-0 ${o.flagged ? "bg-sale/5" : ""} ${expanded ? "ring-1 ring-inset ring-teal/30" : ""}`}
                  >
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        aria-label={expanded ? "Collapse" : "Expand shipping details"}
                        onClick={() => {
                          const next = expanded ? null : o.id;
                          setExpandedId(next);
                          // Ask whether this order already has an invoice the
                          // first time it is opened, so the button can say
                          // "View" rather than offering to issue a second one.
                          if (next && !invoices[o.id]) loadInvoice(o.id, false);
                        }}
                        className="grid h-6 w-6 place-items-center text-ink-soft hover:text-ink"
                      >
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="px-1 py-3">
                      <input
                        type="checkbox"
                        className="accent-teal"
                        checked={selected.has(o.id)}
                        onChange={() => toggleOne(o.id)}
                        aria-label={`Select order ${o.id.slice(0, 8)}`}
                      />
                    </td>
                    <td className="px-2 py-3 font-mono text-xs text-ink-soft">
                      <span className="flex items-center gap-1.5">
                        #{o.id.slice(0, 8)}
                        {o.flagged && (
                          <span
                            title={o.flag_reason ?? "Flagged for review"}
                            className="flex items-center gap-0.5 rounded-full bg-sale/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sale"
                          >
                            <AlertTriangle className="h-3 w-3" /> Flagged
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-ink">{o.user_id}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-ink-soft">
                      {formatPlaced(o.created_at)}
                    </td>
                    <td className="px-3 py-3 text-ink-soft">
                      {/* The count alone said nothing. Naming the first product
                          means the common single-item order is readable without
                          expanding the row at all. */}
                      <span className="block max-w-[15rem] truncate" title={itemSummary(o)}>
                        {itemSummary(o)}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-semibold text-ink">{rupee(Number(o.total_amount))}</td>
                    <td className="px-3 py-3">
                      <StatusSelect
                        value={o.status}
                        options={STATUS}
                        styleMap={STATUS_STYLE}
                        onChange={(v) => setStatus(o.id, v)}
                      />
                    </td>
                    <td className="px-5 py-3">
                      {canManageMoney ? (
                        <StatusSelect
                          value={o.payment_status}
                          options={PAYMENT}
                          styleMap={PAYMENT_STYLE}
                          labelMap={PAYMENT_LABEL}
                          onChange={(v) => setPayment(o.id, v)}
                        />
                      ) : (
                        // Still shown, just not changeable: whether an order is
                        // paid decides whether it should be packed at all.
                        <span className={`px-2 py-0.5 text-xs font-semibold capitalize ${PAYMENT_STYLE[o.payment_status] ?? ""}`}>
                          {PAYMENT_LABEL[o.payment_status] ?? o.payment_status}
                        </span>
                      )}
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="border-b border-ink/5 bg-paper-tint/50">
                      <td colSpan={9} className="px-5 py-4">
                        {o.flagged && (
                          <div className="mb-4 flex items-start justify-between gap-2 border border-sale/30 bg-sale/5 px-3 py-2 text-xs text-sale">
                            <span className="flex items-start gap-2">
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              {o.flag_reason ?? "Flagged for review."}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleFlag(o)}
                              className="shrink-0 font-semibold uppercase tracking-wide hover:underline"
                            >
                              Clear flag
                            </button>
                          </div>
                        )}
                        {!o.flagged && (
                          <button
                            type="button"
                            onClick={() => toggleFlag(o)}
                            className="mb-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft hover:text-sale"
                          >
                            <AlertTriangle className="h-3.5 w-3.5" /> Flag for review
                          </button>
                        )}
                        <OrderLines order={o} />
                        {canManageMoney && (
                          <>
                            <InvoicePanel
                              order={o}
                              invoice={invoices[o.id] ?? null}
                              onIssue={() => loadInvoice(o.id, true)}
                              onPrint={printOneInvoice}
                            />
                            <RefundPanel
                              order={o}
                              onRefund={(amount, reference) => refundOrder(o.id, amount, reference)}
                            />
                          </>
                        )}
                        <ShippingDetail order={o} onSave={(courier, tracking) => setShipping(o.id, courier, tracking)} />
                        <ReturnRequestDetail
                          request={returnRequest}
                          onResolve={
                            canManageMoney
                              ? (status) => returnRequest && resolveReturn(returnRequest.id, status)
                              : undefined
                          }
                        />
                        {canManageMoney && (
                          <div className="mt-4 flex justify-end border-t border-ink/10 pt-4">
                            <button
                              type="button"
                              onClick={() => deleteOrder(o)}
                              className="flex items-center gap-1.5 border border-sale/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-sale hover:bg-sale hover:text-white"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete order
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Rendered only once a print has been asked for, so the slips are never
          in the DOM during normal use. Kept mounted afterwards so a second
          Ctrl+P reprints the same batch rather than an empty page. */}
      {slips && <PackingSlips orders={slips} />}
      {printInvoice && <PrintableInvoice invoice={printInvoice} />}
    </div>
  );
}

/** What was actually bought. The table only ever showed a count. */
function OrderLines({ order }: { order: Order }) {
  const lineTotal = (item: OrderItem) => Number(item.unit_price) * item.quantity;
  const itemsTotal = order.items.reduce((sum, item) => sum + lineTotal(item), 0);
  // Shipping, coupons and the COD deposit all move the order total away from
  // the sum of its lines. Showing both, and only calling out the difference
  // when there is one, keeps the numbers honest without inventing a breakdown
  // the API does not return.
  const difference = Number(order.total_amount) - itemsTotal;

  return (
    <div className="mb-4">
      <p className="text-xs uppercase tracking-wide text-ink-soft">Items</p>
      <table className="mt-1 w-full text-sm">
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-ink/5 last:border-0">
              <td className="py-1.5 pr-2 text-ink">
                {item.product?.name ?? (
                  <span className="text-ink-soft/70">Product deleted since this order</span>
                )}
                {item.product && (
                  <span className="ml-2 font-mono text-[11px] text-ink-soft/60">
                    {item.product.sku}
                  </span>
                )}
              </td>
              <td className="w-16 py-1.5 text-right tabular-nums text-ink-soft">× {item.quantity}</td>
              <td className="w-24 py-1.5 text-right tabular-nums text-ink-soft">
                {rupee(Number(item.unit_price))}
              </td>
              <td className="w-24 py-1.5 text-right font-semibold tabular-nums text-ink">
                {rupee(lineTotal(item))}
              </td>
            </tr>
          ))}
          {Math.abs(difference) >= 0.01 && (
            <tr className="border-b border-ink/5">
              <td colSpan={3} className="py-1.5 pr-2 text-right text-xs text-ink-soft">
                {difference > 0 ? "Shipping / charges" : "Discount"}
              </td>
              <td className="py-1.5 text-right tabular-nums text-ink-soft">
                {rupee(Math.abs(difference))}
              </td>
            </tr>
          )}
          <tr>
            <td colSpan={3} className="py-1.5 pr-2 text-right text-xs uppercase tracking-wide text-ink-soft">
              Order total
            </td>
            <td className="py-1.5 text-right font-semibold tabular-nums text-ink">
              {rupee(Number(order.total_amount))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Issue or reprint the invoice for one order. */
function InvoicePanel({
  order,
  invoice,
  onIssue,
  onPrint,
}: {
  order: Order;
  invoice: Invoice | null;
  onIssue: () => Promise<void>;
  onPrint: (invoice: Invoice) => void;
}) {
  const [busy, setBusy] = useState(false);
  const payable = order.payment_status !== "unpaid";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 border-t border-ink/10 pt-4">
      <div className="flex-1">
        <p className="text-xs uppercase tracking-wide text-ink-soft">Invoice</p>
        {invoice ? (
          <p className="mt-1 text-sm text-ink">
            <span className="select-all font-mono font-semibold">{invoice.number}</span>
            <span className="ml-2 text-xs text-ink-soft">
              {invoice.is_tax_invoice ? "Tax invoice" : "Bill of supply"} ·{" "}
              {formatPlaced(invoice.issued_at)}
            </span>
          </p>
        ) : (
          <p className="mt-1 text-xs text-ink-soft">
            {payable
              ? "Not issued yet. Issuing takes the next number in the series."
              : "An invoice can be issued once this order is marked paid."}
          </p>
        )}
      </div>
      {invoice ? (
        <button
          type="button"
          onClick={() => onPrint(invoice)}
          className="flex items-center gap-1.5 border border-ink/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft hover:border-teal hover:text-teal"
        >
          <Printer className="h-3.5 w-3.5" /> Print invoice
        </button>
      ) : (
        <button
          type="button"
          disabled={!payable || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onIssue();
            } finally {
              setBusy(false);
            }
          }}
          className="border border-teal px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-teal hover:bg-teal hover:text-white disabled:cursor-not-allowed disabled:border-ink/20 disabled:text-ink-soft/60 disabled:hover:bg-transparent"
        >
          {busy ? "Issuing…" : "Issue invoice"}
        </button>
      )}
    </div>
  );
}

/**
 * The invoice as a document.
 *
 * Every figure comes from the stored invoice, never recomputed here: what was
 * issued is what must print, even after a price or an HSN code is corrected
 * later. The layout follows what an Indian tax invoice has to show — seller
 * GSTIN, buyer, place of supply, HSN per line, and the tax split.
 */
function PrintableInvoice({ invoice }: { invoice: Invoice }) {
  const cell: React.CSSProperties = { padding: "4px 6px", fontSize: 11, textAlign: "left" };
  const num: React.CSSProperties = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" };

  return (
    <div id="packing-slips" aria-hidden>
      <style>{`
        #packing-slips { display: none; }
        @media print {
          body > * { visibility: hidden !important; }
          #packing-slips, #packing-slips * { visibility: visible !important; }
          #packing-slips {
            display: block !important;
            position: absolute; left: 0; top: 0; width: 100%;
            color: #000; background: #fff;
          }
          .slip { padding: 16mm 14mm; }
          .slip table { width: 100%; border-collapse: collapse; }
          .slip th, .slip td { border: 1px solid #666; }
        }
      `}</style>
      <section className="slip">
        <div style={{ textAlign: "center", marginBottom: 10 }}>
          <strong style={{ fontSize: 15, letterSpacing: "0.06em" }}>
            {invoice.is_tax_invoice ? "TAX INVOICE" : "BILL OF SUPPLY"}
          </strong>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
          <div style={{ flex: 1, fontSize: 11, lineHeight: 1.5 }}>
            <strong style={{ fontSize: 13 }}>{invoice.seller_name}</strong>
            <div style={{ whiteSpace: "pre-line" }}>{invoice.seller_address}</div>
            {invoice.seller_gstin && <div>GSTIN: {invoice.seller_gstin}</div>}
            <div>State: {invoice.seller_state}</div>
          </div>
          <div style={{ fontSize: 11, lineHeight: 1.5, textAlign: "right" }}>
            <div>
              Invoice no: <strong>{invoice.number}</strong>
            </div>
            <div>Date: {formatPlaced(invoice.issued_at)}</div>
            <div>Order: #{invoice.order_id.slice(0, 8)}</div>
          </div>
        </div>

        <div style={{ marginTop: 10, fontSize: 11, lineHeight: 1.5 }}>
          <div style={{ fontWeight: 700 }}>Billed to</div>
          <div>{invoice.buyer_name || "—"}</div>
          <div style={{ whiteSpace: "pre-line" }}>{invoice.buyer_address}</div>
          {/* Required on the face of the invoice: it is what decides whether
              the tax is CGST+SGST or IGST. */}
          <div>Place of supply: {invoice.place_of_supply || "—"}</div>
        </div>

        <table style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th style={cell}>Description</th>
              <th style={cell}>HSN</th>
              <th style={num}>Qty</th>
              <th style={num}>Taxable</th>
              {invoice.is_tax_invoice &&
                (invoice.intra_state ? (
                  <>
                    <th style={num}>CGST</th>
                    <th style={num}>SGST</th>
                  </>
                ) : (
                  <th style={num}>IGST</th>
                ))}
              <th style={num}>Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, i) => (
              <tr key={`${line.sku}-${i}`}>
                <td style={cell}>{line.description}</td>
                <td style={cell}>{line.hsn || "—"}</td>
                <td style={num}>{line.quantity}</td>
                <td style={num}>{line.taxable_value}</td>
                {invoice.is_tax_invoice &&
                  (invoice.intra_state ? (
                    <>
                      <td style={num}>{line.cgst}</td>
                      <td style={num}>{line.sgst}</td>
                    </>
                  ) : (
                    <td style={num}>{line.igst}</td>
                  ))}
                <td style={num}>{line.gross}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
          <table style={{ width: "52%" }}>
            <tbody>
              <tr>
                <td style={cell}>Taxable value</td>
                <td style={num}>{invoice.taxable_value}</td>
              </tr>
              {invoice.is_tax_invoice && invoice.intra_state && (
                <>
                  <tr>
                    <td style={cell}>CGST</td>
                    <td style={num}>{invoice.cgst}</td>
                  </tr>
                  <tr>
                    <td style={cell}>SGST</td>
                    <td style={num}>{invoice.sgst}</td>
                  </tr>
                </>
              )}
              {invoice.is_tax_invoice && !invoice.intra_state && (
                <tr>
                  <td style={cell}>IGST</td>
                  <td style={num}>{invoice.igst}</td>
                </tr>
              )}
              <tr>
                <td style={{ ...cell, fontWeight: 700 }}>Invoice total</td>
                <td style={{ ...num, fontWeight: 700 }}>{rupee(Number(invoice.total))}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p style={{ marginTop: 12, fontSize: 10, lineHeight: 1.5 }}>
          {invoice.is_tax_invoice
            ? "Prices are inclusive of GST. Tax shown above is contained in the amount charged."
            : "Not registered for GST. No tax has been charged on this supply."}
          <br />
          {siteConfig.contact.email} · {siteConfig.contact.phone}
        </p>
      </section>
    </div>
  );
}

/**
 * Printable packing slips — one page per order.
 *
 * Kept off screen and revealed only to the printer. A separate window would be
 * blocked by popup settings and would have to re-fetch everything it needs;
 * this prints from the orders already in hand.
 *
 * What goes on it is decided by what the packing table and the courier need:
 * who it is for, what should be in the box, and — for COD — exactly how much
 * cash to collect at the door, which is the one number nobody can guess.
 */
function PackingSlips({ orders }: { orders: Order[] }) {
  return (
    <div id="packing-slips" aria-hidden>
      <style>{`
        #packing-slips { display: none; }
        @media print {
          /* Hide the console without unmounting it — display:none on a parent
             would take the slips with it. */
          body > * { visibility: hidden !important; }
          #packing-slips, #packing-slips * { visibility: visible !important; }
          #packing-slips {
            display: block !important;
            position: absolute; left: 0; top: 0; width: 100%;
            color: #000; background: #fff;
          }
          .slip { page-break-after: always; padding: 18mm 14mm; }
          .slip:last-child { page-break-after: auto; }
          .slip table { width: 100%; border-collapse: collapse; }
          .slip th, .slip td { text-align: left; padding: 4px 0; font-size: 12px; }
          .slip thead th { border-bottom: 1px solid #000; }
        }
      `}</style>
      {orders.map((o) => {
        const total = Number(o.total_amount);
        const deposit = o.deposit_paid ? Number(o.deposit_amount ?? 0) : 0;
        const dueOnDelivery = o.payment_method === "cod" ? Math.max(total - deposit, 0) : 0;
        const a = o.shipping_address;
        return (
          <section className="slip" key={o.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <strong style={{ fontSize: 18 }}>{siteConfig.brand.name}</strong>
              <span style={{ fontSize: 12 }}>
                Order #{o.id.slice(0, 8)} · {formatPlaced(o.created_at)}
              </span>
            </div>
            <hr style={{ margin: "10px 0", border: 0, borderTop: "2px solid #000" }} />

            <div style={{ display: "flex", gap: 32, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Deliver to
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>
                  {a.full_name && <div style={{ fontWeight: 700 }}>{a.full_name}</div>}
                  <div>{addressLine(a)}</div>
                  {a.phone && <div>Phone: {a.phone}</div>}
                </div>
              </div>
              <div style={{ width: "38%" }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Shipping
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>
                  <div>{o.courier || "Courier not set"}</div>
                  <div>{o.tracking_number || "No tracking number"}</div>
                </div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style={{ width: 90 }}>SKU</th>
                  <th style={{ width: 40, textAlign: "right" }}>Qty</th>
                </tr>
              </thead>
              <tbody>
                {o.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.product?.name ?? "Product no longer listed"}</td>
                    <td>{item.product?.sku ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 14, fontSize: 13 }}>
              <div>
                Order total: <strong>{rupee(total)}</strong>
              </div>
              {o.payment_method === "cod" ? (
                <div
                  style={{
                    marginTop: 6,
                    padding: "8px 10px",
                    border: "2px solid #000",
                    fontSize: 15,
                    fontWeight: 700,
                  }}
                >
                  {/* The only number the delivery person acts on. Boxed so it
                      survives a bad print and cannot be skimmed past. */}
                  COLLECT ON DELIVERY: {rupee(dueOnDelivery)}
                  {deposit > 0 && (
                    <span style={{ fontWeight: 400, fontSize: 12 }}>
                      {" "}
                      (deposit of {rupee(deposit)} already paid)
                    </span>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: 6, fontWeight: 700 }}>PAID ONLINE — collect nothing</div>
              )}
            </div>

            <p style={{ marginTop: 16, fontSize: 11 }}>
              {/* From the content layer, not typed into the component — the
                  shop's contact details live in one place. */}
              Questions about this order? {siteConfig.contact.email} · {siteConfig.contact.phone}
            </p>
          </section>
        );
      })}
    </div>
  );
}

/**
 * The money side of an order: what was captured, what has gone back, and how
 * to record the next refund.
 *
 * A refund used to be one word on a dropdown. Recording an amount, a date and
 * a reference is what lets the books agree with the bank — and what makes a
 * partial refund expressible at all.
 */
function RefundPanel({
  order,
  onRefund,
}: {
  order: Order;
  onRefund: (amount: string, reference: string) => Promise<boolean>;
}) {
  const total = Number(order.total_amount);
  const refunded = Number(order.refund_amount ?? 0);
  const remaining = Math.max(total - refunded, 0);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  const paid = order.payment_status !== "unpaid";
  const typed = Number(amount);
  const valid = amount !== "" && Number.isFinite(typed) && typed > 0 && typed <= remaining;

  async function submit() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      if (await onRefund(typed.toFixed(2), reference)) {
        setAmount("");
        setReference("");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-4 border-t border-ink/10 pt-4">
      <p className="text-xs uppercase tracking-wide text-ink-soft">Payment</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
        <span className="text-ink">
          Charged <span className="font-semibold tabular-nums">{rupee(total)}</span>
        </span>
        {refunded > 0 && (
          <span className="text-sale">
            Refunded <span className="font-semibold tabular-nums">{rupee(refunded)}</span>
            {order.refunded_at && (
              <span className="ml-1 text-xs text-ink-soft">
                on {formatPlaced(order.refunded_at)}
              </span>
            )}
          </span>
        )}
        {refunded > 0 && remaining > 0 && (
          <span className="text-ink-soft">
            Still refundable <span className="tabular-nums">{rupee(remaining)}</span>
          </span>
        )}
      </div>

      {(order.razorpay_payment_id || order.refund_reference) && (
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-ink-soft">
          {order.razorpay_payment_id && (
            <span className="flex items-center gap-1.5">
              {/* The id a bank settlement line refers to — the one thing that
                  ties money in the account back to this order. */}
              Payment <span className="select-all text-ink">{order.razorpay_payment_id}</span>
              <CopyButton text={order.razorpay_payment_id} label="Copy the payment id" />
            </span>
          )}
          {order.refund_reference && (
            <span>
              Refund ref <span className="select-all text-ink">{order.refund_reference}</span>
            </span>
          )}
        </div>
      )}

      {!paid ? (
        <p className="mt-2 text-xs text-ink-soft">
          Nothing to refund until this order is marked paid.
        </p>
      ) : remaining <= 0 ? (
        <p className="mt-2 text-xs text-ink-soft">Fully refunded.</p>
      ) : (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-xs">
            <span className="block uppercase tracking-wide text-ink-soft">Refund amount</span>
            <input
              type="number"
              min="0.01"
              max={remaining}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={remaining.toFixed(2)}
              aria-label="Refund amount"
              className="mt-1 w-28 border border-ink/15 bg-card px-2 py-1.5 text-sm tabular-nums text-ink outline-none focus:border-teal"
            />
          </label>
          <label className="flex-1 text-xs">
            <span className="block uppercase tracking-wide text-ink-soft">
              Reference (Razorpay refund id, UPI ref, or “cash returned”)
            </span>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              aria-label="Refund reference"
              className="mt-1 w-full border border-ink/15 bg-card px-2 py-1.5 text-sm text-ink outline-none focus:border-teal"
            />
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={!valid || saving}
            className="h-fit shrink-0 border border-sale px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-sale transition-colors hover:bg-sale hover:text-white disabled:cursor-not-allowed disabled:border-ink/20 disabled:text-ink-soft/60 disabled:hover:bg-transparent"
          >
            {saving ? "Recording…" : "Record refund"}
          </button>
          <button
            type="button"
            onClick={() => setAmount(remaining.toFixed(2))}
            className="h-fit shrink-0 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft hover:text-teal"
          >
            Full amount
          </button>
        </div>
      )}
      <p className="mt-1.5 text-[11px] text-ink-soft/70">
        {/* Stated plainly so nobody assumes the customer has been paid. */}
        This records the refund against the order. Move the money in Razorpay, or hand
        it back in cash for COD.
      </p>
    </div>
  );
}

/** Copy-to-clipboard with its own confirmation, so a silent copy isn't
 * mistaken for a dead button. */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard is blocked outside a secure context (plain http on a LAN
      // IP, for instance). Fall back rather than doing nothing at all.
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } finally {
        document.body.removeChild(area);
      }
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className="flex items-center gap-1 border border-ink/15 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft hover:border-teal hover:text-teal"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function ShippingDetail({
  order,
  onSave,
}: {
  order: Order;
  onSave: (courier: string, trackingNumber: string) => Promise<boolean>;
}) {
  const [courier, setCourier] = useState(order.courier ?? "");
  const [tracking, setTracking] = useState(order.tracking_number ?? "");
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    const ok = await onSave(courier, tracking);
    setSaved(ok);
    if (ok) setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-wide text-ink-soft">
            Deliver to ({order.payment_method === "cod" ? "Cash on Delivery" : "Prepaid"})
          </p>
          <CopyButton text={addressForCopy(order)} label="Copy the full shipping address" />
        </div>
        {/* select-all so a drag selects the whole block cleanly, and
            whitespace-pre-line so the copied shape matches what is on screen. */}
        <p className="mt-1 select-all whitespace-pre-line text-sm leading-relaxed text-ink">
          {order.shipping_address.full_name ? (
            <span className="font-semibold">{order.shipping_address.full_name}{"\n"}</span>
          ) : null}
          {addressLine(order.shipping_address)}
        </p>
        {!order.shipping_address.full_name && (
          // A courier will not accept a waybill without a consignee name, so
          // this is a blocker for the shipment, not a cosmetic gap.
          <p className="mt-1 flex items-center gap-1 text-xs text-sale">
            <AlertTriangle className="h-3 w-3 shrink-0" /> No recipient name on this order
          </p>
        )}
        {order.shipping_address.phone && (
          <p className="mt-1 flex items-center gap-2 text-sm text-ink">
            <a href={`tel:${order.shipping_address.phone}`} className="select-all text-teal underline underline-offset-2">
              {order.shipping_address.phone}
            </a>
            <CopyButton text={order.shipping_address.phone} label="Copy the phone number" />
          </p>
        )}
        <p className="mt-2 text-xs text-ink-soft">
          Placed {formatPlaced(order.created_at)}
        </p>
        <p className="mt-0.5 text-xs text-ink-soft">
          {order.device ?? "Unknown device"}
          {order.ip_address && (
            <span className="ml-1 font-mono text-ink-soft/70">· {order.ip_address}</span>
          )}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1 text-xs">
          <span className="block uppercase tracking-wide text-ink-soft">Courier</span>
          <input
            value={courier}
            onChange={(e) => setCourier(e.target.value)}
            placeholder="Delhivery, Shiprocket…"
            className="mt-1 w-full border border-ink/15 bg-card px-2 py-1.5 text-sm text-ink outline-none focus:border-teal"
          />
        </label>
        <label className="flex-1 text-xs">
          <span className="block uppercase tracking-wide text-ink-soft">Tracking number</span>
          <input
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            className="mt-1 w-full border border-ink/15 bg-card px-2 py-1.5 text-sm text-ink outline-none focus:border-teal"
          />
        </label>
        <button
          type="button"
          onClick={handleSave}
          className="h-fit shrink-0 bg-teal px-4 py-1.5 text-xs uppercase tracking-wide text-white hover:bg-teal-deep"
        >
          {saved ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );
}

function ReturnRequestDetail({
  request,
  onResolve,
}: {
  request: ReturnRequest | null;
  /** Undefined for a staff session — the request is still shown, because a
   * packer needs to know a parcel is coming back, but approving it releases
   * stock and commits the shop to a refund, so the decision is the owner's. */
  onResolve?: (status: "approved" | "rejected") => void;
}) {
  if (!request) return null;

  return (
    <div className="mt-4 border-t border-ink/10 pt-4">
      <p className="text-xs uppercase tracking-wide text-ink-soft">
        Return requested {request.pickup_requested ? "(pickup requested)" : ""}
      </p>
      <p className="mt-1 text-sm text-ink">{request.reason}</p>
      {request.status === "pending" && !onResolve && (
        <p className="mt-1 text-xs font-semibold text-ink-soft">
          Awaiting the owner&apos;s decision
        </p>
      )}
      {request.status === "pending" && onResolve ? (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => onResolve("approved")}
            className="bg-teal px-4 py-1.5 text-xs uppercase tracking-wide text-white hover:bg-teal-deep"
          >
            Approve (refund + restock)
          </button>
          <button
            type="button"
            onClick={() => onResolve("rejected")}
            className="border border-ink/15 px-4 py-1.5 text-xs uppercase tracking-wide text-ink-soft hover:bg-ink/5"
          >
            Reject
          </button>
        </div>
      ) : (
        request.status !== "pending" && (
          <p className="mt-1 text-xs font-semibold capitalize text-ink-soft">{request.status}</p>
        )
      )}
    </div>
  );
}

function StatusSelect({
  value,
  options,
  styleMap,
  labelMap,
  onChange,
}: {
  value: string;
  options: string[];
  styleMap: Record<string, string>;
  /** Friendlier wording for values whose stored name reads badly — the
   * default `capitalize` would otherwise render "Partially_refunded". */
  labelMap?: Record<string, string>;
  onChange: (v: string) => void;
}) {
  const label = (opt: string) => labelMap?.[opt] ?? opt;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`cursor-pointer rounded-full border-0 px-3 py-1 text-xs font-semibold capitalize outline-none ${styleMap[value] ?? "bg-ink/10 text-ink-soft"}`}
    >
      {options.map((opt) => (
        <option key={opt} value={opt} className="bg-card capitalize text-ink">
          {label(opt)}
        </option>
      ))}
    </select>
  );
}
