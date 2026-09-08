"use client";

// Overview screen. Every number here is real: product-derived figures come
// from the loaded catalogue, and revenue / orders / the 7-day trend come from
// GET /api/orders/all (fetched once by AdminApp and shared, not re-requested).
//
// Revenue counts paid orders only — an order sitting unpaid is not money in
// the bank, and showing it as revenue would overstate the month.

import { AlertTriangle, Boxes, DollarSign, Package, ShoppingBag } from "lucide-react";

import { hexToRgba, rupee } from "@/lib/admin/helpers";
import { LOW_STOCK, type AdminProduct } from "@/lib/admin/types";
import type { AdminOrderSummary, LoadState } from "../AdminApp";

const TEAL = "#1f6f6b";
const GOLD = "#b08d3f";

const TREND_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Payment states that count as money actually received. */
const PAID = new Set(["paid"]);

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Paid revenue per day for the last TREND_DAYS days, oldest first. */
function dailyRevenue(orders: AdminOrderSummary[]): { label: string; value: number }[] {
  const today = startOfDay(Date.now());
  const buckets = Array.from({ length: TREND_DAYS }, (_, i) => ({
    day: today - (TREND_DAYS - 1 - i) * DAY_MS,
    value: 0,
  }));
  for (const o of orders) {
    if (!PAID.has(o.payment_status)) continue;
    const day = startOfDay(new Date(o.created_at).getTime());
    const bucket = buckets.find((b) => b.day === day);
    if (bucket) bucket.value += Number(o.total_amount) || 0;
  }
  return buckets.map((b) => ({
    label: new Date(b.day).toLocaleDateString("en-IN", { weekday: "short" }),
    value: b.value,
  }));
}

export function Dashboard({
  products,
  orders,
  ordersState = "ready",
}: {
  products: AdminProduct[];
  orders: AdminOrderSummary[];
  /** Whether the order fetch succeeded. A failed fetch must not render as
   * "₹0 revenue, 0 orders" — that reads as a real (terrible) trading day. */
  ordersState?: LoadState;
}) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthCutoff = monthStart.getTime();

  const thisMonth = orders.filter((o) => new Date(o.created_at).getTime() >= monthCutoff);
  const revenue = thisMonth
    .filter((o) => PAID.has(o.payment_status))
    .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const orderCount = thisMonth.length;
  const unpaidCount = thisMonth.filter((o) => !PAID.has(o.payment_status)).length;

  const lowStock = products.filter((p) => p.stock <= LOW_STOCK && p.published);
  const totalValue = products.reduce((s, p) => s + p.cost * p.stock, 0);
  const live = products.filter((p) => p.published).length;

  const ordersFailed = ordersState === "error";
  const ordersLoading = ordersState === "loading";
  const orderFigure = (value: string) => (ordersFailed ? "—" : ordersLoading ? "…" : value);
  const orderNote = ordersFailed ? "unavailable" : ordersLoading ? "loading" : null;

  const stats = [
    {
      label: "Revenue this month",
      value: orderFigure(rupee(revenue)),
      delta: orderNote ?? "paid orders only",
      icon: DollarSign,
      color: TEAL,
    },
    {
      label: "Orders this month",
      value: orderFigure(String(orderCount)),
      delta: orderNote ?? (unpaidCount > 0 ? `${unpaidCount} unpaid` : "all paid"),
      icon: ShoppingBag,
      color: "#7c3aed",
    },
    { label: "Products live", value: live, delta: `${products.length} total`, icon: Package, color: GOLD },
    { label: "Inventory value", value: rupee(totalValue), delta: "cost basis", icon: Boxes, color: "#059669" },
  ];

  const trend = dailyRevenue(orders);
  const trendMax = Math.max(...trend.map((d) => d.value));

  return (
    <div className="space-y-6">
      {ordersFailed && (
        <p className="rounded-xl border border-sale/30 bg-sale/5 px-4 py-3 text-xs text-sale">
          Order data couldn&apos;t be loaded, so revenue, order count and the sales trend are blank
          rather than wrong. Product figures below are unaffected.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-ink/10 bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div
                className="grid h-10 w-10 place-items-center rounded-xl"
                style={{ background: hexToRgba(s.color, 0.12), color: s.color }}
              >
                <s.icon className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-semibold text-ink-soft">{s.delta}</span>
            </div>
            <div className="mt-3 text-2xl font-bold text-ink">{s.value}</div>
            <div className="text-xs text-ink-soft">{s.label}</div>
          </div>
        ))}
      </div>

      {lowStock.length > 0 && (
        <div className="rounded-2xl border border-gold/40 bg-gold/5 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-gold">
            <AlertTriangle className="h-4 w-4" /> Running low on stock ({lowStock.length})
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {lowStock.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg bg-card px-3 py-2 text-sm"
              >
                <span className="truncate font-medium text-ink">{p.name}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${p.stock === 0 ? "bg-sale/10 text-sale" : "bg-gold/15 text-gold"}`}
                >
                  {p.stock} left
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-ink/10 bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-bold text-ink">Paid revenue, last {TREND_DAYS} days</h3>
        {ordersFailed ? (
          <p className="py-10 text-center text-sm text-ink-soft/70">No order data to chart.</p>
        ) : trendMax === 0 ? (
          <p className="py-10 text-center text-sm text-ink-soft/70">
            No paid orders in the last {TREND_DAYS} days.
          </p>
        ) : (
          <div className="flex h-40 items-end gap-2">
            {trend.map((d) => (
              <div key={d.label} className="flex-1" title={`${d.label}: ${rupee(d.value)}`}>
                <div
                  className="w-full rounded-t-lg transition-all hover:opacity-80"
                  style={{
                    height: `${Math.max(2, (d.value / trendMax) * 100)}%`,
                    background: `linear-gradient(180deg, ${GOLD}, ${TEAL})`,
                  }}
                />
              </div>
            ))}
          </div>
        )}
        <div className="mt-2 flex justify-between text-[10px] text-ink-soft/60">
          {trend.map((d, i) => (
            <span key={`${d.label}-${i}`}>{d.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
