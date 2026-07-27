"use client";

// Customers screen: registered accounts from GET /api/customers (admin-gated).
// Admin can correct a profile (PATCH /api/customers/{id}), blacklist/unblock
// an account (PATCH .../block — stops login and checkout, revokes sessions),
// or delete it outright (DELETE .../{id}). Customers otherwise edit their own
// profile from /account.

import { Fragment, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Pencil, ShieldOff, Trash2, Users } from "lucide-react";

import { apiFetch } from "@/lib/api-client";
import { inputCls } from "../atoms";

interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  phone?: string;
}
interface Customer {
  id: string;
  email: string;
  role: string;
  is_verified: boolean;
  created_at: string;
  full_name: string | null;
  phone: string | null;
  postal_address: Address;
  billing_address: Address;
  billing_same: boolean;
  is_blocked: boolean;
  blocked_reason: string | null;
}

function oneLine(a: Address): string {
  const parts = [a.line1, a.line2, a.city, a.state, a.postcode, a.country].filter(Boolean);
  return parts.join(", ");
}

export function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function load() {
    apiFetch("/api/customers")
      .then(async (res) => {
        if (!res?.ok) return setError(true);
        setCustomers((await res.json()) as Customer[]);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function reportFailure(res: Response | null, fallback: string) {
    setActionError(
      res && (res.status === 401 || res.status === 403)
        ? "Your admin session has expired. Please log out and log back in."
        : fallback,
    );
  }

  async function saveEdit(id: string, body: Record<string, unknown>) {
    const res = await apiFetch(`/api/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res?.ok) {
      const updated = (await res.json()) as Customer;
      setCustomers((cur) => cur.map((c) => (c.id === id ? updated : c)));
      setActionError(null);
      return true;
    }
    reportFailure(res, "Couldn't save that customer. Please try again.");
    return false;
  }

  async function toggleBlock(customer: Customer) {
    let reason: string | null = null;
    if (!customer.is_blocked) {
      reason = prompt(`Reason for blocking ${customer.email}? (shown to no one but admins)`, "");
      if (reason === null) return; // cancelled
    }
    const res = await apiFetch(`/api/customers/${customer.id}/block`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocked: !customer.is_blocked, reason }),
    });
    if (res?.ok) {
      const updated = (await res.json()) as Customer;
      setCustomers((cur) => cur.map((c) => (c.id === customer.id ? updated : c)));
      setActionError(null);
      return;
    }
    if (res?.status === 422) {
      const body = await res.json().catch(() => null);
      setActionError(body?.detail ?? "Couldn't update that account.");
      return;
    }
    reportFailure(res, "Couldn't update that account. Please try again.");
  }

  async function deleteCustomer(customer: Customer) {
    if (!confirm(`Delete ${customer.email}? This can't be undone.`)) return;
    const res = await apiFetch(`/api/customers/${customer.id}`, { method: "DELETE" });
    if (res?.ok || res?.status === 204) {
      setCustomers((cur) => cur.filter((c) => c.id !== customer.id));
      setActionError(null);
      return;
    }
    if (res?.status === 422) {
      const body = await res.json().catch(() => null);
      setActionError(body?.detail ?? "Couldn't delete that account.");
      return;
    }
    reportFailure(res, "Couldn't delete that account. Please try again.");
  }

  if (loading) return <p className="p-8 text-sm text-ink-soft">Loading customers…</p>;
  if (error)
    return <p className="p-8 text-sm text-sale">Couldn&apos;t load customers. Check you&apos;re signed in as an admin.</p>;

  return (
    <div className="rounded-2xl border border-ink/10 bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
          <Users className="h-4 w-4 text-teal" /> Customers ({customers.length})
        </h3>
      </div>
      {actionError && (
        <div className="flex items-center justify-between gap-3 border-b border-sale/30 bg-sale/5 px-5 py-3 text-xs text-sale">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="font-semibold uppercase tracking-wide hover:underline">
            Dismiss
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-[11px] uppercase tracking-wide text-ink-soft">
              <th className="w-8 px-3 py-3" />
              <th className="px-2 py-3 font-semibold">Name / Email</th>
              <th className="px-3 py-3 font-semibold">Phone</th>
              <th className="px-3 py-3 font-semibold">Address</th>
              <th className="px-3 py-3 font-semibold">Role</th>
              <th className="px-3 py-3 font-semibold">Verified</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const billing = c.billing_same ? c.postal_address : c.billing_address;
              const billingLine = oneLine(billing);
              const expanded = expandedId === c.id;
              const isAdmin = c.role === "admin";
              return (
                <Fragment key={c.id}>
                  <tr className={`border-b border-ink/5 align-top last:border-0 ${c.is_blocked ? "bg-sale/5" : ""}`}>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        aria-label={expanded ? "Collapse" : "Edit profile"}
                        onClick={() => setExpandedId(expanded ? null : c.id)}
                        className="grid h-6 w-6 place-items-center text-ink-soft hover:text-ink"
                      >
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="px-2 py-3">
                      <div className="font-medium text-ink">{c.full_name || "—"}</div>
                      <div className="text-xs text-ink-soft">{c.email}</div>
                    </td>
                    <td className="px-3 py-3 text-ink-soft">{c.phone || "—"}</td>
                    <td className="px-3 py-3 text-xs text-ink-soft">
                      <div>{oneLine(c.postal_address) || "—"}</div>
                      {!c.billing_same && billingLine && (
                        <div className="mt-1 text-ink-soft/70">Billing: {billingLine}</div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${isAdmin ? "bg-gold/15 text-gold" : "bg-ink/10 text-ink-soft"}`}
                      >
                        {c.role}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.is_verified ? "bg-emerald-600/10 text-emerald-700" : "bg-ink/10 text-ink-soft"}`}
                      >
                        {c.is_verified ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {c.is_blocked ? (
                        <span
                          title={c.blocked_reason ?? "Blocked"}
                          className="rounded-full bg-sale/15 px-2 py-0.5 text-xs font-semibold text-sale"
                        >
                          Blocked
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : c.id)}
                          className="grid h-7 w-7 place-items-center text-ink-soft hover:text-teal"
                          aria-label={`Edit ${c.email}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {!isAdmin && (
                          <button
                            type="button"
                            onClick={() => toggleBlock(c)}
                            className={`grid h-7 w-7 place-items-center hover:text-sale ${c.is_blocked ? "text-sale" : "text-ink-soft"}`}
                            aria-label={c.is_blocked ? `Unblock ${c.email}` : `Blacklist ${c.email}`}
                            title={c.is_blocked ? "Unblock" : "Blacklist"}
                          >
                            <ShieldOff className="h-4 w-4" />
                          </button>
                        )}
                        {!isAdmin && (
                          <button
                            type="button"
                            onClick={() => deleteCustomer(c)}
                            className="grid h-7 w-7 place-items-center text-ink-soft hover:text-sale"
                            aria-label={`Delete ${c.email}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="border-b border-ink/5 bg-paper-tint/50 last:border-0">
                      <td colSpan={8} className="px-5 py-4">
                        <EditCustomerForm
                          customer={c}
                          onSave={async (body) => {
                            const ok = await saveEdit(c.id, body);
                            if (ok) setExpandedId(null);
                          }}
                          onCancel={() => setExpandedId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditCustomerForm({
  customer,
  onSave,
  onCancel,
}: {
  customer: Customer;
  onSave: (body: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [fullName, setFullName] = useState(customer.full_name ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [address, setAddress] = useState<Address>(customer.postal_address);
  const [saving, setSaving] = useState(false);

  const setField = (key: keyof Address, value: string) => setAddress((a) => ({ ...a, [key]: value }));

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({ full_name: fullName, phone, postal_address: address });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
        <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
        <input className={inputCls} value={address.line1 ?? ""} onChange={(e) => setField("line1", e.target.value)} placeholder="Address line 1" />
        <input className={inputCls} value={address.line2 ?? ""} onChange={(e) => setField("line2", e.target.value)} placeholder="Address line 2" />
        <input className={inputCls} value={address.city ?? ""} onChange={(e) => setField("city", e.target.value)} placeholder="City" />
        <input className={inputCls} value={address.state ?? ""} onChange={(e) => setField("state", e.target.value)} placeholder="State" />
        <input className={inputCls} value={address.postcode ?? ""} onChange={(e) => setField("postcode", e.target.value)} placeholder="Postcode" />
        <input className={inputCls} value={address.country ?? ""} onChange={(e) => setField("country", e.target.value)} placeholder="Country" />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-teal px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white hover:bg-teal-deep disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border border-ink/15 px-4 py-1.5 text-xs uppercase tracking-wide text-ink-soft hover:bg-ink/5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
