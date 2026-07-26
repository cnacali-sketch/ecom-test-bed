"use client";

import { useState } from "react";

import { AuthLink } from "@/components/auth/AuthForm";
import { useAuth } from "@/lib/auth-context";

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const message = await forgotPassword(email);
      setNotice(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (notice) {
    return (
      <div className="mx-auto w-full max-w-sm px-6 py-16">
        <h1 className="font-display text-3xl text-ink">Check your email</h1>
        <p role="status" className="mt-4 border-l-2 border-teal bg-teal/5 px-3 py-2 text-sm text-ink">
          {notice}
        </p>
        <div className="mt-6 text-sm text-ink-soft">
          <AuthLink href="/login">Back to sign in</AuthLink>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm px-6 py-16">
      <h1 className="font-display text-3xl text-ink">Forgot your password?</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Enter the email on your account and we&apos;ll send a link to reset it.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
        <div>
          <label htmlFor="email" className="block text-xs uppercase tracking-wide text-ink-soft">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border border-ink/15 bg-card px-3 py-2 text-ink outline-none focus:border-teal"
          />
        </div>

        {error ? (
          <p role="alert" className="border-l-2 border-sale bg-sale/5 px-3 py-2 text-sm text-sale">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-teal px-4 py-2.5 text-sm uppercase tracking-wide text-white transition-colors hover:bg-teal-deep disabled:opacity-60"
        >
          {isSubmitting ? "Please wait…" : "Send reset link"}
        </button>
      </form>

      <div className="mt-6 text-sm text-ink-soft">
        <AuthLink href="/login">Back to sign in</AuthLink>
      </div>
    </div>
  );
}
