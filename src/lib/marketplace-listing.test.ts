import { describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

import {
  availableActions, daysLeft, effectiveStatus, formatChf, listingExpires, marketErrorCode, mineTab, nextBumpAt,
  parsePriceInput, priceInputValue, publishProblems, runListingAction,
} from "./marketplace-listing";

const now = new Date("2026-09-24T12:00:00Z");
const day = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(now.getTime() + offsetDays * day).toISOString();

describe("price input", () => {
  it.each([
    ["1800", 180000], ["1'800", 180000], ["1’800.50", 180050], ["1 800,5", 180050], ["CHF 90.–", 9000], ["0", 0], ["", null],
    ["abc", null], ["12.345", null], ["-5", null], ["100001", null],
  ])("%s → %s", (input, cents) => {
    expect(parsePriceInput(input)).toBe(cents);
  });
  it("round-trips to the input field", () => {
    expect(priceInputValue(180000)).toBe("1800");
    expect(priceInputValue(180050)).toBe("1800.50");
    expect(priceInputValue(null)).toBe("");
  });
  it("formats Swiss francs", () => {
    expect(formatChf(180000).replace(/\s/g, " ")).toMatch(/^CHF 1.800$/);
    expect(formatChf(9050)).toMatch(/90\.50$/);
  });
});

describe("publishProblems", () => {
  const complete = {
    title: "Advance Alpha 7", listing_type: "offer" as const, category: "glider" as const, price_type: "fixed" as const,
    price_cents: 180000, condition: "used" as const, postal_code: "3800", locality: "Interlaken", attributes: { certification: "a" },
  };
  it("accepts a complete offer with a photo", () => {
    expect(publishProblems(complete, 1)).toEqual([]);
  });
  it("lists everything that is missing", () => {
    expect(publishProblems({ ...complete, title: " x ", price_cents: null, condition: null, postal_code: "38", attributes: {} }, 0))
      .toEqual(["missing_title", "missing_place", "missing_price", "missing_condition", "missing_attributes", "missing_photo"]);
  });
  it("needs no price for free or on-request offers", () => {
    expect(publishProblems({ ...complete, price_type: "free", price_cents: null }, 1)).toEqual([]);
    expect(publishProblems({ ...complete, price_type: "on_request", price_cents: null }, 1)).toEqual([]);
  });
  it("wanted listings only need title and place", () => {
    expect(publishProblems({ ...complete, listing_type: "wanted", price_cents: null, condition: null, attributes: {} }, 0)).toEqual([]);
  });
});

describe("running time", () => {
  it("school new goods do not expire, everything else does", () => {
    expect(listingExpires({ seller_group_id: "s", condition: "new" })).toBe(false);
    expect(listingExpires({ seller_group_id: "s", condition: "used" })).toBe(true);
    expect(listingExpires({ seller_group_id: null, condition: "new" })).toBe(true);
  });
  it("counts days left", () => {
    expect(daysLeft(iso(60), now)).toBe(60);
    expect(daysLeft(iso(0.5), now)).toBe(0);
    expect(daysLeft(iso(-3), now)).toBe(0);
    expect(daysLeft(null, now)).toBeNull();
  });
  it("treats a listing past its end as expired", () => {
    expect(effectiveStatus({ status: "active", expires_at: iso(-0.01) }, now)).toBe("expired");
    expect(effectiveStatus({ status: "reserved", expires_at: iso(1) }, now)).toBe("reserved");
    expect(effectiveStatus({ status: "active", expires_at: null }, now)).toBe("active");
    expect(effectiveStatus({ status: "sold", expires_at: iso(-10) }, now)).toBe("sold");
  });
  it("allows bumping again after 7 days", () => {
    expect(nextBumpAt(iso(-2), now)?.toISOString()).toBe(iso(5));
    expect(nextBumpAt(iso(-7), now)).toBeNull();
    expect(nextBumpAt(null, now)).toBeNull();
  });
});

describe("Meine Anzeigen", () => {
  it("sorts into tabs", () => {
    expect(mineTab({ status: "draft", expires_at: null }, now)).toBe("drafts");
    expect(mineTab({ status: "reserved", expires_at: iso(3) }, now)).toBe("live");
    expect(mineTab({ status: "active", expires_at: iso(-1) }, now)).toBe("ended");
    expect(mineTab({ status: "removed", expires_at: null }, now)).toBe("ended");
  });
  it("offers the actions of the state", () => {
    expect(availableActions({ status: "draft", expires_at: null }, now)).toEqual(["publish", "edit", "delete"]);
    expect(availableActions({ status: "active", expires_at: iso(-1) }, now)).toEqual(["renew", "edit", "sold", "delete"]);
    expect(availableActions({ status: "reserved", expires_at: iso(10) }, now)).toContain("unreserve");
    expect(availableActions({ status: "removed", expires_at: null }, now)).toEqual(["delete"]);
  });
});

describe("errors and actions", () => {
  it("reads the code from RPC errors", () => {
    expect(marketErrorCode({ message: "marketplace:limit_daily" })).toBe("limit_daily");
    expect(marketErrorCode(new Error("marketplace:missing_photo"))).toBe("missing_photo");
    expect(marketErrorCode({ message: "marketplace:something_new" })).toBe("unknown");
    expect(marketErrorCode(null)).toBe("unknown");
  });
  it("calls the matching RPC", async () => {
    rpc.mockResolvedValue({ error: null });
    await runListingAction("reserve", "l1");
    await runListingAction("unreserve", "l1");
    await runListingAction("sold", "l1");
    expect(rpc.mock.calls).toEqual([
      ["marketplace_reserve", { _listing: "l1", _reserved: true }],
      ["marketplace_reserve", { _listing: "l1", _reserved: false }],
      ["marketplace_mark_sold", { _listing: "l1" }],
    ]);
    rpc.mockResolvedValue({ error: { message: "marketplace:bump_too_soon" } });
    await expect(runListingAction("bump", "l1")).rejects.toMatchObject({ code: "bump_too_soon" });
  });
});

describe("translations of plan 4.4", async () => {
  const locales = {
    de: (await import("@/i18n/locales/de.json")).default,
    en: (await import("@/i18n/locales/en.json")).default,
    fr: (await import("@/i18n/locales/fr.json")).default,
  };
  const keys = [
    ...["missing_title", "missing_place", "missing_price", "missing_condition", "missing_attributes", "missing_photo", "not_found",
      "not_allowed", "banned", "wrong_status", "limit_active", "limit_daily", "bump_too_soon", "unknown"].map((c) => `errors.${c}`),
    ...["not_an_image", "too_large", "too_many", "unsupported_format", "upload_failed"].map((c) => `photos.errors.${c}`),
    ...["publish", "edit", "reserve", "unreserve", "sold", "renew", "bump", "delete"].map((a) => `mine.${a}`),
    ...["live", "drafts", "ended"].flatMap((tab) => [`mine.tabs.${tab}`, `mine.empty.${tab}`]),
    "form.step1", "form.step2", "form.step3", "form.cantonOther", "priceTypes.negotiable",
  ];
  const lookup = (obj: unknown, path: string) =>
    path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
  it.each(Object.entries(locales))("%s has every text", (_lang, locale) => {
    expect(keys.filter((k) => typeof lookup((locale as { market: unknown }).market, k) !== "string")).toEqual([]);
  });
});
