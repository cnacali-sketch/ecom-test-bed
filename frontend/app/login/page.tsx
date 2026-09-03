"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { AuthForm, AuthLink } from "@/components/auth/AuthForm";
import { useAuth } from "@/lib/auth-context";
import { safeRedirectPath } from "@/lib/safe-redirect";

function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  async function handleLogin(email: string, password: string) {
    await login(email, password);
    router.push(safeRedirectPath(searchParams.get("next"), "/account"));
  }

  return (
    <AuthForm
      title="Sign in"
      subtitle="Your orders, your wishlist, waiting where you left them."
      submitLabel="Sign in"
      onSubmit={handleLogin}
      footer={
        <div className="space-y-2">
          <p>
            New here? <AuthLink href="/register">Create an account</AuthLink>
          </p>
          <p>
            <AuthLink href="/forgot-password">Forgot your password?</AuthLink>
          </p>
        </div>
      }
    />
  );
}

export default function Page() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}
