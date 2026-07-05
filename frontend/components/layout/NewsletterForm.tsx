"use client";

import { useState } from "react";

interface NewsletterFormProps {
  placeholder?: string;
  buttonLabel?: string;
}

/** Newsletter signup — client component so Footer stays server-rendered. */
export function NewsletterForm({ placeholder = "Your email", buttonLabel = "Sign up" }: NewsletterFormProps) {
  const [done, setDone] = useState(false);

  if (done) {
    return <p className="text-sm text-teal">You&apos;re on the list — first drop note coming soon.</p>;
  }

  return (
    <form
      className="flex max-w-sm gap-0"
      onSubmit={(event) => {
        event.preventDefault();
        setDone(true);
      }}
    >
      <label htmlFor="newsletter-email" className="sr-only">
        Email address
      </label>
      <input
        id="newsletter-email"
        type="email"
        required
        placeholder={placeholder}
        className="w-full border border-ink/20 bg-card px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:border-teal focus:outline-none"
      />
      <button
        type="submit"
        className="shrink-0 bg-teal px-5 py-2.5 text-xs uppercase tracking-[0.14em] text-white transition-colors hover:bg-teal-deep"
      >
        {buttonLabel}
      </button>
    </form>
  );
}
