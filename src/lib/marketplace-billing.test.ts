import { describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

import { filterCandidates, sellToMember } from "./marketplace-billing";

describe("sale to a member's bill", () => {
  it("filters members by name", () => {
    const list = [{ user_id: "1", pilot_name: "Mia Muster" }, { user_id: "2", pilot_name: "Jonas" }];
    expect(filterCandidates(list, " mia ").map((c) => c.user_id)).toEqual(["1"]);
    expect(filterCandidates(list, "")).toHaveLength(2);
  });
  it("calls the RPC with Rappen and passes errors on", async () => {
    rpc.mockResolvedValueOnce({ data: "b1", error: null });
    expect(await sellToMember("l", "u", 12050)).toBe("b1");
    expect(rpc).toHaveBeenCalledWith("marketplace_sell_to_member", { _listing: "l", _buyer: "u", _price_cents: 12050 });
    rpc.mockResolvedValueOnce({ data: null, error: { message: "marketplace:buyer_not_member" } });
    await expect(sellToMember("l", "x", null)).rejects.toMatchObject({ message: "marketplace:buyer_not_member" });
  });
});

describe("translations of plan 7.2", async () => {
  const locales = {
    de: (await import("@/i18n/locales/de.json")).default,
    en: (await import("@/i18n/locales/en.json")).default,
    fr: (await import("@/i18n/locales/fr.json")).default,
  };
  const keys = ["action", "title", "hint", "member", "search", "price", "confirm", "done", "noMembers"].map((k) => `market.billing.${k}`)
    .concat(["market.errors.buyer_not_member", "market.errors.school_only"]);
  const lookup = (obj: unknown, path: string) =>
    path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
  it.each(Object.entries(locales))("%s has every text", (_lang, locale) => {
    expect(keys.filter((k) => typeof lookup(locale, k) !== "string")).toEqual([]);
  });
});
