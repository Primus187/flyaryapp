import { describe, expect, it, vi } from "vitest";

const upsert = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ upsert: (...a: unknown[]) => upsert(...a) }) } }));

import { emptyShopProfile, normalizeUid, saveShopProfile, shopProblems, type ShopProfile } from "./school-shop";

const complete: ShopProfile = {
  ...emptyShopProfile("g"), legal_name: "Vertical GmbH", street: "Hauptstrasse 1", postal_code: "3800", locality: "Interlaken",
  email: "shop@vertical.ch", warranty_text: "2 Jahre auf Neuware",
};

describe("shopProblems", () => {
  it("accepts a complete profile without VAT", () => {
    expect(shopProblems(complete)).toEqual([]);
  });
  it("lists every missing field", () => {
    expect(shopProblems(emptyShopProfile("g"))).toEqual(["legal_name", "street", "postal_code", "locality", "email", "warranty_text"]);
    expect(shopProblems({ ...complete, email: "shop@vertical" })).toEqual(["email"]);
  });
  it("needs a valid UID when VAT registered, and a valid format whenever given", () => {
    expect(shopProblems({ ...complete, vat_registered: true })).toEqual(["uid_number"]);
    expect(shopProblems({ ...complete, vat_registered: true, uid_number: "CHE-123.456.789" })).toEqual([]);
    expect(shopProblems({ ...complete, uid_number: "CHE-123" })).toEqual(["uid_number"]);
  });
});

describe("normalizeUid", () => {
  it.each([["CHE123456789", "CHE-123.456.789"], ["che-123 456 789", "CHE-123.456.789"], ["CHE-123.456.789", "CHE-123.456.789"], [" 123456 ", "123456"]])(
    "%s → %s", (input, out) => { expect(normalizeUid(input)).toBe(out); });
});

it("saves trimmed values and a normalized UID", async () => {
  upsert.mockResolvedValue({ error: null });
  await saveShopProfile({ ...complete, legal_name: " Vertical GmbH ", uid_number: "che123456789", phone: " " });
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ legal_name: "Vertical GmbH", uid_number: "CHE-123.456.789", phone: null }),
    { onConflict: "group_id" });
});

describe("translations of plan 4.7", async () => {
  const locales = {
    de: (await import("@/i18n/locales/de.json")).default,
    en: (await import("@/i18n/locales/en.json")).default,
    fr: (await import("@/i18n/locales/fr.json")).default,
  };
  const keys = [
    ...["legal_name", "street", "postal_code", "locality", "email", "phone", "uid_number", "vat_registered", "warranty_text", "active"]
      .map((f) => `market.shop.fields.${f}`),
    "market.shop.title", "market.shop.tabs.listings", "market.shop.tabs.profile", "market.shop.ready", "market.shop.notReady",
    "market.shop.noAccess", "market.shop.sellAs", "market.shop.sellAsMe", "market.shop.visibility", "market.shop.quantity",
    "market.shop.notReadyForm", "market.shop.sellerDetails", "market.shop.inclVat", "market.errors.shop_not_ready",
    "school.functions.shop", "school.functions.market_moderator",
  ];
  const lookup = (obj: unknown, path: string) =>
    path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
  it.each(Object.entries(locales))("%s has every text", (_lang, locale) => {
    expect(keys.filter((k) => typeof lookup(locale, k) !== "string")).toEqual([]);
  });
});
