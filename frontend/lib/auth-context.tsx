"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { apiFetch } from "./api-client";

export interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: "customer" | "admin";
  is_verified: boolean;
  full_name: string | null;
  phone: string | null;
  postal_address: Address;
  billing_address: Address;
  billing_same: boolean;
}

/** The subset of profile fields a customer can edit. */
export interface ProfileUpdate {
  full_name?: string;
  phone?: string;
  postal_address?: Address;
  billing_address?: Address;
  billing_same?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** True until the initial /me check resolves — gates render, not access. */
  isLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  /**
   * Starts registration. Resolves with the server's message — NOT a session.
   *
   * Signing up cannot sign you in: the server won't confirm whether the address
   * was new or already taken (that would be an enumeration oracle), so there is
   * nothing to log in as. The real outcome arrives by email.
   */
  register: (email: string, password: string) => Promise<string>;
  logout: () => Promise<void>;
  /** Persist profile edits to the backend and update local state immediately. */
  updateProfile: (patch: ProfileUpdate) => Promise<AuthUser>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Thrown on a failed auth call so pages can show the backend's message. */
export class AuthError extends Error {}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    return typeof body?.detail === "string" ? body.detail : fallback;
  } catch {
    return fallback;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Resolve the session once on mount. A 401 is the expected "logged out"
  // answer, not an error worth surfacing.
  useEffect(() => {
    let cancelled = false;

    apiFetch("/api/auth/me")
      .then(async (response) => {
        if (cancelled) return;
        setUser(response?.ok ? await response.json() : null);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const postCredentials = useCallback(
    async (path: string, email: string, password: string, fallbackError: string) => {
      const response = await apiFetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response) throw new AuthError("Cannot reach the server. Is the backend running?");
      if (!response.ok) throw new AuthError(await readError(response, fallbackError));
      return response;
    },
    [],
  );

  const login = useCallback(
    async (email: string, password: string): Promise<AuthUser> => {
      const response = await postCredentials(
        "/api/auth/login",
        email,
        password,
        "Could not sign in",
      );
      const authenticated: AuthUser = await response.json();
      setUser(authenticated);
      return authenticated;
    },
    [postCredentials],
  );

  const register = useCallback(
    async (email: string, password: string): Promise<string> => {
      const response = await postCredentials(
        "/api/auth/register",
        email,
        password,
        "Could not start registration",
      );
      // 202 + a message. No cookies were set and no user exists to store, by
      // design — see the AuthContextValue doc for why.
      const body = await response.json();
      return typeof body?.detail === "string" ? body.detail : "Check your email to continue.";
    },
    [postCredentials],
  );

  const logout = useCallback(async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (patch: ProfileUpdate): Promise<AuthUser> => {
    const response = await apiFetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!response) throw new AuthError("Cannot reach the server. Is the backend running?");
    if (!response.ok) throw new AuthError(await readError(response, "Could not save your profile"));
    const updated: AuthUser = await response.json();
    setUser(updated);
    return updated;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, isAdmin: user?.role === "admin", login, register, logout, updateProfile }),
    [user, isLoading, login, register, logout, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
