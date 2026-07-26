"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { AuthLink } from "@/components/auth/AuthForm";
import { useAuth } from "@/lib/auth-context";

// Mirrors PASSWORD_MIN in backend/app/schemas/auth.py.
const PASSWORD_MIN = 8;

function ResetPassword() {
  const token = useSearchParams().get("token");
  const { resetPassword } = useAuth();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!token) {
      setError("This link is missing its token.");
      return;
    }
    setIsSubmitting(true);
    try {
      const message = await resetPassword(token, password);
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
        <h1 className="font-display text-3xl text-ink">Password updated</h1>
        <p role="status" className="mt-4 border-l-2 border-teal bg-teal/5 px-3 py-2 text-sm text-ink">
          {notice}
        </p>
        <div className="mt-6 text-sm text-ink-soft">
          <AuthLink href="/login">Sign in</AuthLink>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm px-6 py-16">
      <h1 className="font-display text-3xl text-ink">Choose a new password</h1>

      {!token ? (
        <p role="alert" className="mt-4 border-l-2 border-sale bg-sale/5 px-3 py-2 text-sm text-sale">
          This link is missing its token. Request a new one from the{" "}
          <AuthLink href="/forgot-password">forgot password</AuthLink> page.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
          <div>
            <label htmlFor="password" className="block text-xs uppercase tracking-wide text-ink-soft">
              New password
            </label>
            <div className="relative mt-1">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={PASSWORD_MIN}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-ink/15 bg-card px-3 py-2 pr-10 text-ink outline-none focus:border-teal"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-0 top-0 grid h-full w-10 place-items-center text-ink-soft hover:text-ink"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-ink-soft">At least {PASSWORD_MIN} characters.</p>
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
            {isSubmitting ? "Please wait…" : "Reset password"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ResetPassword />
    </Suspense>
  );
}
