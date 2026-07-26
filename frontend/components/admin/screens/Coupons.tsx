"use client";

// Coupons screen: create discount codes and manage existing ones. Validation
// itself lives at checkout (POST /api/coupons/validate, re-checked server-side
// inside order creation — see backend/app/services/coupons.py) — this screen
// is CRUD plus a printable QR per code (opens the backend's PNG in a new tab;
// a full top-level navigation carries the admin auth cookie same as any other
// authenticated page, no CORS credential dance needed).

import { Ticket, QrCode } from "lucide-react";
import { useEffect, useState } from "react";

import { apiBaseUrl, apiFetch } from "@/lib/api-client";

interface Coupon {
  id: string;
  code: string;
  discount_type: "percent" | "flat";
  value: string;
  min_order_value: string;
  usage_limit: number | null;
  times_used: number;
  expires_at: string | null;
  active: boolean;
}

const emptyForm = {
  code: "",
  discount_type: "percent" as "percent" | "flat",
  value: "",
  min_order_value: "",
  usage_limit: "",
  expires_at: "",
};

export function Coupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  function load() {
    apiFetch("/api/coupons")
      .then(async (res) => {
        if (!res?.ok) return setError(true);
        setCoupons((await res.json()) as Coupon[]);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!form.code.trim() || !form.value) {
      setFormError("Code and value are required.");
      return;
    }
    // A non-numeric usage limit must surface as an error, not silently coerce
    // to NaN -> null -> an unintended unlimited-use coupon.
    let usageLimit: number | null = null;
    if (form.usage_limit.trim()) {
      usageLimit = Number(form.usage_limit);
      if (!Number.isInteger(usageLimit) || usageLimit < 1) {
        setFormError("Usage limit must be a whole number, or left blank for unlimited.");
        return;
      }
    }
    setCreating(true);
    try {
      const res = await apiFetch("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.trim(),
          discount_type: form.discount_type,
          value: form.value,
          min_order_value: form.min_order_value || "0",
          usage_limit: usageLimit,
          expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        }),
      });
      if (!res?.ok) {
        const body = await res?.json().catch(() => null);
        setFormError(body?.detail ?? "Could not create coupon.");
        return;
      }
      setForm(emptyForm);
      load();
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(coupon: Coupon) {
    const res = await apiFetch(`/api/coupons/${coupon.id}?active=${!coupon.active}`, { method: "PATCH" });
    if (res?.ok) {
      const updated = (await res.json()) as Coupon;
      setCoupons((cur) => cur.map((c) => (c.id === coupon.id ? updated : c)));
      setToggleError(null);
      return;
    }
    setToggleError(
      res && (res.status === 401 || res.status === 403)
        ? "Your admin session has expired. Please log out and log back in."
        : "Couldn't update that coupon. Please try again.",
    );
  }

  if (loading) return <p className="p-8 text-sm text-ink-soft">Loading coupons…</p>;
  if (error)
    return <p className="p-8 text-sm text-sale">Couldn&apos;t load coupons. Check you&apos;re signed in as an admin.</p>;

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="rounded-2xl border border-ink/10 bg-card p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
          <Ticket className="h-4 w-4 text-teal" /> New coupon
        </h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-xs">
            <span className="block uppercase tracking-wide text-ink-soft">Code</span>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="SAVE10"
              className="mt-1 w-full border border-ink/15 bg-card px-2 py-1.5 text-sm text-ink outline-none focus:border-teal"
            />
          </label>
          <label className="text-xs">
            <span className="block uppercase tracking-wide text-ink-soft">Type</span>
            <select
              value={form.discount_type}
              onChange={(e) => setForm({ ...form, discount_type: e.target.value as "percent" | "flat" })}
              className="mt-1 w-full border border-ink/15 bg-card px-2 py-1.5 text-sm text-ink outline-none focus:border-teal"
            >
              <option value="percent">Percent off</option>
              <option value="flat">Flat amount off</option>
            </select>
          </label>
          <label className="text-xs">
            <span className="block uppercase tracking-wide text-ink-soft">
              Value {form.discount_type === "percent" ? "(%)" : "(₹)"}
            </span>
            <input
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              placeholder={form.discount_type === "percent" ? "10" : "200"}
              className="mt-1 w-full border border-ink/15 bg-card px-2 py-1.5 text-sm text-ink outline-none focus:border-teal"
            />
          </label>
          <label className="text-xs">
            <span className="block uppercase tracking-wide text-ink-soft">Min order (₹)</span>
            <input
              value={form.min_order_value}
              onChange={(e) => setForm({ ...form, min_order_value: e.target.value })}
              placeholder="0"
              className="mt-1 w-full border border-ink/15 bg-card px-2 py-1.5 text-sm text-ink outline-none focus:border-teal"
            />
          </label>
          <label className="text-xs">
            <span className="block uppercase tracking-wide text-ink-soft">Usage limit</span>
            <input
              value={form.usage_limit}
              onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
              placeholder="Unlimited"
              className="mt-1 w-full border border-ink/15 bg-card px-2 py-1.5 text-sm text-ink outline-none focus:border-teal"
            />
          </label>
          <label className="text-xs">
            <span className="block uppercase tracking-wide text-ink-soft">Expires</span>
            <input
              type="date"
              value={form.expires_at}
              onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              className="mt-1 w-full border border-ink/15 bg-card px-2 py-1.5 text-sm text-ink outline-none focus:border-teal"
            />
          </label>
        </div>
        {formError && <p className="mt-3 text-xs text-sale">{formError}</p>}
        <button
          type="submit"
          disabled={creating}
          className="mt-4 bg-teal px-5 py-2 text-xs uppercase tracking-wide text-white hover:bg-teal-deep disabled:opacity-60"
        >
          {creating ? "Creating…" : "Create coupon"}
        </button>
      </form>

      <div className="rounded-2xl border border-ink/10 bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
          <h3 className="text-sm font-bold text-ink">Coupons ({coupons.length})</h3>
        </div>
        {toggleError && (
          <div className="flex items-center justify-between gap-3 border-b border-sale/30 bg-sale/5 px-5 py-3 text-xs text-sale">
            <span>{toggleError}</span>
            <button type="button" onClick={() => setToggleError(null)} className="font-semibold uppercase tracking-wide hover:underline">
              Dismiss
            </button>
          </div>
        )}
        {coupons.length === 0 ? (
          <p className="p-8 text-center text-sm text-ink-soft">No coupons yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-left text-[11px] uppercase tracking-wide text-ink-soft">
                  <th className="px-5 py-3 font-semibold">Code</th>
                  <th className="px-3 py-3 font-semibold">Discount</th>
                  <th className="px-3 py-3 font-semibold">Min order</th>
                  <th className="px-3 py-3 font-semibold">Used</th>
                  <th className="px-3 py-3 font-semibold">Expires</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">QR</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id} className="border-b border-ink/5 last:border-0">
                    <td className="px-5 py-3 font-mono text-xs text-ink">{c.code}</td>
                    <td className="px-3 py-3 text-ink-soft">
                      {c.discount_type === "percent" ? `${c.value}%` : `₹${c.value}`}
                    </td>
                    <td className="px-3 py-3 text-ink-soft">₹{c.min_order_value}</td>
                    <td className="px-3 py-3 text-ink-soft">
                      {c.times_used}
                      {c.usage_limit != null ? ` / ${c.usage_limit}` : ""}
                    </td>
                    <td className="px-3 py-3 text-ink-soft">
                      {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => toggleActive(c)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${c.active ? "bg-emerald-600/10 text-emerald-700" : "bg-ink/10 text-ink-soft"}`}
                      >
                        {c.active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      {apiBaseUrl() && (
                        <a
                          href={`${apiBaseUrl()}/api/coupons/${c.id}/qr`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="grid h-7 w-7 place-items-center text-ink-soft hover:text-teal"
                          aria-label={`View QR code for ${c.code}`}
                        >
                          <QrCode className="h-4 w-4" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
