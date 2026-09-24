import { describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const maybeSingle = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  },
}));

import { openListingChat, paymentRisk } from "./marketplace-chat";

describe("paymentRisk", () => {
  it.each([
    ["Überweise bitte auf CH93 0076 2011 6238 5295 7", "iban"],
    ["IBAN: CH9300762011623852957", "iban"],
    ["CH93\u00a00076\u00a02011\u00a06238\u00a05295\u00a07", "iban"],
    ["DE89 3704 0044 0532 0130 00 danke", "iban"],
    ["Zahl einfach via paypal.me/flyer123", "payment_link"],
    ["https://revolut.me/abc", "payment_link"],
    ["Schick das Geld mit Western Union", "money_transfer"],
  ])("%s → %s", (text, risk) => {
    expect(paymentRisk(text)).toBe(risk);
  });
  it.each([
    "Ist der Schirm noch da?", "Grösse 26, Baujahr 2021, CHF 1800", "Ruf mich an: 079 123 45 67", "Zahlung mit TWINT bei Abholung",
    "Treffpunkt 3800 Interlaken, 14 Uhr",
  ])("no risk: %s", (text) => {
    expect(paymentRisk(text)).toBeNull();
  });
});

describe("openListingChat", () => {
  it("prefills the first question only for a new chat", async () => {
    rpc.mockResolvedValue({ data: "c1", error: null });
    maybeSingle.mockResolvedValueOnce({ data: { last_message_at: null } });
    expect(await openListingChat("l1", "Ist das noch verfügbar?")).toBe("/messages/c1?text=Ist%20das%20noch%20verf%C3%BCgbar%3F");
    maybeSingle.mockResolvedValueOnce({ data: { last_message_at: "2026-09-24T10:00:00Z" } });
    expect(await openListingChat("l1", "x")).toBe("/messages/c1");
    expect(rpc).toHaveBeenCalledWith("marketplace_open_chat", { _listing: "l1" });
  });
  it("passes RPC errors on", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "marketplace:own_listing" } });
    await expect(openListingChat("l1", "x")).rejects.toMatchObject({ message: "marketplace:own_listing" });
  });
});

describe("translations of plan 4.6", async () => {
  const locales = {
    de: (await import("@/i18n/locales/de.json")).default,
    en: (await import("@/i18n/locales/en.json")).default,
    fr: (await import("@/i18n/locales/fr.json")).default,
  };
  const keys = ["market.chat.contact", "market.chat.firstQuestion", "market.chat.openListing", "market.chat.listingGone", "market.chat.safety",
    "market.chat.paymentWarningTitle", "market.chat.paymentWarning", "market.errors.own_listing", "chat.audience.listing", "chat.filters.market"];
  const lookup = (obj: unknown, path: string) =>
    path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
  it.each(Object.entries(locales))("%s has every text", (_lang, locale) => {
    expect(keys.filter((k) => typeof lookup(locale, k) !== "string")).toEqual([]);
  });
});
