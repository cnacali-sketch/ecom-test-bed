"use client";

// Customer profile editor. Seeds from the current user, PATCHes /api/auth/me on
// save (via auth-context.updateProfile), and reflects immediately. Billing
// address is hidden while "same as delivery" is checked.

import { useState } from "react";

import { AddressFields, Field, seedAddress } from "@/components/ui/AddressFields";
import { useAuth, type Address, type AuthUser } from "@/lib/auth-context";

export function ProfileForm({ user }: { user: AuthUser }) {
  const { updateProfile } = useAuth();

  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [postal, setPostal] = useState<Address>(seedAddress(user.postal_address));
  const [billing, setBilling] = useState<Address>(seedAddress(user.billing_address));
  const [billingSame, setBillingSame] = useState(user.billing_same);

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      await updateProfile({
        full_name: fullName,
        phone,
        postal_address: postal,
        billing_same: billingSame,
        billing_address: billingSame ? undefined : billing,
      });
      setNotice("Profile saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-10 max-w-2xl space-y-8">
      <section className="space-y-4">
        <h2 className="font-display text-xl italic text-ink">Your details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" value={fullName} onChange={setFullName} autoComplete="name" />
          <Field label="Phone number" value={phone} onChange={setPhone} autoComplete="tel" type="tel" />
        </div>
      </section>

      <AddressFields heading="Delivery address" value={postal} onChange={setPostal} prefix="postal" />

      <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={billingSame}
          onChange={(e) => setBillingSame(e.target.checked)}
          className="h-4 w-4 accent-teal"
        />
        Billing address same as delivery
      </label>

      {!billingSame && (
        <AddressFields heading="Billing address" value={billing} onChange={setBilling} prefix="billing" />
      )}

      {error && (
        <p role="alert" className="border-l-2 border-sale bg-sale/5 px-3 py-2 text-sm text-sale">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="border-l-2 border-teal bg-teal/5 px-3 py-2 text-sm text-ink">
          {notice}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="bg-teal px-8 py-3 text-xs uppercase tracking-[0.18em] text-white transition-colors hover:bg-teal-deep disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
