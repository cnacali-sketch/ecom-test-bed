"use client";

// Shared address form fields — used by the account profile editor and
// checkout, so both collect the exact same shape and read the same way.

import type { Address } from "@/lib/auth-context";

export const EMPTY_ADDRESS: Address = {
  full_name: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postcode: "",
  country: "",
  phone: "",
};

export function seedAddress(a: Address | undefined): Address {
  return { ...EMPTY_ADDRESS, ...(a ?? {}) };
}

export function AddressFields({
  heading,
  value,
  onChange,
  prefix,
}: {
  heading: string;
  value: Address;
  onChange: (a: Address) => void;
  prefix: string;
}) {
  const set = (key: keyof Address, v: string) => onChange({ ...value, [key]: v });
  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl italic text-ink">{heading}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Full name"
          value={value.full_name ?? ""}
          onChange={(v) => set("full_name", v)}
          autoComplete={`${prefix} name`}
          className="sm:col-span-2"
        />
        <Field label="Address line 1" value={value.line1 ?? ""} onChange={(v) => set("line1", v)} autoComplete={`${prefix} address-line1`} className="sm:col-span-2" />
        <Field label="Address line 2" value={value.line2 ?? ""} onChange={(v) => set("line2", v)} autoComplete={`${prefix} address-line2`} className="sm:col-span-2" />
        <Field label="City" value={value.city ?? ""} onChange={(v) => set("city", v)} />
        <Field label="State" value={value.state ?? ""} onChange={(v) => set("state", v)} />
        <Field label="Postcode" value={value.postcode ?? ""} onChange={(v) => set("postcode", v)} />
        <Field label="Country" value={value.country ?? ""} onChange={(v) => set("country", v)} />
        <Field
          label="Phone (for delivery)"
          value={value.phone ?? ""}
          onChange={(v) => set("phone", v)}
          type="tel"
          autoComplete={`${prefix} tel`}
          className="sm:col-span-2"
        />
      </div>
    </section>
  );
}

export function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs uppercase tracking-wide text-ink-soft">{label}</span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-ink/15 bg-card px-3 py-2 text-ink outline-none focus:border-teal"
      />
    </label>
  );
}
