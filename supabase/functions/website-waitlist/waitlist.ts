// Pure logic of the website's pilot sign-up form (www.flyary.ch → Edge Function website-waitlist).
// Kept free of Deno imports so Vitest can test it (src/lib/website-waitlist.test.ts).

export const LANGUAGES = ["de", "fr", "en"] as const;
export const ROLES = ["student", "pilot", "tandem_pilot", "instructor"] as const;
export const DISCIPLINES = ["paraglider", "hangglider"] as const;

/** Where the website runs; redirects only go back there (never to an address from the request). */
export const ALLOWED_ORIGINS = [
  "https://www.flyary.ch", "https://flyary.ch", "https://flyary-website.vercel.app",
  "http://127.0.0.1:4188", "http://localhost:4188",
];
const DEFAULT_ORIGIN = "https://www.flyary.ch";

export interface WaitlistEntry {
  name: string; email: string; language: string; role: string; disciplines: string[]; school: string; comment: string;
}

export type ParseResult =
  | { kind: "entry"; entry: WaitlistEntry }
  | { kind: "spam"; language: string } // honeypot filled or sent faster than a person can type: pretend success
  | { kind: "invalid"; language: string };

const text = (v: FormDataEntryValue | string | null | undefined) => (typeof v === "string" ? v.trim() : "");

/** Reads and checks the submitted form. `now` in ms; `started` is the page's timestamp field (optional). */
export function parseWaitlistForm(form: { get(k: string): FormDataEntryValue | string | null; getAll(k: string): (FormDataEntryValue | string)[] }, now: number): ParseResult {
  const lang = text(form.get("lang"));
  const language = (LANGUAGES as readonly string[]).includes(lang) ? lang : "de";
  if (text(form.get("website"))) return { kind: "spam", language };
  const started = Number(text(form.get("started")));
  if (Number.isFinite(started) && started > 0 && now - started < 3000) return { kind: "spam", language };

  const entry: WaitlistEntry = {
    name: text(form.get("name")),
    email: text(form.get("email")).toLowerCase(),
    language,
    role: text(form.get("role")),
    disciplines: [...new Set(form.getAll("discipline").map((d) => text(d)).filter((d) => (DISCIPLINES as readonly string[]).includes(d)))],
    school: text(form.get("school")).slice(0, 120),
    comment: text(form.get("comment")).slice(0, 1000),
  };
  const ok = entry.name.length >= 2 && entry.name.length <= 100
    && entry.email.length <= 200 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(entry.email)
    && (ROLES as readonly string[]).includes(entry.role)
    && text(form.get("consent")) === "yes";
  return ok ? { kind: "entry", entry } : { kind: "invalid", language };
}

/** The website origin to send the visitor back to, from Origin or Referer, else the public site. */
export function websiteOrigin(originHeader: string | null, refererHeader: string | null): string {
  for (const candidate of [originHeader, refererHeader]) {
    if (!candidate) continue;
    try {
      const origin = new URL(candidate).origin;
      if (ALLOWED_ORIGINS.includes(origin)) return origin;
    } catch { /* not a URL */ }
  }
  return DEFAULT_ORIGIN;
}

/** Thank-you page on success (also for spam, so bots learn nothing), the form otherwise; the anchor reveals the matching message via CSS :target (works without JS). */
export function redirectTarget(origin: string, language: string, outcome: "ok" | "invalid" | "rate_limited" | "error"): string {
  return outcome === "ok"
    ? `${origin}/${language}/danke/`
    : `${origin}/${language}/testpilot/?status=${outcome}#status-${outcome}`;
}
