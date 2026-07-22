"use client";

// Fraud/abuse signals: first-party, advisory only — GET /api/events/fraud-summary
// (admin-gated) flags same-IP repeats within a rolling window. Two lenses:
// ad-click velocity (bot/click-fraud burning Meta/Google ad spend) and
// checkout velocity (fake-order / coupon-abuse pattern). Nothing here blocks
// anyone automatically — shared/mobile IPs can trip these legitimately, so
// flags are for a human to review, not to act on unilaterally.

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";

import { apiFetch } from "@/lib/api-client";

interface AdClickFlag {
  ip_hash: string;
  ad_click_count: number;
  sample_user_agent: string | null;
}
interface CheckoutVelocityFlag {
  ip_hash: string;
  checkout_event_count: number;
  sample_user_agent: string | null;
}
interface FraudSummary {
  window_hours: number;
  ad_click_flags: AdClickFlag[];
  checkout_velocity_flags: CheckoutVelocityFlag[];
}

function FlagTable({
  rows,
  countLabel,
  emptyLabel,
}: {
  rows: { ip_hash: string; count: number; sample_user_agent: string | null }[];
  countLabel: string;
  emptyLabel: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-ink-soft">{emptyLabel}</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-ink/10 text-left text-[11px] uppercase tracking-wide text-ink-soft">
          <th className="py-2 font-semibold">IP (hashed)</th>
          <th className="py-2 font-semibold">{countLabel}</th>
          <th className="py-2 font-semibold">Sample user agent</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.ip_hash} className="border-b border-ink/5 last:border-0">
            <td className="py-2 font-mono text-xs text-ink-soft">{row.ip_hash}</td>
            <td className="py-2 font-semibold text-sale">{row.count}</td>
            <td className="max-w-xs truncate py-2 text-xs text-ink-soft" title={row.sample_user_agent ?? ""}>
              {row.sample_user_agent ?? "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Fraud() {
  const [summary, setSummary] = useState<FraudSummary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/events/fraud-summary")
      .then(async (res) => {
        if (cancelled) return;
        if (!res?.ok) return setError(true);
        setSummary((await res.json()) as FraudSummary);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error)
    return <p className="p-8 text-sm text-sale">Couldn&apos;t load fraud signals. Check you&apos;re signed in as an admin.</p>;
  if (!summary) return <p className="p-8 text-sm text-ink-soft">Loading fraud signals…</p>;

  return (
    <div className="space-y-6">
      <p className="text-xs text-ink-soft">
        Advisory only, last {summary.window_hours}h — nothing here blocks a customer automatically.
      </p>

      <div className="rounded-2xl border border-ink/10 bg-card p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
          <ShieldAlert className="h-4 w-4 text-sale" /> Ad-click velocity (Meta / Google)
        </h3>
        <FlagTable
          rows={summary.ad_click_flags.map((f) => ({
            ip_hash: f.ip_hash,
            count: f.ad_click_count,
            sample_user_agent: f.sample_user_agent,
          }))}
          countLabel="Ad clicks"
          emptyLabel="No repeat ad-click patterns in this window."
        />
      </div>

      <div className="rounded-2xl border border-ink/10 bg-card p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
          <ShieldAlert className="h-4 w-4 text-sale" /> Checkout velocity (order / coupon abuse)
        </h3>
        <FlagTable
          rows={summary.checkout_velocity_flags.map((f) => ({
            ip_hash: f.ip_hash,
            count: f.checkout_event_count,
            sample_user_agent: f.sample_user_agent,
          }))}
          countLabel="Checkout events"
          emptyLabel="No repeat checkout patterns in this window."
        />
      </div>
    </div>
  );
}
