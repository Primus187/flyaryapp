import { describe, expect, it } from "vitest";
import { parseWaitlistForm, redirectTarget, websiteOrigin } from "../../supabase/functions/website-waitlist/waitlist";

const form = (fields: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) (Array.isArray(v) ? v : [v]).forEach((x) => f.append(k, x));
  return f;
};
const valid = { name: " Petra Pilotin ", email: "Petra@Example.ch", lang: "fr", role: "pilot", discipline: ["paraglider", "hangglider", "rocket"], school: "", comment: "Hallo", consent: "yes" };
const now = 1_000_000;

describe("website pilot sign-up form", () => {
  it("reads a valid submission", () => {
    const r = parseWaitlistForm(form(valid), now);
    expect(r).toEqual({ kind: "entry", entry: { name: "Petra Pilotin", email: "petra@example.ch", language: "fr", role: "pilot", disciplines: ["paraglider", "hangglider"], school: "", comment: "Hallo" } });
  });

  it("treats a filled honeypot or a too fast submission as spam", () => {
    expect(parseWaitlistForm(form({ ...valid, website: "http://spam" }), now).kind).toBe("spam");
    expect(parseWaitlistForm(form({ ...valid, started: String(now - 1000) }), now).kind).toBe("spam");
    expect(parseWaitlistForm(form({ ...valid, started: String(now - 10_000) }), now).kind).toBe("entry");
  });

  it("requires name, e-mail, role and consent, and keeps the language for the error page", () => {
    expect(parseWaitlistForm(form({ ...valid, consent: "" }), now)).toEqual({ kind: "invalid", language: "fr" });
    expect(parseWaitlistForm(form({ ...valid, email: "nope" }), now).kind).toBe("invalid");
    expect(parseWaitlistForm(form({ ...valid, role: "boss" }), now).kind).toBe("invalid");
    expect(parseWaitlistForm(form({ ...valid, lang: "xx", name: "" }), now)).toEqual({ kind: "invalid", language: "de" });
  });

  it("redirects only back to the website", () => {
    expect(websiteOrigin("https://flyary-website.vercel.app", null)).toBe("https://flyary-website.vercel.app");
    expect(websiteOrigin(null, "https://www.flyary.ch/de/testpilot/")).toBe("https://www.flyary.ch");
    expect(websiteOrigin("https://evil.example", "https://evil.example/x")).toBe("https://www.flyary.ch");
    expect(redirectTarget("https://www.flyary.ch", "en", "ok")).toBe("https://www.flyary.ch/en/danke/");
    expect(redirectTarget("https://www.flyary.ch", "de", "rate_limited")).toBe("https://www.flyary.ch/de/testpilot/?status=rate_limited#status-rate_limited");
  });
});
