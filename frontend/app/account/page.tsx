"use client";

import { useRouter } from "next/navigation";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/lib/auth-context";

function AccountView() {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await logout();
    router.push("/");
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="font-display text-3xl text-ink">Your account</h1>
      <p className="mt-2 text-sm text-ink-soft">{user?.email}</p>

      <dl className="mt-8 space-y-2 text-sm">
        <div className="flex gap-2">
          <dt className="text-ink-soft">Account type</dt>
          <dd className="text-ink">{user?.role}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-ink-soft">Email verified</dt>
          <dd className="text-ink">{user?.is_verified ? "Yes" : "Not yet"}</dd>
        </div>
      </dl>

      {/* Order history and a persisted wishlist land in P4. */}
      <button
        type="button"
        onClick={handleSignOut}
        className="mt-10 border border-ink/20 px-4 py-2 text-sm uppercase tracking-wide text-ink transition-colors hover:border-ink/50"
      >
        Sign out
      </button>
    </div>
  );
}

export default function AccountPage() {
  return (
    <RequireAuth>
      <AccountView />
    </RequireAuth>
  );
}
