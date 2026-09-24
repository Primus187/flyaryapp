import { describe, expect, it, vi } from "vitest";
import { geocodeSwissPostalCode, pickPostalCode, roundCoord, weightFit } from "./geo-ch";

const response = { results: [
  { attrs: { origin: "zipcode", detail: "3801", lat: 46.6, lon: 7.9 } },
  { attrs: { origin: "zipcode", detail: "3800", lat: 46.684207916259766, lon: 7.878627300262451 } },
] };

describe("postal code positions", () => {
  it("takes exactly the requested postal code, rounded to about 1 km", () => {
    expect(pickPostalCode(response, "3800")).toEqual({ lat: 46.68, lng: 7.88 });
    expect(pickPostalCode(response, "9999")).toBeNull();
    expect(pickPostalCode(null, "3800")).toBeNull();
    expect(roundCoord(7.8786)).toBe(7.88);
  });
  it("asks geo.admin.ch once per code and never for invalid codes", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(response)));
    expect(await geocodeSwissPostalCode("3800", fetchImpl as unknown as typeof fetch)).toEqual({ lat: 46.68, lng: 7.88 });
    expect(await geocodeSwissPostalCode(" 3800 ", fetchImpl as unknown as typeof fetch)).toEqual({ lat: 46.68, lng: 7.88 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(await geocodeSwissPostalCode("75001", fetchImpl as unknown as typeof fetch)).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("returns null when the service fails", async () => {
    const failing = vi.fn(async () => { throw new Error("offline"); });
    expect(await geocodeSwissPostalCode("1000", failing as unknown as typeof fetch)).toBeNull();
  });
});

describe("weightFit", () => {
  it("compares the take-off weight with the wing's range", () => {
    expect(weightFit({ weight_min: 70, weight_max: 90 }, 85)).toBe("fits");
    expect(weightFit({ weight_min: 70, weight_max: 90 }, 95)).toBe("outside");
    expect(weightFit({}, 85)).toBeNull();
    expect(weightFit({ weight_min: 70, weight_max: 90 }, null)).toBeNull();
  });
});

describe("translations of plan 6.4", async () => {
  const locales = {
    de: (await import("@/i18n/locales/de.json")).default,
    en: (await import("@/i18n/locales/en.json")).default,
    fr: (await import("@/i18n/locales/fr.json")).default,
  };
  const keys = ["plz", "radius", "weight", "weightHint", "notFound", "weightFits", "weightOutside"].map((k) => `market.radius.${k}`);
  const lookup = (obj: unknown, path: string) =>
    path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
  it.each(Object.entries(locales))("%s has every text", (_lang, locale) => {
    expect(keys.filter((k) => typeof lookup(locale, k) !== "string")).toEqual([]);
  });
});
