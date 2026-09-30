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

/**
 * Links that must survive the Google sign-in when opened signed out: an .igc shared from the phone
 * (waits in Cache Storage), a group or school invite link (/groups?invite=…, SchoolInvite) and a
 * personal invitation link (/welcome/<token>, migration 0079) or a school lead link (/welcome/lead/<token>, 0085).
 */
export function pathToKeepThroughLogin(pathname: string, search: string): string | null {
  const params = new URLSearchParams(search);
  if (pathname === "/flights/new" && params.has("shared")) return pathname + search;
  if (pathname === "/groups" && params.get("invite")) return pathname + search;
  if (/^\/welcome\/(lead\/)?[0-9a-f]{64}$/i.test(pathname)) return pathname;
  return null;
}
