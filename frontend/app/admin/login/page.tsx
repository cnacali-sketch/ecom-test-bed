"use client";

import { useRouter } from "next/navigation";

import { AuthForm } from "@/components/auth/AuthForm";
import { AuthError, useAuth } from "@/lib/auth-context";

export default function AdminLoginPage() {
  const { login, logout } = useAuth();
  const router = useRouter();

  async function handleLogin(email: string, password: string) {
    const user = await login(email, password);
    // A valid customer signing in here is still not staff. Drop the session and
    // say so, rather than bouncing them to an /admin that fails on every call.
    if (user.role !== "admin") {
      await logout();
      throw new AuthError("That account does not have admin access.");
    }
    router.push("/admin");
  }

  return (
    <AuthForm
      title="Admin sign in"
      subtitle="Staff access to the Savvy In Teal catalogue."
      submitLabel="Sign in"
      onSubmit={handleLogin}
    />
  );
}
