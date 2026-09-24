import { describe, expect, it, vi } from "vitest";

const single = vi.fn();
const insert = vi.fn(() => ({ select: () => ({ single }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ insert }), rpc: vi.fn() } }));

import { EMPTY_FILTERS } from "./marketplace-search";
import { hasSearchCriteria, saveSearch, savedFilters, savedSearchFilters, suggestName } from "./marketplace-saved-searches";

describe("saved searches", () => {
  const f = { ...EMPTY_FILTERS, q: " Alpha ", categories: ["glider" as const], priceMax: "1'500", sort: "price_asc" as const };

  it("only saves searches that narrow something down", () => {
    expect(hasSearchCriteria(EMPTY_FILTERS)).toBe(false);
    expect(hasSearchCriteria({ ...EMPTY_FILTERS, sort: "price_desc" })).toBe(false);
    expect(hasSearchCriteria({ ...EMPTY_FILTERS, cantons: ["BE"] })).toBe(true);
  });

  it("stores matching filters without the sort order", () => {
    expect(savedFilters(f)).toEqual({ q: "Alpha", categories: ["glider"], price_max: 150000 });
  });

  it("suggests a name from the search text or the categories", () => {
    const label = (c: string) => (c === "glider" ? "Schirm" : c);
    expect(suggestName(f, label, "Suche")).toBe("Alpha");
    expect(suggestName({ ...f, q: "" }, label, "Suche")).toBe("Schirm");
    expect(suggestName(EMPTY_FILTERS, label, "Suche")).toBe("Suche");
  });

  it("saves filters and URL query, and opens with the same filters", async () => {
    single.mockResolvedValue({ data: { id: "s1" }, error: null });
    expect(await saveSearch("u", " Alpha ", f)).toBe("s1");
    const row = (insert.mock.calls[0] as unknown[])[0] as { name: string; query: string; filters: object };
    expect(row.name).toBe("Alpha");
    expect(savedSearchFilters(row)).toEqual({ ...f, q: "Alpha" });
  });

  it("reports the limit", async () => {
    single.mockResolvedValue({ data: null, error: { message: "marketplace:limit_saved_searches" } });
    await expect(saveSearch("u", "x", f)).rejects.toMatchObject({ message: "marketplace:limit_saved_searches" });
  });
});

describe("translations of plan 6.2", async () => {
  const locales = {
    de: (await import("@/i18n/locales/de.json")).default,
    en: (await import("@/i18n/locales/en.json")).default,
    fr: (await import("@/i18n/locales/fr.json")).default,
  };
  const keys = [...["save", "title", "empty", "namePrompt", "defaultName", "saved", "newCount", "notify", "delete", "deleteConfirm", "notification"]
    .map((k) => `market.saved.${k}`), "market.errors.limit_saved_searches"];
  const lookup = (obj: unknown, path: string) =>
    path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
  it.each(Object.entries(locales))("%s has every text", (_lang, locale) => {
    expect(keys.filter((k) => typeof lookup(locale, k) !== "string")).toEqual([]);
  });
});
