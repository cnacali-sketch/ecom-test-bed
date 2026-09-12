"use client";

// Behavior analytics: first-party, aggregate-only (never raw per-user rows).
// GET /api/events/summary (admin-gated) feeds a simple funnel — page_view ->
// product_view -> add_to_cart -> checkout_started -> order_placed — plus the
// most-viewed products. Starts empty until real traffic (with consent) flows
// through lib/analytics.ts.

import { useCallback, useEffect, useState } from "react";
import { BarChart3, CalendarRange, Laptop, MapPin, TrendingUp } from "lucide-react";

import { apiFetch } from "@/lib/api-client";

interface TopProduct {
  product_id: string;
  name: string;
  views: number;
}
interface LocationCount {
  city: string;
  state: string;
  order_count: number;
}
interface EventSummary {
  /** The window the figures describe, echoed back by the server. Null means
   * all time. Read from the response rather than from local state so the
   * heading can never claim a period the numbers do not cover. */
  start: string | null;
  end: string | null;
  counts: Record<string, number>;
  top_products: TopProduct[];
  total_events: number;
  device_counts: Record<string, number>;
  browser_counts: Record<string, number>;
  top_locations: LocationCount[];
  state_counts: Record<string, number>;
  country_counts: Record<string, number>;
}

/** Horizontal bar list — same visual language for device/browser/location
 * breakdowns, sorted largest-first. */
function BreakdownList({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (entries.length === 0) return <p className="text-sm text-ink-soft">No data yet.</p>;
  return (
    <div className="space-y-2.5">
      {entries.map(([label, count]) => (
        <div key={label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-ink-soft">{label}</span>
            <span className="font-semibold text-ink">{count}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-ink/5">
            <div className="h-1.5 rounded-full bg-teal" style={{ width: `${Math.max(4, (count / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Days back from today, or null for all time. Presets rather than a date
 * picker: "how did last week go" is the question actually being asked, and a
 * pair of date inputs makes the common case slower without making the rare
 * one possible — the API takes explicit dates when that day comes. */
const RANGES: { days: number | null; label: string }[] = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
  { days: null, label: "All time" },
];

/** YYYY-MM-DD in local time.
 *
 * `toISOString()` would convert to UTC first, which in IST lands on the
 * previous day for any time before 05:30 — so "last 7 days" would silently
 * become eight, once a day, for five and a half hours. */
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function rangeParams(days: number | null): string {
  if (days === null) return "";
  const end = new Date();
  const start = new Date();
  // Inclusive of both ends, so "last 7 days" covers today and the six before
  // it — seven days, not eight.
  start.setDate(start.getDate() - (days - 1));
  return `?start=${isoDay(start)}&end=${isoDay(end)}`;
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
  // 30 days rather than all time: the default view should answer "how are we
  // doing", and an all-time total stops moving once a shop has any history.
  const [days, setDays] = useState<number | null>(30);

  const load = useCallback(async (window: number | null) => {
    const res = await apiFetch(`/api/events/summary${rangeParams(window)}`);
    if (!res?.ok) {
      setError(true);
      return;
    }
    setSummary((await res.json()) as EventSummary);
    setError(false);
  }, []);

  // `load` awaits before it touches state, so nothing is set synchronously
  // here. The rule cannot see past the call, so it flags the pattern anyway.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    void load(days);
  }, [days, load]);

  if (error)
    return <p className="p-8 text-sm text-sale">Couldn&apos;t load analytics. Check you&apos;re signed in as an admin.</p>;
  if (!summary) return <p className="p-8 text-sm text-ink-soft">Loading analytics…</p>;

  const pageViews = summary.counts.page_view ?? 0;
  const orders = summary.counts.order_placed ?? 0;
  const conversionRate = pageViews > 0 ? ((orders / pageViews) * 100).toFixed(1) : null;
  const maxCount = Math.max(1, ...FUNNEL_STEPS.map((s) => summary.counts[s.key] ?? 0));

  // Location comes from real orders, independent of behavior-event consent —
  // don't hide it just because no one has opted into event tracking yet.
  const hasEventData = summary.total_events > 0;

  const rangeTabs = (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Reporting period">
      <CalendarRange className="h-3.5 w-3.5 text-ink-soft" />
      {RANGES.map((r) => (
        <button
          key={r.label}
          type="button"
          aria-pressed={days === r.days}
          onClick={() => setDays(r.days)}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
            days === r.days
              ? "bg-teal text-white"
              : "bg-ink/5 text-ink-soft hover:bg-ink/10 hover:text-ink"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-card px-5 py-3 shadow-sm">
        {rangeTabs}
        {/* Taken from the response, not from `days` — if the two ever
            disagree, the figures are the truth and the label should say so. */}
        <span className="text-xs text-ink-soft">
          {summary.start ? `${summary.start} to ${summary.end}` : "All time"}
        </span>
      </div>
      {!hasEventData && (
        <div className="rounded-2xl border border-dashed border-ink/20 bg-card p-8 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-ink-soft/40" />
          <p className="mt-3 text-sm text-ink-soft">
            {summary.start ? "No behavior data in this period." : "No behavior data yet."}
          </p>
          <p className="mt-1 text-xs text-ink-soft/60">
            {summary.start
              ? "Try a longer period. The funnel and device breakdown only cover the dates selected above."
              : "The funnel and device/browser breakdown fill in as shoppers browse the storefront (with their consent)."}{" "}
            Order locations below cover the same period.
          </p>
        </div>
      )}
      {hasEventData && (
      <>
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

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-ink/10 bg-card p-5 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
            <Laptop className="h-4 w-4 text-teal" /> Device
          </h3>
          <BreakdownList data={summary.device_counts} />
        </div>
        <div className="rounded-2xl border border-ink/10 bg-card p-5 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
            <Laptop className="h-4 w-4 text-teal" /> Browser
          </h3>
          <BreakdownList data={summary.browser_counts} />
        </div>
      </div>
      </>
      )}

      <div className="rounded-2xl border border-ink/10 bg-card p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
          <MapPin className="h-4 w-4 text-teal" /> Where orders ship to
        </h3>
        <p className="mb-3 text-xs text-ink-soft">
          From real shipping addresses on real orders — not IP-based geolocation, which is coarse and
          often wrong at city level.
        </p>
        {summary.top_locations.length === 0 ? (
          <p className="text-sm text-ink-soft">No orders with an address yet.</p>
        ) : (
          <ul className="divide-y divide-ink/5">
            {summary.top_locations.map((loc) => (
              <li key={`${loc.city}-${loc.state}`} className="flex items-center justify-between py-2 text-sm">
                <span className="text-ink">
                  {loc.city}
                  {loc.state ? `, ${loc.state}` : ""}
                </span>
                <span className="font-semibold text-ink">
                  {loc.order_count} order{loc.order_count === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-ink/10 bg-card p-5 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
            <MapPin className="h-4 w-4 text-teal" /> Orders by state
          </h3>
          <BreakdownList data={summary.state_counts} />
        </div>
        <div className="rounded-2xl border border-ink/10 bg-card p-5 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
            <MapPin className="h-4 w-4 text-teal" /> Orders by country
          </h3>
          <BreakdownList data={summary.country_counts} />
          <p className="mt-3 text-[11px] text-ink-soft/70">
            Country is free text at checkout, so "IN" and "India" count separately — not merged.
          </p>
        </div>
      </div>
    </div>
  );
}
