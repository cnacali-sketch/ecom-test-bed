// Guards the ?next= redirect on the login page.
//
// `next` comes from the URL, so it is attacker-controllable: a link like
// /login?next=https://evil.example spends our domain's credibility on a
// phishing page. Only same-site absolute paths are honoured.

export function safeRedirectPath(next: string | null, fallback: string): string {
  if (!next) return fallback;
  // Must be an absolute path ("/account"), never a scheme ("https://evil"),
  // a protocol-relative URL ("//evil"), or a backslash variant ("/\evil")
  // that some browsers normalise into "//evil".
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
