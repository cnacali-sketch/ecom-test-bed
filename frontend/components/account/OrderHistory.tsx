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

  if (orders === null) return null; // no loading flash for a section this small
  if (orders.length === 0) return null; // nothing to show yet — keep the account page uncluttered

  return (
    <section className="mt-10 max-w-2xl">
      <h2 className="font-display text-xl italic text-ink">Your orders</h2>
      <ul className="mt-4 divide-y divide-ink/10 border border-ink/10">
        {orders.map((order) => (
          <li key={order.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <div>
              <p className="font-mono text-xs text-ink-soft">#{order.id.slice(0, 8)}</p>
              <p className="text-ink">{STATUS_LABEL[order.status] ?? order.status}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-medium text-ink">{formatPrice(Number(order.total_amount))}</span>
              <Link href={`/track-order?order_id=${order.id}`} className="text-xs uppercase tracking-wide text-teal hover:underline">
                Track
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
