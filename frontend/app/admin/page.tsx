"use client";

import { useRouter } from "next/navigation";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/lib/auth-context";

function AdminView() {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await logout();
    router.push("/admin/login");
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">Admin</h1>
          <p className="mt-2 text-sm text-ink-soft">Signed in as {user?.email}</p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="border border-ink/20 px-3 py-1.5 text-xs uppercase tracking-wide text-ink transition-colors hover:border-ink/50"
        >
          Sign out
        </button>
      </div>

      {/* P3 ports savvy-admin.jsx here: product editor, inventory table, live
          preview, Dashboard/Orders. The role gate and session are already live. */}
      <p className="mt-10 border border-dashed border-ink/20 px-4 py-8 text-center text-sm text-ink-soft">
        The admin console lands in P3. Access is gated and working.
      </p>
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireAuth adminOnly>
      <AdminView />
    </RequireAuth>
  );
}
