"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api-client";

type Status = "working" | "done" | "failed";

function VerifyEmail() {
  const token = useSearchParams().get("token");
  const [status, setStatus] = useState<Status>("working");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("failed");
      setMessage("This link is missing its token.");
      return;
    }

    let cancelled = false;

    apiFetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, { method: "POST" })
      .then(async (response) => {
        if (cancelled) return;
        if (response?.ok) {
          setStatus("done");
          return;
        }
        const detail = await response?.json().catch(() => null);
        setStatus("failed");
        setMessage(detail?.detail ?? "This link is invalid or has expired.");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("failed");
        setMessage("Cannot reach the server.");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="mx-auto w-full max-w-sm px-6 py-16">
      {status === "working" ? <p className="text-sm text-ink-soft">Confirming your email…</p> : null}

      {status === "done" ? (
        <>
          <h1 className="font-display text-3xl text-ink">Email confirmed</h1>
          {/* Confirming an inbox isn't proof of the password, so this doesn't
              sign anyone in — it sends them to log in normally. */}
          <p className="mt-3 text-sm text-ink-soft">
            Your address is verified.{" "}
            <Link href="/login" className="text-teal underline-offset-4 hover:underline">
              Sign in
            </Link>
            .
          </p>
        </>
      ) : null}

      {status === "failed" ? (
        <>
          <h1 className="font-display text-3xl text-ink">Link didn&apos;t work</h1>
          <p role="alert" className="mt-3 text-sm text-ink-soft">
            {message}
          </p>
        </>
      ) : null}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <VerifyEmail />
    </Suspense>
  );
}
