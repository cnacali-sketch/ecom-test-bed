// Browser-side calls to the FastAPI backend.
//
// Separate from lib/api.ts (server-rendered catalog reads, which fall back to
// the bundled catalog). This module is for authenticated, user-initiated calls:
// every request carries cookies, and a dead backend returns null rather than
// throwing, so callers show a message instead of a crashed page.

export function apiBaseUrl(): string | null {
  return process.env.NEXT_PUBLIC_API_URL ?? null;
}

// A 401 on these is a real result (bad credentials / no session to rotate), not
// an expired access token — so never try to refresh-and-retry them.
const NO_REFRESH = ["/api/auth/login", "/api/auth/register", "/api/auth/refresh"];

// Coordinated refresh. If several authed calls 401 at once, they must share ONE
// refresh — firing several rotates the refresh token repeatedly and the later
// ones look like token reuse, which RTR punishes by purging the whole family
// (403) and logging the user out.
//
// Two layers of coordination:
//  1. refreshInFlight — dedupes concurrent refreshes *within* this tab.
//  2. navigator.locks("auth-refresh") — serializes refreshes *across* tabs, so
//     two open tabs never replay the same token concurrently. Once a tab holds
//     the lock and rotates the cookie, the next tab reads the fresh cookie and
//     rotates from there — a valid chain, never a reuse.
let refreshInFlight: Promise<boolean> | null = null;

function postRefresh(baseUrl: string): Promise<boolean> {
  return fetch(`${baseUrl}/api/auth/refresh`, { method: "POST", credentials: "include" })
    .then((r) => r.ok)
    .catch(() => false);
}

function refreshOnce(baseUrl: string): Promise<boolean> {
  if (!refreshInFlight) {
    const run =
      typeof navigator !== "undefined" && navigator.locks
        ? navigator.locks.request("auth-refresh", () => postRefresh(baseUrl))
        : postRefresh(baseUrl); // older browsers: per-tab single-flight only
    refreshInFlight = Promise.resolve(run).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/** Fetch the backend with cookies attached. Returns null when unreachable.
 *
 * The access-token cookie is short-lived (15 min). On a 401 we transparently
 * hit /api/auth/refresh once — which rotates the refresh cookie and issues a
 * fresh access cookie — then replay the original request. This is the client
 * half of refresh-token rotation: without it, every authed call dies 15 minutes
 * after login. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response | null> {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) return null;

  // credentials: "include" is required for the httpOnly auth cookies to travel
  // cross-origin (localhost:3000 -> :8000, or across the two preview tunnels).
  const request = () => fetch(`${baseUrl}${path}`, { ...init, credentials: "include" });

  try {
    const res = await request();
    if (res.status !== 401 || NO_REFRESH.includes(path)) return res;

    const ok = await refreshOnce(baseUrl);
    if (!ok) return res; // refresh failed → truly logged out; surface the 401
    return await request();
  } catch {
    return null;
  }
}
