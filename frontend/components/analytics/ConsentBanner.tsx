"use client";

// Cookie/analytics consent banner. Nothing in lib/analytics.ts sends a single
// event until this records "granted" — required groundwork before behavior
// tracking can legally run (India's DPDP Act, and just good practice).

import { useEffect, useState } from "react";
import { getConsent, setConsent } from "@/lib/analytics";

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(getConsent() === null);
  }, []);

  function choose(granted: boolean) {
    setConsent(granted);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[200] border-t border-ink/10 bg-paper/95 px-4 py-4 backdrop-blur sm:px-6"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-center text-xs text-ink-soft sm:text-left">
          We use anonymous analytics (page and product views) to improve the shopping experience.
          No personal data is collected. See our{" "}
          <a href="/coming-soon" className="text-teal underline underline-offset-2">
            privacy policy
          </a>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose(false)}
            className="border border-ink/20 px-4 py-2 text-xs uppercase tracking-wide text-ink-soft transition-colors hover:border-ink/40"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => choose(true)}
            className="bg-teal px-4 py-2 text-xs uppercase tracking-wide text-white transition-colors hover:bg-teal-deep"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
