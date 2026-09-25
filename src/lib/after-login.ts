/**
 * Where to go right after signing in (plan 8.4: from a public listing to the listing in the app). Kept for this
 * tab only; only in-app paths are accepted, so a crafted value cannot send people to another site.
 */
const KEY = "flyary.afterLogin";

export const isAppPath = (path: string) => /^\/(?!\/)[\w\-/?=&.%]*$/.test(path);

export function rememberAfterLogin(path: string) {
  if (!isAppPath(path)) return;
  try { sessionStorage.setItem(KEY, path); } catch { /* private mode: plain dashboard then */ }
}

/** The remembered path, once (removed on reading). */
export function takeAfterLogin(): string | null {
  try {
    const path = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return path && isAppPath(path) ? path : null;
  } catch { return null; }
}
