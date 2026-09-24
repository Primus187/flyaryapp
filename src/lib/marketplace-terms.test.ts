import { describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();
const upsert = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }), upsert: (...a: unknown[]) => upsert(...a) }) },
}));

import { MARKET_TERMS_VERSION, acceptTerms, hasAcceptedTerms, withPrivateSaleClause } from "./marketplace-terms";

describe("marketplace rules", () => {
  it("counts only the current version as accepted", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null });
    expect(await hasAcceptedTerms("u")).toBe(false);
    maybeSingle.mockResolvedValueOnce({ data: { version: MARKET_TERMS_VERSION } });
    expect(await hasAcceptedTerms("u")).toBe(true);
    maybeSingle.mockResolvedValueOnce({ data: { version: MARKET_TERMS_VERSION - 1 } });
    expect(await hasAcceptedTerms("u")).toBe(false);
  });
  it("stores the current version", async () => {
    upsert.mockResolvedValue({ error: null });
    await acceptTerms("u");
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "u", version: MARKET_TERMS_VERSION }), { onConflict: "user_id" });
  });
});

describe("withPrivateSaleClause", () => {
  const clause = "Privatverkauf.";
  it("appends once, after a blank line", () => {
    expect(withPrivateSaleClause("Schöner Schirm  \n", clause)).toBe("Schöner Schirm\n\nPrivatverkauf.");
    expect(withPrivateSaleClause("", clause)).toBe("Privatverkauf.");
    expect(withPrivateSaleClause("A\n\nPrivatverkauf.", clause)).toBe("A\n\nPrivatverkauf.");
  });
});

describe("translations of plan 4.10", async () => {
  const locales = {
    de: (await import("@/i18n/locales/de.json")).default,
    en: (await import("@/i18n/locales/en.json")).default,
    fr: (await import("@/i18n/locales/fr.json")).default,
  };
  const keys = ["title", "intro", "rule1", "rule2", "rule3", "rule4", "accept", "cancel", "privateSaleClause", "addPrivateSale",
    "sectionTitle", "sectionRole", "sectionResponsibility", "sectionForbidden", "sectionModeration", "sectionSchools", "sectionData"]
    .map((k) => `market.terms.${k}`);
  const lookup = (obj: unknown, path: string) =>
    path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
  it.each(Object.entries(locales))("%s has every text", (_lang, locale) => {
    expect(keys.filter((k) => typeof lookup(locale, k) !== "string")).toEqual([]);
  });
});
