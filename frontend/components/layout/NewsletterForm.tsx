"use client";

/** Newsletter signup form — isolated as a Client Component since Footer stays server-rendered. */
export function NewsletterForm() {
  return (
    <form className="flex flex-col gap-2" onSubmit={(event) => event.preventDefault()}>
      <label htmlFor="newsletter-email" className="sr-only">
        Email address
      </label>
      <input
        id="newsletter-email"
        type="email"
        required
        placeholder="Your email"
        className="rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700"
      >
        Sign Up
      </button>
    </form>
  );
}
