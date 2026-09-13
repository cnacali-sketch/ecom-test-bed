"use client";

import { useState } from "react";

import { apiFetch, errorMessage } from "@/lib/api-client";

/**
 * What a shopper sees instead of a dead end when the shop does not deliver to
 * them yet.
 *
 * This is the most fragile moment on the site: someone has chosen things, typed
 * out their address, and is being told no. The difference between a refusal and
 * a "not yet" is entirely in what is on the screen next, so the fields are
 * prefilled from the address they already gave and the form asks for nothing
 * they have not already typed.
 *
 * The name and phone are collected because these are the people the shop will
 * call back when it opens their area, and because an approved entry is how an
 * exception gets granted -- that conversation needs a way to reach them.
 */

type Props = {
  reason: string;
  copy: {
    outOfAreaHeading: string;
    outOfAreaBody: string;
    waitlistCta: string;
    waitlistDone: string;
  };
  initial: { name: string; email: string; phone: string; postcode: string };
};

export function WaitlistInvite({ reason, copy, initial }: Props) {
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, postcode: initial.postcode }),
      });
      if (!res?.ok) {
        setError(await errorMessage(res, "Couldn't add you to the list. Please try again."));
        return;
      }
      setDone(true);
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <section className="rounded-[24px] border border-teal/30 bg-teal/5 p-6">
        <p role="status" className="text-sm text-ink">
          {copy.waitlistDone}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[24px] border border-rule-soft bg-card p-6">
      <h2 className="font-display text-xl italic text-ink">{copy.outOfAreaHeading}</h2>
      {/* The server's own sentence, which names the place. Repeating it here
          means the shopper is told *why* rather than just being redirected. */}
      <p className="mt-2 text-sm text-ink-soft">{reason}</p>
      <p className="mt-3 text-sm text-ink-soft">{copy.outOfAreaBody}</p>

      <form onSubmit={join} noValidate className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-ink-soft">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full border border-ink/15 bg-shell px-3 py-2 text-ink outline-none focus:border-teal"
          />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-ink-soft">Phone</span>
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full border border-ink/15 bg-shell px-3 py-2 text-ink outline-none focus:border-teal"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="block text-xs uppercase tracking-wide text-ink-soft">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border border-ink/15 bg-shell px-3 py-2 text-ink outline-none focus:border-teal"
          />
        </label>

        <p className="text-xs text-ink-soft sm:col-span-2">
          We&rsquo;ll only use this to tell you when we start delivering to{" "}
          <span className="font-medium text-ink">{initial.postcode}</span>.
        </p>

        {error && (
          <p
            role="alert"
            className="border-l-2 border-sale bg-sale/5 px-3 py-2 text-sm text-sale sm:col-span-2"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-teal px-8 py-3 text-xs uppercase tracking-[0.2em] text-white transition-colors hover:bg-teal-deep disabled:opacity-60 sm:col-span-2 sm:justify-self-start"
        >
          {submitting ? "Adding you…" : copy.waitlistCta}
        </button>
      </form>
    </section>
  );
}
