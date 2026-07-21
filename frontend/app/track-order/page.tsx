"use client";

// Public order tracking — no login required. The order id itself (an
// unguessable UUID, emailed at checkout) is the credential, matching
// GET /api/orders/{id} on the backend, which is deliberately public for
// exactly this guest-tracking use case.

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api-client";
import { formatPrice } from "@/lib/format";

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: string;
}
interface Order {
  id: string;
  status: string;
  payment_status: string;
  payment_method: string;
  courier: string | null;
  tracking_number: string | null;
  total_amount: string;
  shipping_address: { line1?: string; city?: string; postcode?: string };
  items: OrderItem[];
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Order received",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

function TrackOrderView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderIdParam = searchParams.get("order_id") ?? "";
  const justPlaced = searchParams.get("placed") === "1";

  const [lookupId, setLookupId] = useState(orderIdParam);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(Boolean(orderIdParam));
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!orderIdParam) {
      setOrder(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    apiFetch(`/api/orders/${orderIdParam}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res?.ok) return setNotFound(true);
        setOrder(await res.json());
      })
      .catch(() => !cancelled && setNotFound(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [orderIdParam]);

  function handleLookup(event: React.FormEvent) {
    event.preventDefault();
    if (lookupId.trim()) router.push(`/track-order?order_id=${lookupId.trim()}`);
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <h1 className="font-display text-3xl italic text-ink">Track your order</h1>

      {justPlaced && (
        <p role="status" className="mt-4 border-l-2 border-teal bg-teal/5 px-3 py-2 text-sm text-ink">
          Order placed! We&apos;ve emailed your confirmation. Save this page&apos;s link to check on it any time.
        </p>
      )}

      {!orderIdParam && (
        <form onSubmit={handleLookup} className="mt-8 flex gap-2">
          <input
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            placeholder="Paste your order ID"
            className="w-full border border-ink/15 bg-card px-3 py-2 text-sm text-ink outline-none focus:border-teal"
          />
          <button type="submit" className="shrink-0 bg-teal px-5 py-2 text-xs uppercase tracking-wide text-white hover:bg-teal-deep">
            Track
          </button>
        </form>
      )}

      {loading && <p className="mt-8 text-sm text-ink-soft">Looking up your order…</p>}

      {notFound && (
        <p role="alert" className="mt-8 border-l-2 border-sale bg-sale/5 px-3 py-2 text-sm text-sale">
          We couldn&apos;t find an order with that ID. Check the link from your confirmation email.
        </p>
      )}

      {order && !loading && (
        <div className="mt-8 space-y-6">
          <div>
            <p className="eyebrow">Order</p>
            <p className="font-mono text-sm text-ink-soft">#{order.id.slice(0, 8)}</p>
          </div>

          <div className="border border-ink/10 bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-ink-soft">Status</p>
            <p className="mt-1 text-lg font-semibold text-ink">
              {STATUS_LABEL[order.status] ?? order.status}
            </p>
            {order.courier && (
              <p className="mt-2 text-sm text-ink-soft">
                Shipped via <span className="text-ink">{order.courier}</span>
                {order.tracking_number && <> — tracking <span className="text-ink">{order.tracking_number}</span></>}
              </p>
            )}
          </div>

          <div className="border border-ink/10 bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-ink-soft">Delivering to</p>
            <p className="mt-1 text-sm text-ink">
              {[order.shipping_address.line1, order.shipping_address.city, order.shipping_address.postcode]
                .filter(Boolean)
                .join(", ") || "—"}
            </p>
          </div>

          <div className="border border-ink/10 bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-ink-soft">Items</p>
            <ul className="mt-2 space-y-1 text-sm text-ink-soft">
              {order.items.map((item) => (
                <li key={item.id}>
                  Qty {item.quantity} — {formatPrice(Number(item.unit_price) * item.quantity)}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-ink/10 pt-3 text-sm font-semibold text-ink">
              <span>Total ({order.payment_method === "cod" ? "COD" : "Prepaid"})</span>
              <span>{formatPrice(Number(order.total_amount))}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense fallback={null}>
      <TrackOrderView />
    </Suspense>
  );
}
