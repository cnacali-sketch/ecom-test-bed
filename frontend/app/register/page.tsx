"use client";

import { AuthForm, AuthLink } from "@/components/auth/AuthForm";
import { useAuth } from "@/lib/auth-context";

// Mirrors PASSWORD_MIN in backend/app/schemas/auth.py.
const PASSWORD_MIN = 8;

export default function RegisterPage() {
  const { register } = useAuth();

  // No redirect to /account on success: the server deliberately won't say
  // whether this address was new or already registered, so there is no session
  // to land in. Returning the message swaps the form for "check your email".
  async function handleRegister(email: string, password: string) {
    return register(email, password);
  }

  return (
    <AuthForm
      title="Create an account"
      subtitle="Save your wishlist and keep track of every order."
      submitLabel="Create account"
      onSubmit={handleRegister}
      minPasswordLength={PASSWORD_MIN}
      footer={
        <>
          Already have an account? <AuthLink href="/login">Sign in</AuthLink>
        </>
      }
    />
  );
}
