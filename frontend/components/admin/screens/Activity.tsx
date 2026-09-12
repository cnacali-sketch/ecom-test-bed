"use client";

// Activity log: who changed what, and what it looked like before.
//
// Reads GET /api/audit, which the backend writes from every money-touching
// and destructive admin endpoint. Read-only by design — there is no edit or
// delete here because there is no such endpoint, and there should not be: a
// log the admin can quietly rewrite answers no question worth asking.

import { useCallback, useEffect, useState } from "react";
import {
  History,
  Search,
  ShieldAlert,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";

import { apiFetch } from "@/lib/api-client";

interface AuditEntry {
  id: string;
  actor_email: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  summary: string;
  /** { field: { from, to } } — only the fields that actually moved. */
  changes: Record<string, { from: unknown; to: unknown }>;
  ip: string | null;
  created_at: string;
}

/** One page per request. Matches the backend's own default so "Load more"
 * never silently fetches a different amount than the first load did. */
const PAGE = 100;

const FILTERS = [
  { id: "", label: "Everything" },
  { id: "order", label: "Orders" },
  { id: "product", label: "Products" },
  { id: "coupon", label: "Discounts" },
  { id: "customer", label: "Customers" },
  { id: "return", label: "Returns" },
  { id: "invoice", label: "Invoices" },
  { id: "homepage", label: "Homepage" },
  { id: "media", label: "Photos" },
  { id: "category", label: "Categories" },
] as const;

/** The answer to "has this log been edited?".
 *
 * `unverifiable` counts entries written before the log was hashed. Kept
 * separate from a failure on purpose: "we cannot prove this row is untouched"
 * and "this row was altered" are different statements, and an integrity
 * warning that cries wolf is one nobody reads the second time. */
interface ChainStatus {
  ok: boolean;
  checked: number;
  first_broken_id: string | null;
  unverifiable: number;
  detail: string;
}

/** Money and deletions get colour; routine fulfilment does not. The point is
 * that a page of twenty status changes should not look as alarming as the one
 * refund sitting among them. */
function actionStyle(action: string): string {
  if (action.endsWith(".delete")) return "bg-sale/10 text-sale";
  if (action.startsWith("order.refund") || action.startsWith("order.payment"))
    return "bg-gold/15 text-gold";
  // A discount is money leaving as surely as a refund is.
  if (action.startsWith("coupon.")) return "bg-gold/15 text-gold";
  if (action === "error_log.purge") return "bg-sale/10 text-sale";
  if (action.startsWith("invoice.")) return "bg-teal/10 text-teal";
  return "bg-ink/10 text-ink-soft";
}

/** The dotted action name as a person would say it. Falls back to the raw
 * name rather than hiding an action the backend added and this list has not
 * caught up with — an unlabelled entry is still readable, a missing one is not. */
const ACTION_NAMES: Record<string, string> = {
  "order.status": "Status",
  "order.payment": "Payment",
  "order.refund": "Refund",
  "order.shipping": "Dispatch",
  "order.flag": "Flag",
  "order.delete": "Deleted",
  "customer.update": "Profile",
  "customer.block": "Blocked",
  "customer.unblock": "Unblocked",
  "customer.delete": "Deleted",
  "customer.role": "Role",
  "invoice.issue": "Invoice",
  "product.create": "Added",
  "product.update": "Edited",
  "product.delete": "Deleted",
  "coupon.create": "Discount added",
  "coupon.update": "Discount edited",
  "coupon.delete": "Discount deleted",
  "category.create": "Category added",
  "category.update": "Category edited",
  "category.reorder": "Reordered",
  "category.delete": "Category deleted",
  "homepage.update": "Homepage",
  "media.upload": "Photo added",
  "media.delete": "Photo deleted",
  "return.approved": "Return approved",
  "return.rejected": "Return rejected",
  "error_log.purge": "Errors cleared",
  "order.payment_captured": "Payment (Razorpay)",
  "order.refund_processed": "Refund (Razorpay)",
};

function show(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function Activity() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entityType, setEntityType] = useState("");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [chain, setChain] = useState<ChainStatus | null>(null);

  // Nothing sets state before the first `await`. The effect below calls this,
  // and a synchronous setState inside an effect body triggers a cascading
  // render — so the spinner is turned on by whatever the user clicked
  // (an event handler), and turned off here once the answer is in.
  const load = useCallback(
    async (type: string, offset: number) => {
      const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
      if (type) params.set("entity_type", type);

      const res = await apiFetch(`/api/audit?${params}`);
      if (!res?.ok) {
        setError(
          res && (res.status === 401 || res.status === 403)
            ? "Your admin session has expired. Please log out and log back in."
            : "Couldn't load the activity log.",
        );
        setLoading(false);
        return;
      }
      const page = (await res.json()) as AuditEntry[];
      setEntries((prev) => (offset === 0 ? page : [...prev, ...page]));
      // A full page means there is probably another; a short one means there
      // is definitely not.
      setHasMore(page.length === PAGE);
      setError(null);
      setLoading(false);
    },
    [],
  );

  // Fetching on mount is the "subscribe to an external system" case the rule's
  // own docs allow: `load` awaits before it touches state, and the spinner is
  // turned on by the click that caused the refetch rather than synchronously
  // here. The rule cannot see past the call, so it flags the pattern anyway.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    void load(entityType, 0);
  }, [entityType, load]);

  // Checked once on mount rather than on every filter change: the answer is
  // about the whole table, not the current view, and re-running it per click
  // would rehash every row for no new information.
  const checkChain = useCallback(async () => {
    const res = await apiFetch("/api/audit/verify");
    if (!res?.ok) return;
    setChain((await res.json()) as ChainStatus);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- awaits first
    void checkChain();
  }, [checkChain]);

  // Filtering happens here rather than server-side: the actor and the label
  // are what someone searches by ("what did Priya do", "what happened to
  // #3fa85f64"), and both are already on the page that was fetched.
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? entries.filter((e) =>
        [e.actor_email, e.entity_label, e.summary, e.action]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(needle)),
      )
    : entries;

  return (
    <div className="rounded-2xl border border-ink/10 bg-card shadow-sm">
      {error && (
        <div className="flex items-center justify-between gap-3 border-b border-sale/30 bg-sale/5 px-5 py-3 text-xs text-sale">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="font-semibold uppercase tracking-wide hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {chain && !chain.ok && (
        <div className="flex items-start gap-2 border-b border-sale/30 bg-sale/5 px-5 py-3 text-xs text-sale">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">This log has been tampered with.</p>
            <p className="mt-0.5 text-ink-soft">
              {chain.detail} Entries are chained, so everything after the break is
              no longer trustworthy. Treat the records below as evidence of a
              problem rather than as an account of what happened.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-5 py-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
          <History className="h-4 w-4 text-teal" /> Activity ({visible.length})
          {chain?.ok && chain.checked > 0 && (
            <span
              title={`${chain.checked} entries verified against their hashes`}
              className="flex items-center gap-1 rounded-full bg-teal/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal"
            >
              <ShieldCheck className="h-3 w-3" /> Verified
            </span>
          )}
        </h3>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by person, order or action"
            aria-label="Search the activity log"
            className="w-64 rounded-lg border border-ink/10 bg-paper py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-ink-soft focus:border-teal focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-ink/10 px-5 py-3">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setEntityType(f.id);
              setLoading(true);
            }}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              entityType === f.id ? "bg-teal text-white" : "text-ink-soft hover:bg-ink/5"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && entries.length === 0 ? (
        <p className="p-8 text-sm text-ink-soft">Loading activity…</p>
      ) : visible.length === 0 ? (
        <p className="p-8 text-center text-sm text-ink-soft">
          {needle || entityType
            ? "Nothing matches that."
            : "No admin actions recorded yet. This fills in as orders are worked on."}
        </p>
      ) : (
        <div className="divide-y divide-ink/5">
          {visible.map((entry) => {
            const fields = Object.entries(entry.changes ?? {});
            const expanded = expandedId === entry.id;
            return (
              <div key={entry.id} className="px-5 py-3">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : entry.id)}
                  disabled={fields.length === 0}
                  className="flex w-full flex-wrap items-center gap-3 text-left disabled:cursor-default"
                >
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${actionStyle(entry.action)}`}
                  >
                    {ACTION_NAMES[entry.action] ?? entry.action}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-ink">{entry.summary}</span>
                  {entry.entity_label && (
                    <span className="shrink-0 font-mono text-[11px] text-ink-soft">
                      {entry.entity_label}
                    </span>
                  )}
                  <span className="shrink-0 text-[11px] text-ink-soft">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </button>

                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-soft">
                  {entry.actor_role === "admin" ? (
                    <ShieldCheck className="h-3 w-3 text-teal" />
                  ) : (
                    <UserIcon className="h-3 w-3" />
                  )}
                  {entry.actor_email}
                  <span className="opacity-50">·</span>
                  {entry.actor_role}
                  {entry.ip && (
                    <>
                      <span className="opacity-50">·</span>
                      <span className="font-mono">{entry.ip}</span>
                    </>
                  )}
                </p>

                {expanded && fields.length > 0 && (
                  <dl className="mt-2 space-y-1 rounded-lg bg-ink/5 p-3 text-[11px]">
                    {fields.map(([field, change]) => (
                      <div key={field} className="flex flex-wrap items-baseline gap-2">
                        <dt className="font-semibold text-ink">{field}</dt>
                        <dd className="text-ink-soft">
                          <span className="line-through opacity-60">{show(change?.from)}</span>
                          <span className="mx-1.5">→</span>
                          <span className="font-semibold text-ink">{show(change?.to)}</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            );
          })}
        </div>
      )}

      {hasMore && !needle && (
        <div className="border-t border-ink/10 p-4 text-center">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load(entityType, entries.length);
            }}
            disabled={loading}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-teal hover:bg-teal/5 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load older activity"}
          </button>
        </div>
      )}
    </div>
  );
}
