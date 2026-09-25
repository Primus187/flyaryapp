import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION } from "@/lib/app-update";

export type ErrorKind = "render" | "error" | "rejection" | "chunk";

/** Message and stack of anything that was thrown (Error, string, object, nothing). */
export function normalizeError(error: unknown): { message: string; stack: string | null } {
  if (error instanceof Error) return { message: `${error.name}: ${error.message}`, stack: error.stack ?? null };
  if (typeof error === "string") return { message: error, stack: null };
  try { return { message: JSON.stringify(error) ?? String(error), stack: null }; } catch { return { message: String(error), stack: null }; }
}

/**
 * Noise that says nothing about the app: browser extensions, the harmless ResizeObserver warning,
 * cross-origin "Script error." without details, network failures while the device is offline.
 */
export function isNoise(message: string, stack: string | null, online: boolean): boolean {
  if (/(chrome|moz|safari(-web)?)-extension:\/\//.test(stack ?? "") || /(chrome|moz|safari(-web)?)-extension:\/\//.test(message)) return true;
  if (/ResizeObserver loop/.test(message)) return true;
  if (/^Script error\.?$/.test(message.trim())) return true;
  if (!online && /Failed to fetch|NetworkError|Load failed|network/i.test(message)) return true;
  return false;
}

/** Per page load: each distinct error once, at most `max` reports. */
export function createReportLimiter(max = 10) {
  const seen = new Set<string>();
  return (key: string): boolean => {
    if (seen.has(key) || seen.size >= max) return false;
    seen.add(key);
    return true;
  };
}

const allow = createReportLimiter();

/**
 * Reports an error silently to the admin's error log (client_errors). Never throws and never
 * shows anything – the report must not become a second problem.
 */
export function reportError(kind: ErrorKind, error: unknown, extraStack?: string | null): void {
  try {
    const { message, stack } = normalizeError(error);
    if (isNoise(message, stack, navigator.onLine)) return;
    if (!allow(`${kind}|${message}`)) return;
    const fullStack = [stack, extraStack].filter(Boolean).join("\n--\n") || null;
    void supabase.rpc("report_client_error", {
      _kind: kind,
      _message: message.slice(0, 500),
      _stack: fullStack?.slice(0, 4000) ?? null,
      _path: window.location.pathname.slice(0, 300),
      _app_version: APP_VERSION.slice(0, 60),
      _user_agent: navigator.userAgent.slice(0, 300),
    }).then(() => undefined, () => undefined);
  } catch {
    /* reporting must never fail the app */
  }
}
