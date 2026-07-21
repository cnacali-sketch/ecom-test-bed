"use client";

// Orders screen: every order from GET /api/orders/all, with admin controls for
// fulfilment status and payment status (paid / refunded). Both PATCH the backend
// and reflect immediately. Data is admin-gated server-side.

import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";

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

export function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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
  async function patchOrder(id: string, path: string) {
    const res = await apiFetch(`/api/orders/${id}/${path}`, { method: "PATCH" });
    if (res?.ok) {
      const updated = (await res.json()) as Order;
      setOrders((cur) => cur.map((o) => (o.id === id ? updated : o)));
    }
  }
  const setStatus = (id: string, status: string) =>
    patchOrder(id, `status?status=${status}`);
  const setPayment = (id: string, payment: string) =>
    patchOrder(id, `payment?payment_status=${payment}`);

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
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-[11px] uppercase tracking-wide text-ink-soft">
              <th className="px-5 py-3 font-semibold">Order</th>
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
              return (
                <tr key={o.id} className="border-b border-ink/5 last:border-0">
                  <td className="px-5 py-3 font-mono text-xs text-ink-soft">#{o.id.slice(0, 8)}</td>
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
              );
            })}
          </tbody>
        </table>
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
