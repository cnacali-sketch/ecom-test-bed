"use client";

// Customers screen: registered accounts from GET /api/customers (admin-gated),
// with the profile details each customer maintains (name, phone, address).
// Read-only — customers edit their own profile from /account.

import { useEffect, useState } from "react";
import { Users } from "lucide-react";

import { apiFetch } from "@/lib/api-client";

interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
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
}

function oneLine(a: Address): string {
  const parts = [a.line1, a.line2, a.city, a.state, a.postcode, a.country].filter(Boolean);
  return parts.join(", ");
}

export function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/customers")
      .then(async (res) => {
        if (cancelled) return;
        if (!res?.ok) return setError(true);
        setCustomers((await res.json()) as Customer[]);
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

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
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-[11px] uppercase tracking-wide text-ink-soft">
              <th className="px-5 py-3 font-semibold">Name / Email</th>
              <th className="px-3 py-3 font-semibold">Phone</th>
              <th className="px-3 py-3 font-semibold">Address</th>
              <th className="px-3 py-3 font-semibold">Role</th>
              <th className="px-5 py-3 font-semibold">Verified</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const billing = c.billing_same ? c.postal_address : c.billing_address;
              const billingLine = oneLine(billing);
              return (
                <tr key={c.id} className="border-b border-ink/5 align-top last:border-0">
                  <td className="px-5 py-3">
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
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${c.role === "admin" ? "bg-gold/15 text-gold" : "bg-ink/10 text-ink-soft"}`}
                    >
                      {c.role}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.is_verified ? "bg-emerald-600/10 text-emerald-700" : "bg-ink/10 text-ink-soft"}`}
                    >
                      {c.is_verified ? "Yes" : "No"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
