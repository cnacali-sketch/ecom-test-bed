"use client";

// Orders screen: every order from GET /api/orders/all, with admin controls for
// fulfilment status, payment status (paid / refunded), and shipping (courier +
// tracking number). All PATCH the backend and reflect immediately. Data is
// admin-gated server-side.

import { Fragment, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, ShoppingBag } from "lucide-react";

import { rupee } from "@/lib/admin/helpers";
import { apiFetch } from "@/lib/api-client";

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: string;
}
interface Order {
  id: string;
  user_id: string;
  status: string;
  payment_status: string;
  payment_method: string;
  courier: string | null;
  tracking_number: string | null;
  shipping_address: { line1?: string; line2?: string; city?: string; state?: string; postcode?: string; country?: string };
  total_amount: string;
  items: OrderItem[];
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

function addressLine(a: Order["shipping_address"]): string {
  return [a.line1, a.line2, a.city, a.state, a.postcode, a.country].filter(Boolean).join(", ") || "—";
}

export function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/orders/all")
      .then(async (res) => {
        if (cancelled) return;
        if (!res?.ok) return setError(true);
        setOrders((await res.json()) as Order[]);
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // PATCH a single field and swap the returned order into local state.
  async function patchOrder(id: string, path: string, params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await apiFetch(`/api/orders/${id}/${path}${query ? `?${query}` : ""}`, { method: "PATCH" });
    if (res?.ok) {
      const updated = (await res.json()) as Order;
      setOrders((cur) => cur.map((o) => (o.id === id ? updated : o)));
    }
    return res?.ok ?? false;
  }
  const setStatus = (id: string, status: string) => patchOrder(id, "status", { status });
  const setPayment = (id: string, payment_status: string) => patchOrder(id, "payment", { payment_status });
  const setShipping = (id: string, courier: string, tracking_number: string) =>
    patchOrder(id, "shipping", { courier, tracking_number });

  if (loading) return <p className="p-8 text-sm text-ink-soft">Loading orders…</p>;
  if (error)
    return <p className="p-8 text-sm text-sale">Couldn&apos;t load orders. Check you&apos;re signed in as an admin.</p>;

  if (orders.length === 0)
    return (
      <div className="rounded-2xl border border-dashed border-ink/20 bg-card p-16 text-center">
        <ShoppingBag className="mx-auto h-8 w-8 text-ink-soft/40" />
        <p className="mt-3 text-sm text-ink-soft">No orders yet.</p>
        <p className="mt-1 text-xs text-ink-soft/60">
          Orders appear here once customers check out.
        </p>
      </div>
    );

  return (
    <div className="rounded-2xl border border-ink/10 bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
          <ShoppingBag className="h-4 w-4 text-teal" /> Orders ({orders.length})
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-[11px] uppercase tracking-wide text-ink-soft">
              <th className="w-8 px-3 py-3" />
              <th className="px-2 py-3 font-semibold">Order</th>
              <th className="px-3 py-3 font-semibold">Customer</th>
              <th className="px-3 py-3 font-semibold">Items</th>
              <th className="px-3 py-3 font-semibold">Total</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Payment</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const qty = o.items.reduce((s, i) => s + i.quantity, 0);
              const expanded = expandedId === o.id;
              return (
                <Fragment key={o.id}>
                  <tr className="border-b border-ink/5 last:border-0">
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
                    <td className="px-2 py-3 font-mono text-xs text-ink-soft">#{o.id.slice(0, 8)}</td>
                    <td className="px-3 py-3 text-ink">{o.user_id}</td>
                    <td className="px-3 py-3 text-ink-soft">{qty}</td>
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
                      <td colSpan={7} className="px-5 py-4">
                        <ShippingDetail order={o} onSave={(courier, tracking) => setShipping(o.id, courier, tracking)} />
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
        <p className="text-xs uppercase tracking-wide text-ink-soft">
          Deliver to ({order.payment_method === "cod" ? "Cash on Delivery" : "Prepaid"})
        </p>
        <p className="mt-1 text-sm text-ink">{addressLine(order.shipping_address)}</p>
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
