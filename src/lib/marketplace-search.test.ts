import { describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

import {
  EMPTY_FILTERS, activeFilterCount, ageLabel, filtersFromParams, filtersToParams, searchListings, showsCertificationFilter,
  toRpcFilters, toggle, type SearchFilters,
} from "./marketplace-search";

const full: SearchFilters = {
  q: " alpha ", type: "offer", categories: ["glider", "reserve"], conditions: ["used"], certifications: ["a", "b"], cantons: ["BE", "other"],
  priceMin: "500", priceMax: "1'800", size: " M ", schoolsOnly: true, sort: "price_asc", nearPlz: "3800", radiusKm: 25, weightKg: "85",
};

describe("URL round trip", () => {
  it("keeps every filter", () => {
    expect(filtersFromParams(filtersToParams(full))).toEqual({ ...full, q: "alpha", size: "M" });
  });
  it("leaves empty filters out of the URL", () => {
    expect(filtersToParams(EMPTY_FILTERS).toString()).toBe("");
  });
  it("ignores unknown values", () => {
    expect(filtersFromParams(new URLSearchParams("type=x&cat=glider,paramotor&class=z&canton=XX&sort=cheap&near=75001&radius=7&weight=5"))).toEqual({
      ...EMPTY_FILTERS, categories: ["glider"],
    });
  });
});

describe("RPC filters", () => {
  it("converts prices to Rappen and drops empties", () => {
    expect(toRpcFilters(full)).toEqual({
      sort: "price_asc", q: "alpha", type: "offer", categories: ["glider", "reserve"], conditions: ["used"], certifications: ["a", "b"],
      cantons: ["BE", "other"], price_min: 50000, price_max: 180000, size: "M", schools_only: true, weight: 85,
    });
    // the radius only with the postal code's position
    expect(toRpcFilters(full, { lat: 46.68, lng: 7.88 })).toMatchObject({ near: { lat: 46.68, lng: 7.88, radius_km: 25 } });
    expect(toRpcFilters({ ...EMPTY_FILTERS, weightKg: "12" })).toEqual({ sort: "newest" });
    expect(toRpcFilters(EMPTY_FILTERS)).toEqual({ sort: "newest" });
    expect(toRpcFilters({ ...EMPTY_FILTERS, priceMin: "abc" })).toEqual({ sort: "newest" });
  });
  it("drops the class filter when no wings can match", () => {
    expect(toRpcFilters({ ...EMPTY_FILTERS, categories: ["harness"], certifications: ["a"] })).not.toHaveProperty("certifications");
    expect(showsCertificationFilter([])).toBe(true);
    expect(showsCertificationFilter(["helmet", "tandem"])).toBe(true);
    expect(showsCertificationFilter(["helmet"])).toBe(false);
  });
  it("counts the filters of the sheet", () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, q: "x", categories: ["glider"] })).toBe(0);
    expect(activeFilterCount(full)).toBe(10);
  });
  it("calls marketplace_search with the page size and cursor", async () => {
    rpc.mockResolvedValue({ data: { items: [], next_cursor: null }, error: null });
    await searchListings(EMPTY_FILTERS, { t: "x", id: "y" });
    expect(rpc).toHaveBeenCalledWith("marketplace_search", { _filters: { sort: "newest" }, _cursor: { t: "x", id: "y" }, _limit: 24 });
    await searchListings({ ...EMPTY_FILTERS, nearPlz: "3800" }, null, { lat: 46.68, lng: 7.88 });
    expect(rpc).toHaveBeenLastCalledWith("marketplace_search", { _filters: { sort: "newest", near: { lat: 46.68, lng: 7.88, radius_km: 50 } }, _cursor: null, _limit: 24 });
  });
});

describe("helpers", () => {
  it("toggles values", () => {
    expect(toggle(["a"], "b")).toEqual(["a", "b"]);
    expect(toggle(["a", "b"], "a")).toEqual(["b"]);
  });
  it("labels the age of a listing", () => {
    const now = new Date("2026-09-24T12:00:00Z");
    expect(ageLabel("2026-09-24T11:30:00Z", "de", now)).toBe("vor 30 Minuten");
    expect(ageLabel("2026-09-24T09:00:00Z", "de", now)).toBe("vor 3 Stunden");
    expect(ageLabel("2026-09-21T12:00:00Z", "de", now)).toBe("vor 3 Tagen");
    expect(ageLabel("2026-09-23T12:00:00Z", "en", now)).toBe("yesterday");
  });
});

describe("translations of plan 4.5", async () => {
  const locales = {
    de: (await import("@/i18n/locales/de.json")).default,
    en: (await import("@/i18n/locales/en.json")).default,
    fr: (await import("@/i18n/locales/fr.json")).default,
  };
  const keys = [
    "browse.searchPlaceholder", "browse.all", "browse.filters", "browse.filterTitle", "browse.type", "browse.types.offer", "browse.types.wanted",
    "browse.priceFrom", "browse.priceTo", "browse.schoolsOnly", "browse.sort", "browse.sorts.newest", "browse.sorts.price_asc",
    "browse.sorts.price_desc", "browse.reset", "browse.apply", "browse.loadMore", "browse.empty", "browse.emptyHint", "browse.wantedBadge",
    "browse.school", "detail.details", "detail.seller", "detail.memberSince", "detail.flights_one", "detail.flights_other",
    "detail.quantity_one", "detail.quantity_other", "detail.share", "detail.linkCopied",
  ];
  const lookup = (obj: unknown, path: string) =>
    path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
  it.each(Object.entries(locales))("%s has every text", (_lang, locale) => {
    expect(keys.filter((k) => typeof lookup((locale as { market: unknown }).market, k) !== "string")).toEqual([]);
  });
});
