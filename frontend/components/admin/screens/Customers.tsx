"use client";

// Customers screen: registered accounts from GET /api/customers (admin-gated).
// Admin can correct a profile (PATCH /api/customers/{id}), grant or revoke
// back-office access (PATCH .../role), blacklist/unblock an account
// (PATCH .../block — stops login and checkout, revokes sessions), or delete it
// outright (DELETE .../{id}). Customers otherwise edit their own profile from
// /account.

import { Fragment, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Package, Pencil, ShieldOff, Trash2, Users } from "lucide-react";

import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
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

/** The roles an admin can assign, in order of access. Mirrors ROLES in
 * backend/app/models/user.py — anything else is refused there with a 422. */
const ROLES = ["customer", "staff", "admin"] as const;

const ROLE_STYLE: Record<string, string> = {
  admin: "bg-gold/15 text-gold",
  staff: "bg-teal/10 text-teal",
  customer: "bg-ink/10 text-ink-soft",
};

/** What the role actually lets somebody do, in the words of the job. Shown
 * beside the picker because "staff" on its own does not say whether that
 * person can issue a refund. */
const ROLE_BLURB: Record<string, string> = {
  admin: "Everything, including refunds, prices and this screen.",
  staff: "Works the order queue: pick, pack, dispatch. No money, no catalogue.",
  customer: "Shops. No access to the back office.",
};

/** The slice of an order this screen needs. The Orders screen owns the full
 * shape; support opening a customer wants to know what, when, and how much. */
interface CustomerOrder {
  id: string;
  status: string;
  payment_status: string;
  total_amount: string;
  created_at: string;
}

const rupee = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/**
 * A customer's purchase history, loaded when their row is opened.
 *
 * Fetched per-customer rather than pulled from a full order list, because the
 * Customers screen has no reason to hold every order in the shop in memory to
 * show five of them. `customer_id` is matched exactly by the server, which
 * also covers anything bought as a guest under the same email before the
 * account existed.
 */
function OrderHistory({ customerId }: { customerId: string }) {
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/orders/all?customer_id=${encodeURIComponent(customerId)}`)
      .then(async (res) => {
        if (cancelled) return;
        // Distinguished from "no orders": an empty list is a fact about the
        // customer, a failed load is a fact about the console. Showing the
        // first when the second happened tells support this person has never
        // bought anything, which may be the opposite of the truth.
        if (!res?.ok) return setFailed(true);
        setOrders((await res.json()) as CustomerOrder[]);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const total = (orders ?? []).reduce((sum, o) => sum + Number(o.total_amount), 0);

  return (
    <div className="mt-5 border-t border-ink/10 pt-4">
      <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
        <Package className="h-3.5 w-3.5" /> Order history
        {orders && orders.length > 0 && (
          <span className="font-normal normal-case tracking-normal">
            — {orders.length} {orders.length === 1 ? "order" : "orders"}, {rupee(total)} lifetime
          </span>
        )}
      </h4>

      {failed ? (
        <p className="mt-2 text-xs text-sale">
          Couldn&apos;t load this customer&apos;s orders. Reload to try again.
        </p>
      ) : orders === null ? (
        <p className="mt-2 text-xs text-ink-soft">Loading orders…</p>
      ) : orders.length === 0 ? (
        <p className="mt-2 text-xs text-ink-soft">
          No orders yet — this account has never checked out.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-ink/5">
          {orders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-xs">
              <span className="font-mono text-ink-soft">#{o.id.slice(0, 8)}</span>
              <span className="text-ink-soft">
                {new Date(o.created_at).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <span className="capitalize text-ink">{o.status}</span>
              <span className="capitalize text-ink-soft">{o.payment_status.replace("_", " ")}</span>
              <span className="ml-auto font-semibold tabular-nums text-ink">
                {rupee(Number(o.total_amount))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function oneLine(a: Address): string {
  const parts = [a.line1, a.line2, a.city, a.state, a.postcode, a.country].filter(Boolean);
  return parts.join(", ");
}

export function Customers() {
  const { user } = useAuth();
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

  async function setRole(customer: Customer, role: string) {
    if (role === customer.role) return;
    // Confirmed because it is the one change on this screen that hands
    // somebody the keys, and the one that is hardest to notice afterwards.
    const question =
      role === "customer"
        ? `Remove back-office access from ${customer.email}?`
        : `Give ${customer.email} ${role} access? ${ROLE_BLURB[role]}`;
    if (!confirm(question)) return;

    const res = await apiFetch(`/api/customers/${customer.id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (res?.ok) {
      const updated = (await res.json()) as Customer;
      setCustomers((cur) => cur.map((c) => (c.id === customer.id ? updated : c)));
      setActionError(null);
      return;
    }
    if (res?.status === 422) {
      const body = await res.json().catch(() => null);
      setActionError(body?.detail ?? "Couldn't change that role.");
      return;
    }
    reportFailure(res, "Couldn't change that role. Please try again.");
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
              const isSelf = c.id === user?.id;
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
                      {isSelf ? (
                        // No self-demotion: the server refuses it, and an
                        // enabled control that always errors is worse than none.
                        <span
                          title="You cannot change your own role"
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${ROLE_STYLE[c.role] ?? ROLE_STYLE.customer}`}
                        >
                          {c.role} (you)
                        </span>
                      ) : (
                        <select
                          value={c.role}
                          aria-label={`Role for ${c.email}`}
                          title={ROLE_BLURB[c.role]}
                          onChange={(e) => setRole(c, e.target.value)}
                          className={`cursor-pointer rounded-full border-0 px-2 py-0.5 text-xs font-semibold capitalize ${ROLE_STYLE[c.role] ?? ROLE_STYLE.customer}`}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      )}
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
                        <OrderHistory customerId={c.id} />
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
