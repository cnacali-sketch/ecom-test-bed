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
  Search,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";

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
  created_at: string;
  items: OrderItem[];
}
interface ReturnRequest {
  id: string;
  order_id: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  pickup_requested: boolean;
}

const STATUS = ["pending", "confirmed", "shipped", "delivered", "cancelled", "returned"];
const PAYMENT = ["unpaid", "paid", "refunded"];

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
  refunded: "bg-sale/10 text-sale",
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
}: {
  /** Set when a notification click asked for a specific order — expand and
   * scroll to it once loaded, instead of landing on the unfiltered list. */
  deepLinkOrderId?: string | null;
  onDeepLinkConsumed?: () => void;
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

  useEffect(() => {
    let cancelled = false;
    const term = query.trim();
    // Debounced so typing an AWB doesn't fire a request per keystroke. The
    // first load has an empty query, so it runs immediately.
    const delay = term ? 250 : 0;
    const timer = setTimeout(() => {
      if (cancelled) return;
      if (term) setSearching(true);
      apiFetch(`/api/orders/all${term ? `?q=${encodeURIComponent(term)}` : ""}`)
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
  }, [query]);

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
      const updated = (await res.json()) as Order;
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
            <>
              <p className="mt-3 text-sm text-ink-soft">No orders yet.</p>
              <p className="mt-1 text-xs text-ink-soft/60">
                Orders appear here once customers check out.
              </p>
            </>
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
      {errorBanner}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-[11px] uppercase tracking-wide text-ink-soft">
              <th className="w-8 px-3 py-3" />
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
                        onClick={() => setExpandedId(expanded ? null : o.id)}
                        className="grid h-6 w-6 place-items-center text-ink-soft hover:text-ink"
                      >
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
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
                      <StatusSelect
                        value={o.payment_status}
                        options={PAYMENT}
                        styleMap={PAYMENT_STYLE}
                        onChange={(v) => setPayment(o.id, v)}
                      />
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="border-b border-ink/5 bg-paper-tint/50">
                      <td colSpan={8} className="px-5 py-4">
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
                        <ShippingDetail order={o} onSave={(courier, tracking) => setShipping(o.id, courier, tracking)} />
                        <ReturnRequestDetail
                          request={returnRequest}
                          onResolve={(status) => returnRequest && resolveReturn(returnRequest.id, status)}
                        />
                        <div className="mt-4 flex justify-end border-t border-ink/10 pt-4">
                          <button
                            type="button"
                            onClick={() => deleteOrder(o)}
                            className="flex items-center gap-1.5 border border-sale/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-sale hover:bg-sale hover:text-white"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete order
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
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
  onResolve: (status: "approved" | "rejected") => void;
}) {
  if (!request) return null;

  return (
    <div className="mt-4 border-t border-ink/10 pt-4">
      <p className="text-xs uppercase tracking-wide text-ink-soft">
        Return requested {request.pickup_requested ? "(pickup requested)" : ""}
      </p>
      <p className="mt-1 text-sm text-ink">{request.reason}</p>
      {request.status === "pending" ? (
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
        <p className="mt-1 text-xs font-semibold capitalize text-ink-soft">{request.status}</p>
      )}
    </div>
  );
}

function StatusSelect({
  value,
  options,
  styleMap,
  onChange,
}: {
  value: string;
  options: string[];
  styleMap: Record<string, string>;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`cursor-pointer rounded-full border-0 px-3 py-1 text-xs font-semibold capitalize outline-none ${styleMap[value] ?? "bg-ink/10 text-ink-soft"}`}
    >
      {options.map((opt) => (
        <option key={opt} value={opt} className="bg-card capitalize text-ink">
          {opt}
        </option>
      ))}
    </select>
  );
}
