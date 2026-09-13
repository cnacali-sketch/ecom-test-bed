"use client";

// Where the shop delivers, and who is waiting everywhere else.
//
// Saving goes through PUT /api/content/site, a WHOLE-DOCUMENT REPLACE, so this
// screen reads the document, splices `serviceability` into it and sends the
// whole thing back with the version it read -- the same care LayoutBuilder
// takes, for the same reason: a screen that PUTs only the part it knows about
// would erase brand, nav, footer and every word of copy on the site.
import { useEffect, useState } from "react";
import { Check, MapPin, Save, UserPlus } from "lucide-react";

import { apiFetch, errorMessage } from "@/lib/api-client";

type SiteDocument = { key: string; version: number; document: Record<string, unknown> };

type Serviceability = {
  limitedArea: boolean;
  districts: string[];
};

type Signup = {
  id: string;
  name: string;
  email: string;
  phone: string;
  postcode: string;
  district: string;
  state: string;
  status: string;
  created_at: string;
};

type Demand = { district: string; state: string; signups: number };

export function DeliveryArea() {
  const [doc, setDoc] = useState<SiteDocument | null>(null);
  const [limited, setLimited] = useState(true);
  const [districts, setDistricts] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [signups, setSignups] = useState<Signup[]>([]);
  const [demand, setDemand] = useState<Demand[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await apiFetch("/api/content/site");
      if (!res?.ok) return setError("Couldn't load the site content.");
      const body = (await res.json()) as SiteDocument;
      setDoc(body);
      const block = (body.document.serviceability ?? {}) as Partial<Serviceability>;
      setLimited(block.limitedArea !== false);
      setDistricts(Array.isArray(block.districts) ? block.districts : []);
    })();
    void refreshWaitlist();
  }, []);

  async function refreshWaitlist() {
    const [list, counts] = await Promise.all([
      apiFetch("/api/waitlist"),
      apiFetch("/api/waitlist/demand"),
    ]);
    if (list?.ok) setSignups(await list.json());
    if (counts?.ok) setDemand(await counts.json());
  }

  async function save() {
    if (!doc) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const block = (doc.document.serviceability ?? {}) as Record<string, unknown>;
      const next = {
        ...doc.document,
        // Spread the existing block so the copy fields -- which this screen
        // does not edit -- survive the save.
        serviceability: { ...block, limitedArea: limited, districts },
      };
      const res = await apiFetch("/api/content/site", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: next, expected_version: doc.version }),
      });
      if (!res?.ok) {
        setError(await errorMessage(res, "Couldn't save the delivery area."));
        return;
      }
      const body = (await res.json()) as SiteDocument;
      setDoc(body);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: string) {
    const res = await apiFetch(`/api/waitlist/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res?.ok) {
      setError(await errorMessage(res, "Couldn't update that entry."));
      return;
    }
    await refreshWaitlist();
  }

  const addDistrict = () => {
    const name = draft.trim();
    if (!name || districts.some((d) => d.toLowerCase() === name.toLowerCase())) return;
    setDistricts([...districts, name]);
    setDraft("");
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-ink/10 bg-white p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
          <MapPin className="h-5 w-5 text-teal" /> Delivery area
        </h2>

        <label className="mt-4 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={limited}
            onChange={(e) => setLimited(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-teal"
          />
          <span>
            <span className="font-medium text-ink">Only deliver to the districts below</span>
            <span className="mt-0.5 block text-ink/60">
              Turn this off to accept orders from anywhere in India. Shoppers outside the
              listed districts are offered the waitlist instead of being turned away.
            </span>
          </span>
        </label>

        <div className="mt-5">
          <p className="text-xs uppercase tracking-wide text-ink/50">Districts served</p>
          <p className="mt-1 text-xs text-ink/50">
            These match the district a PIN code resolves to in the postal data, not what a
            shopper types. Bengaluru needs both entries — Bommanahalli (560068) files under
            Bangalore Rural while Koramangala files under Bengaluru.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {districts.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-2 rounded-full border border-teal/30 bg-teal/5 px-3 py-1 text-sm text-ink"
              >
                {name}
                <button
                  type="button"
                  onClick={() => setDistricts(districts.filter((d) => d !== name))}
                  className="text-ink/40 hover:text-sale"
                  aria-label={`Remove ${name}`}
                >
                  ×
                </button>
              </span>
            ))}
            {districts.length === 0 && (
              <span className="text-sm text-ink/50">
                No districts listed — the limit is off, so the shop delivers everywhere.
              </span>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDistrict())}
              placeholder="Add a district, e.g. Chennai"
              className="w-64 rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-teal"
            />
            <button
              type="button"
              onClick={addDistrict}
              className="rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink hover:border-teal"
            >
              Add
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 border-l-2 border-sale bg-sale/5 px-3 py-2 text-sm text-sale">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-deep disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save delivery area"}
        </button>
        {saved && (
          <span role="status" className="ml-3 text-sm text-teal">
            Saved — live within a minute.
          </span>
        )}
      </section>

      {demand.length > 0 && (
        <section className="rounded-2xl border border-ink/10 bg-white p-6">
          <h2 className="text-lg font-semibold text-ink">Where people are asking from</h2>
          <p className="mt-1 text-sm text-ink/60">
            Everyone who filled a cart and was turned away. This is the only real evidence of
            which area is worth opening next.
          </p>
          <ul className="mt-4 space-y-2">
            {demand.map((row) => (
              <li key={`${row.district}-${row.state}`} className="flex justify-between text-sm">
                <span className="text-ink">
                  {row.district}
                  {row.state ? <span className="text-ink/50"> · {row.state}</span> : null}
                </span>
                <span className="font-medium tabular-nums text-ink">{row.signups}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-ink/10 bg-white p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
          <UserPlus className="h-5 w-5 text-teal" /> Waitlist
        </h2>
        <p className="mt-1 text-sm text-ink/60">
          Approving someone lets that PIN code through checkout, so they can complete the order
          they were stopped from placing.
        </p>

        {signups.length === 0 ? (
          <p className="mt-4 text-sm text-ink/50">Nobody is waiting yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink/50">
                <tr>
                  <th className="py-2 pr-4">Who</th>
                  <th className="py-2 pr-4">Where</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {signups.map((row) => (
                  <tr key={row.id} className="border-t border-ink/5">
                    <td className="py-2 pr-4">
                      <span className="block text-ink">{row.name}</span>
                      <span className="block text-xs text-ink/50">
                        {row.email} · {row.phone}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <span className="tabular-nums text-ink">{row.postcode}</span>
                      {row.district && (
                        <span className="block text-xs text-ink/50">
                          {row.district}
                          {row.state ? ` · ${row.state}` : ""}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={
                          row.status === "approved"
                            ? "rounded-full bg-teal/10 px-2 py-0.5 text-xs text-teal"
                            : "rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink/60"
                        }
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      {row.status === "approved" ? (
                        <button
                          type="button"
                          onClick={() => setStatus(row.id, "notified")}
                          className="text-xs text-ink/50 underline hover:text-ink"
                        >
                          Mark notified
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setStatus(row.id, "approved")}
                          className="inline-flex items-center gap-1 text-xs text-teal underline"
                        >
                          <Check className="h-3 w-3" /> Approve this PIN
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
