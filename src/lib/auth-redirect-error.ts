/**
 * Supabase reports a failed OAuth sign-in (e.g. Google) by redirecting back with
 * `error` / `error_description` in the query string or hash. The app immediately redirects
 * unauthenticated users to /auth, which dropped that information, so a failed Google login
 * looked like "nothing happened". Read it once at start-up and hand it to the login page.
 */
const KEY = "flyary.authRedirectError";

export function extractAuthRedirectError(search: string, hash: string): string | null {
  for (const part of [search.replace(/^\?/, ""), hash.replace(/^#/, "")]) {
    const params = new URLSearchParams(part);
    const description = params.get("error_description");
    const code = params.get("error_code") || params.get("error");
    if (description || code) return [description, code && description ? `(${code})` : code].filter(Boolean).join(" ");
  }
  return null;
}

/** Call once before the router mounts: stores the error and strips it from the address bar. */
export function captureAuthRedirectError(): void {
  const message = extractAuthRedirectError(window.location.search, window.location.hash);
  if (!message) return;
  try { sessionStorage.setItem(KEY, message); } catch { /* storage unavailable */ }
  window.history.replaceState(null, "", window.location.pathname);
}

/** Returns the stored error once (for the login page) and clears it. */
export function takeAuthRedirectError(): string | null {
  try {
    const message = sessionStorage.getItem(KEY);
    if (message) sessionStorage.removeItem(KEY);
    return message;
  } catch {
    return null;
  }
}
