"use client";

// Overview screen. Product-derived numbers (products live, inventory value,
// low-stock list) are real, computed from the loaded products. Revenue / orders
// / the 7-day trend are illustrative placeholders until the orders API is wired.

import { AlertTriangle, Boxes, DollarSign, Package, ShoppingBag } from "lucide-react";

import { hexToRgba, rupee } from "@/lib/admin/helpers";
import { LOW_STOCK, type AdminProduct } from "@/lib/admin/types";

const TEAL = "#1f6f6b";
const GOLD = "#b08d3f";

export function Dashboard({ products }: { products: AdminProduct[] }) {
  const orders = 24;
  const revenue = 32450;
  const lowStock = products.filter((p) => p.stock <= LOW_STOCK && p.published);
  const totalValue = products.reduce((s, p) => s + p.cost * p.stock, 0);
  const live = products.filter((p) => p.published).length;

  const stats = [
    { label: "Revenue this month", value: rupee(revenue), delta: "demo", icon: DollarSign, color: TEAL },
    { label: "Orders", value: orders, delta: "demo", icon: ShoppingBag, color: "#7c3aed" },
    { label: "Products live", value: live, delta: `${products.length} total`, icon: Package, color: GOLD },
    { label: "Inventory value", value: rupee(totalValue), delta: "cost basis", icon: Boxes, color: "#059669" },
  ];

  return (
    <div className="space-y-6">
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
        <h3 className="mb-4 text-sm font-bold text-ink">Sales trend (illustrative)</h3>
        <div className="flex h-40 items-end gap-2">
          {[45, 62, 51, 78, 84, 71, 92].map((h, i) => (
            <div key={i} className="flex-1">
              <div
                className="w-full rounded-t-lg transition-all hover:opacity-80"
                style={{ height: `${h}%`, background: `linear-gradient(180deg, ${GOLD}, ${TEAL})` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-ink-soft/60">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
