"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/lib/auth-context";

interface RequireAuthProps {
  children: React.ReactNode;
  /** Require the admin role, not just a session. */
  adminOnly?: boolean;
}

/**
 * Client-side route gate.
 *
 * This is a UX convenience, NOT a security boundary — it only decides what to
 * paint. Every protected read/write is enforced server-side by the JWT
 * dependencies in backend/app/dependencies/auth.py.
 */
export function RequireAuth({ children, adminOnly = false }: RequireAuthProps) {
  const { user, isLoading, isAdmin } = useAuth();
  const router = useRouter();

  const isAllowed = user !== null && (!adminOnly || isAdmin);

  useEffect(() => {
    if (isLoading || isAllowed) return;
    const loginPath = adminOnly ? "/admin/login" : "/login";
    router.replace(user === null ? loginPath : "/");
  }, [isLoading, isAllowed, user, adminOnly, router]);

  if (isLoading) {
    return <p className="mx-auto max-w-6xl px-6 py-16 text-sm text-ink-soft">Loading…</p>;
  }
  if (!isAllowed) return null;

  return <>{children}</>;
}
