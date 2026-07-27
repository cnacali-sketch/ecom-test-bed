"use client";

import { useState } from "react";

import { apiBaseUrl } from "@/lib/api-client";

const CATEGORIES = [
  { value: "query", label: "General query" },
  { value: "grievance", label: "Grievance" },
  { value: "complaint", label: "Complaint" },
  { value: "business_inquiry", label: "Business inquiry" },
];

const inputCls =
  "mt-1 w-full border border-ink/15 bg-card px-3 py-2 text-sm text-ink outline-none focus:border-teal";

export default function ContactPage() {
  const [category, setCategory] = useState("query");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!email.trim() && !phone.trim()) {
      setError("Give us an email or phone number so we can get back to you.");
      return;
    }
    const baseUrl = apiBaseUrl();
    if (!baseUrl) {
      setError("Couldn't reach the server. Please try again shortly.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${baseUrl}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          message: message.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.detail ?? "Couldn't send your message. Please try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Couldn't reach the server. Please try again shortly.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="eyebrow flex items-center justify-center gap-3">
          <span aria-hidden className="h-px w-8 bg-gold" />
          Savvy In Teal
          <span aria-hidden className="h-px w-8 bg-gold" />
        </p>
        <h1 className="font-display mt-4 text-4xl italic text-teal">Message sent</h1>
        <p className="mt-5 text-[15px] leading-relaxed text-ink-soft">
          Thanks for writing in — we&apos;ll get back to you as soon as we can.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <p className="eyebrow flex items-center gap-3">
        <span aria-hidden className="h-px w-8 bg-gold" />
        Savvy In Teal
      </p>
      <h1 className="font-display mt-4 text-4xl italic text-ink">Contact us</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
        Questions, grievances, complaints, or a business inquiry — write to us below.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
        <label className="block text-xs">
          <span className="uppercase tracking-wide text-ink-soft">What's this about</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs">
          <span className="uppercase tracking-wide text-ink-soft">Name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-xs">
            <span className="uppercase tracking-wide text-ink-soft">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </label>
          <label className="block text-xs">
            <span className="uppercase tracking-wide text-ink-soft">Phone</span>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
          </label>
        </div>
        <p className="-mt-3 text-xs text-ink-soft">At least one of email or phone is required.</p>

        <label className="block text-xs">
          <span className="uppercase tracking-wide text-ink-soft">Message</span>
          <textarea
            required
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className={inputCls}
          />
        </label>

        {error && (
          <p role="alert" className="border-l-2 border-sale bg-sale/5 px-3 py-2 text-sm text-sale">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-teal px-4 py-2.5 text-sm uppercase tracking-wide text-white transition-colors hover:bg-teal-deep disabled:opacity-60"
        >
          {submitting ? "Sending…" : "Send message"}
        </button>
      </form>
    </div>
  );
}
