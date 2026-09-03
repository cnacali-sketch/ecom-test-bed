"use client";

// Customer's own past orders. GET /api/orders?user_id=<own id> — the backend
// requires the caller's id to match (or be an admin), so no other account's
// orders can leak here.

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api-client";
import { formatPrice } from "@/lib/format";

interface Order {
  id: string;
  status: string;
  payment_status: string;
  total_amount: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Order received",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

export function OrderHistory({ userId }: { userId: string }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [returnFormFor, setReturnFormFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [returnMessage, setReturnMessage] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/orders?user_id=${userId}`)
      .then(async (res) => {
        if (cancelled) return;
        setOrders(res?.ok ? await res.json() : []);
      })
      .catch(() => !cancelled && setOrders([]));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function submitReturn(orderId: string) {
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, reason: reason.trim() }),
      });
      const body = await res?.json().catch(() => null);
      setReturnMessage((cur) => ({
        ...cur,
        [orderId]: res?.ok
          ? "Return requested — we'll review it shortly."
          : (body?.detail ?? "Could not submit return request."),
      }));
      if (res?.ok) {
        setReturnFormFor(null);
        setReason("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (orders === null) return null; // no loading flash for a section this small
  if (orders.length === 0) return null; // nothing to show yet — keep the account page uncluttered

  return (
    <section className="mt-10 max-w-2xl">
      <h2 className="font-display text-xl italic text-ink">Your orders</h2>
      <ul className="mt-4 divide-y divide-ink/10 border border-ink/10">
        {orders.map((order) => (
          <li key={order.id} className="px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-ink-soft">#{order.id.slice(0, 8)}</p>
                <p className="text-ink">{STATUS_LABEL[order.status] ?? order.status}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-medium text-ink">{formatPrice(Number(order.total_amount))}</span>
                <Link href={`/track-order?order_id=${order.id}`} className="text-xs uppercase tracking-wide text-teal hover:underline">
                  Track
                </Link>
                {order.status === "delivered" && !returnMessage[order.id] && (
                  <button
                    type="button"
                    onClick={() => {
                      // Clear the reason when switching orders — the field is
                      // shared, so leftover text must not carry to another order.
                      setReturnFormFor(returnFormFor === order.id ? null : order.id);
                      setReason("");
                    }}
                    className="text-xs uppercase tracking-wide text-ink-soft hover:text-teal hover:underline"
                  >
                    Request return
                  </button>
                )}
              </div>
            </div>

            {returnFormFor === order.id && (
              <div className="mt-3 space-y-2 border-t border-ink/10 pt-3">
                <label className="block">
                  <span className="block text-xs uppercase tracking-wide text-ink-soft">Reason for return</span>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    className="mt-1 w-full border border-ink/15 bg-card px-2 py-1.5 text-sm text-ink outline-none focus:border-teal"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => submitReturn(order.id)}
                  disabled={submitting || !reason.trim()}
                  className="bg-teal px-4 py-1.5 text-xs uppercase tracking-wide text-white hover:bg-teal-deep disabled:opacity-60"
                >
                  {submitting ? "Submitting…" : "Submit request"}
                </button>
              </div>
            )}

            {returnMessage[order.id] && <p className="mt-2 text-xs text-ink-soft">{returnMessage[order.id]}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
