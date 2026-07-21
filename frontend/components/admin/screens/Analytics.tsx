"use client";

// Behavior analytics: first-party, aggregate-only (never raw per-user rows).
// GET /api/events/summary (admin-gated) feeds a simple funnel — page_view ->
// product_view -> add_to_cart -> checkout_started -> order_placed — plus the
// most-viewed products. Starts empty until real traffic (with consent) flows
// through lib/analytics.ts.

import { useEffect, useState } from "react";
import { BarChart3, TrendingUp } from "lucide-react";

import { apiFetch } from "@/lib/api-client";

interface TopProduct {
  product_id: string;
  name: string;
  views: number;
}
interface EventSummary {
  counts: Record<string, number>;
  top_products: TopProduct[];
  total_events: number;
}

const FUNNEL_STEPS: { key: string; label: string }[] = [
  { key: "page_view", label: "Page views" },
  { key: "product_view", label: "Product views" },
  { key: "add_to_cart", label: "Added to cart" },
  { key: "checkout_started", label: "Checkout started" },
  { key: "order_placed", label: "Orders placed" },
];

export function Analytics() {
  const [summary, setSummary] = useState<EventSummary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/events/summary")
      .then(async (res) => {
        if (cancelled) return;
        if (!res?.ok) return setError(true);
        setSummary((await res.json()) as EventSummary);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error)
    return <p className="p-8 text-sm text-sale">Couldn&apos;t load analytics. Check you&apos;re signed in as an admin.</p>;
  if (!summary) return <p className="p-8 text-sm text-ink-soft">Loading analytics…</p>;

  const pageViews = summary.counts.page_view ?? 0;
  const orders = summary.counts.order_placed ?? 0;
  const conversionRate = pageViews > 0 ? ((orders / pageViews) * 100).toFixed(1) : null;
  const maxCount = Math.max(1, ...FUNNEL_STEPS.map((s) => summary.counts[s.key] ?? 0));

  if (summary.total_events === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/20 bg-card p-16 text-center">
        <BarChart3 className="mx-auto h-8 w-8 text-ink-soft/40" />
        <p className="mt-3 text-sm text-ink-soft">No behavior data yet.</p>
        <p className="mt-1 text-xs text-ink-soft/60">
          This fills in as shoppers browse the storefront (with their consent).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-ink/10 bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
            <TrendingUp className="h-4 w-4 text-teal" /> Conversion funnel
          </h3>
          {conversionRate !== null && (
            <span className="text-xs font-semibold text-ink-soft">
              {conversionRate}% view-to-order
            </span>
          )}
        </div>
        <div className="space-y-3">
          {FUNNEL_STEPS.map((step) => {
            const count = summary.counts[step.key] ?? 0;
            const width = Math.max(4, (count / maxCount) * 100);
            return (
              <div key={step.key}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-ink-soft">{step.label}</span>
                  <span className="font-semibold text-ink">{count}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-ink/5">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-gold to-teal transition-all"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {summary.counts.search !== undefined && (
          <p className="mt-4 text-xs text-ink-soft">
            {summary.counts.search} search{summary.counts.search === 1 ? "" : "es"} performed
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-ink/10 bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-bold text-ink">Most viewed products</h3>
        {summary.top_products.length === 0 ? (
          <p className="text-sm text-ink-soft">No product views recorded yet.</p>
        ) : (
          <ul className="divide-y divide-ink/5">
            {summary.top_products.map((p, i) => (
              <li key={p.product_id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-ink">
                  <span className="mr-2 text-ink-soft/50">{i + 1}.</span>
                  {p.name}
                </span>
                <span className="font-semibold text-ink">{p.views} views</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
