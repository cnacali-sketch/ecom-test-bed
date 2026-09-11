"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/lib/auth-context";

interface RequireAuthProps {
  children: React.ReactNode;
  /** Require the admin role, not just a session. */
  adminOnly?: boolean;
  /** Require back-office access — staff or admin. Use this for the console
   * itself; use adminOnly only for a page where staff must be turned away. */
  staffOnly?: boolean;
}

/**
 * Client-side route gate.
 *
 * This is a UX convenience, NOT a security boundary — it only decides what to
 * paint. Every protected read/write is enforced server-side by the JWT
 * dependencies in backend/app/dependencies/auth.py.
 */
export function RequireAuth({
  children,
  adminOnly = false,
  staffOnly = false,
}: RequireAuthProps) {
  const { user, isLoading, isAdmin, isStaff } = useAuth();
  const router = useRouter();

  const isAllowed =
    user !== null && (!adminOnly || isAdmin) && (!staffOnly || isStaff);

  useEffect(() => {
    if (isLoading || isAllowed) return;
    const loginPath = adminOnly || staffOnly ? "/admin/login" : "/login";
    router.replace(user === null ? loginPath : "/");
  }, [isLoading, isAllowed, user, adminOnly, staffOnly, router]);

  if (isLoading) {
    return <p className="mx-auto max-w-6xl px-6 py-16 text-sm text-ink-soft">Loading…</p>;
  }
  if (!isAllowed) return null;

  return <>{children}</>;
}
