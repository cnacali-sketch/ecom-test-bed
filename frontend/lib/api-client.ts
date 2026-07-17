// Browser-side calls to the FastAPI backend.
//
// Separate from lib/api.ts (server-rendered catalog reads, which fall back to
// the bundled catalog). This module is for authenticated, user-initiated calls:
// every request carries cookies, and a dead backend returns null rather than
// throwing, so callers show a message instead of a crashed page.

export function apiBaseUrl(): string | null {
  return process.env.NEXT_PUBLIC_API_URL ?? null;
}

/** Fetch the backend with cookies attached. Returns null when unreachable. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response | null> {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) return null;

  try {
    return await fetch(`${baseUrl}${path}`, {
      ...init,
      // Required for the httpOnly auth cookies to travel cross-origin
      // (localhost:3000 -> localhost:8000).
      credentials: "include",
    });
  } catch {
    return null;
  }
}
