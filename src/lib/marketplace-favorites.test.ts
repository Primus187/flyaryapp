import { describe, expect, it, vi } from "vitest";

const result = { error: null as null | { code: string } };
const insert = vi.fn(async () => result);
const eq2 = vi.fn(async () => result);
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ insert, delete: () => ({ eq: () => ({ eq: eq2 }) }) }), rpc: vi.fn() },
}));

import { setFavorite, sortFavorites, toggledSet, type FavoriteItem } from "./marketplace-favorites";

const item = (id: string, available: boolean, saved_at: string): FavoriteItem => ({
  id, title: id, category: "glider", listing_type: "offer", price_cents: 1, price_type: "fixed", locality: null, is_school: false,
  status: available ? "active" : "sold", available, thumb_path: null, saved_at,
});

describe("favourites", () => {
  it("puts available ones first, newest saved first", () => {
    const sorted = sortFavorites([item("sold", false, "2026-09-24"), item("old", true, "2026-09-20"), item("new", true, "2026-09-23")]);
    expect(sorted.map((i) => i.id)).toEqual(["new", "old", "sold"]);
  });
  it("toggles ids without changing the original set", () => {
    const ids = new Set(["a"]);
    expect([...toggledSet(ids, "b", true)]).toEqual(["a", "b"]);
    expect([...toggledSet(ids, "a", false)]).toEqual([]);
    expect([...ids]).toEqual(["a"]);
  });
  it("treats keeping an already kept listing as success, other errors not", async () => {
    result.error = { code: "23505" };
    await expect(setFavorite("u", "l", true)).resolves.toBeUndefined();
    result.error = { code: "42501" };
    await expect(setFavorite("u", "l", true)).rejects.toEqual({ code: "42501" });
    result.error = null;
    await setFavorite("u", "l", false);
    expect(eq2).toHaveBeenCalledWith("listing_id", "l");
  });
});

describe("translations of plan 6.1", async () => {
  const locales = {
    de: (await import("@/i18n/locales/de.json")).default,
    en: (await import("@/i18n/locales/en.json")).default,
    fr: (await import("@/i18n/locales/fr.json")).default,
  };
  const keys = ["tab", "ownTab", "empty", "emptyHint", "add", "remove", "unavailable", "notifyPrice", "notifyReserved", "notifySold"]
    .map((k) => `market.favorites.${k}`);
  const lookup = (obj: unknown, path: string) =>
    path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
  it.each(Object.entries(locales))("%s has every text", (_lang, locale) => {
    expect(keys.filter((k) => typeof lookup(locale, k) !== "string")).toEqual([]);
  });
});
