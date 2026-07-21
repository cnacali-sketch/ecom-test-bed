// First-party behavior tracking — no third-party analytics account needed.
// Anonymous by default: a random per-browser id in localStorage, never a name
// or email. Gated on consent (see components/analytics/ConsentBanner.tsx) so
// nothing is sent before the shopper has said yes.
//
// Posts to the backend's /api/events (see backend/app/routers/events.py),
// which feeds the admin Analytics screen (funnel + top-viewed products).

import { apiBaseUrl } from "./api-client";

const SESSION_KEY = "savvy_session_id";
const CONSENT_KEY = "savvy_analytics_consent";

export type EventType =
  | "page_view"
  | "product_view"
  | "add_to_cart"
  | "checkout_started"
  | "order_placed"
  | "search";

export type ConsentState = "granted" | "declined" | null;

export function getConsent(): ConsentState {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(CONSENT_KEY);
  return value === "granted" || value === "declined" ? value : null;
}

export function setConsent(granted: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONSENT_KEY, granted ? "granted" : "declined");
}

function getSessionId(): string {
  let id = window.localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

interface TrackExtra {
  path?: string;
  product_id?: string;
  query?: string;
}

/** Record one behavior event. No-op without consent, without a backend URL,
 * or outside the browser (safe to call from any client component). */
export function trackEvent(eventType: EventType, extra: TrackExtra = {}): void {
  if (typeof window === "undefined") return;
  if (getConsent() !== "granted") return;

  const baseUrl = apiBaseUrl();
  if (!baseUrl) return;

  const body = JSON.stringify({
    user_id: getSessionId(),
    event_type: eventType,
    path: extra.path ?? window.location.pathname,
    product_id: extra.product_id,
    query: extra.query,
  });

  const url = `${baseUrl}/api/events`;
  // sendBeacon survives page unload (e.g. clicking a product link away from
  // the page that fired the event) — exactly what a fire-and-forget tracking
  // call needs. Fall back to a keepalive fetch on older browsers.
  const sent =
    typeof navigator !== "undefined" && navigator.sendBeacon
      ? navigator.sendBeacon(url, new Blob([body], { type: "application/json" }))
      : false;

  if (!sent) {
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(
      () => {},
    );
  }
}
