// @vitest-environment node
import { describe, expect, it } from "vitest";
import de from "@/i18n/locales/de.json";
import en from "@/i18n/locales/en.json";
import fr from "@/i18n/locales/fr.json";
import {
  DELIVERY_OPTIONS, LISTING_CATEGORIES, LISTING_CONDITIONS, LISTING_STATUSES, LISTING_TYPES, LISTING_VISIBILITIES, PRICE_TYPES,
} from "./marketplace";
import { CATEGORY_SPECS, isListingCategory, parseMonthDate, validateAttributes } from "./marketplace-categories";
import type { SafetyHintCode } from "./marketplace-safety";

const now = new Date("2026-09-24T12:00:00Z");

describe("CATEGORY_SPECS", () => {
  it("covers every category exactly once, with unique attribute keys", () => {
    expect(Object.keys(CATEGORY_SPECS)).toEqual([...LISTING_CATEGORIES]);
    for (const spec of Object.values(CATEGORY_SPECS)) {
      const keys = spec.attributes.map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
  it("recognises categories", () => {
    expect(isListingCategory("reserve")).toBe(true);
    expect(isListingCategory("paramotor")).toBe(false);
  });
});

describe("parseMonthDate", () => {
  it("accepts months and real days", () => {
    expect(parseMonthDate("2026-04")?.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    expect(parseMonthDate("2024-02-29")?.toISOString()).toBe("2024-02-29T00:00:00.000Z");
  });
  it.each(["2026-13", "2026-02-30", "26-04", "2026-4", "", 202604, null])("rejects %s", (value) => {
    expect(parseMonthDate(value)).toBeNull();
  });
});

describe("validateAttributes", () => {
  it("cleans a complete wing: numbers from text, unknown keys and empty inputs dropped", () => {
    const res = validateAttributes("glider", {
      certification: "b", weight_min: "75", weight_max: 95, flight_hours: "120", last_check: "2026-03",
      porosity: "", repairs: "  Leine A2 ersetzt ", hacked: "<script>",
    }, "offer", now);
    expect(res).toEqual({
      ok: true, errors: [],
      cleaned: { certification: "b", weight_min: 75, weight_max: 95, flight_hours: 120, last_check: "2026-03", repairs: "Leine A2 ersetzt" },
    });
  });

  it("requires the key fields for offers but not for wanted listings", () => {
    expect(validateAttributes("reserve", {}, "offer", now).errors).toEqual([
      { key: "reserve_type", code: "required" }, { key: "max_load", code: "required" },
    ]);
    expect(validateAttributes("reserve", {}, "wanted", now)).toMatchObject({ ok: true, cleaned: {} });
    expect(validateAttributes("clothing", {}, "offer", now).ok).toBe(true);
  });

  it("reports invalid, out-of-range, future, too long and inverted weight ranges", () => {
    const res = validateAttributes("glider", {
      certification: "z", weight_min: 110, weight_max: 90, flight_hours: 12.5, last_check: "2027-01", repairs: "x".repeat(301),
    }, "offer", now);
    expect(res.ok).toBe(false);
    expect(res.errors).toEqual([
      { key: "certification", code: "invalid" },
      { key: "flight_hours", code: "invalid" },
      { key: "last_check", code: "future_date" },
      { key: "repairs", code: "too_long" },
      { key: "weight_max", code: "weight_range" },
    ]);
    expect(validateAttributes("reserve", { reserve_type: "round", max_load: 20 }, "offer", now).errors)
      .toEqual([{ key: "max_load", code: "out_of_range" }]);
    expect(validateAttributes("harness", { harness_type: "pod", reserve_container: "yes" }, "offer", now).errors)
      .toEqual([{ key: "reserve_container", code: "invalid" }]);
  });

  it("the current month is not in the future", () => {
    expect(validateAttributes("reserve", { reserve_type: "round", max_load: 110, last_repack: "2026-09" }, "offer", now).ok).toBe(true);
  });
});

describe("translations", () => {
  const safetyCodes: SafetyHintCode[] = ["not_airworthy", "reserve_repack_unknown", "reserve_repack_overdue",
    "wing_check_missing", "wing_check_old", "expert_class", "check_before_flight"];
  const required: string[] = [
    ...LISTING_CATEGORIES.map((c) => `categories.${c}`),
    ...LISTING_TYPES.map((v) => `listingTypes.${v}`),
    ...LISTING_CONDITIONS.map((v) => `conditions.${v}`),
    ...PRICE_TYPES.map((v) => `priceTypes.${v}`),
    ...DELIVERY_OPTIONS.map((v) => `delivery.${v}`),
    ...LISTING_VISIBILITIES.map((v) => `visibility.${v}`),
    ...LISTING_STATUSES.map((v) => `status.${v}`),
    ...["manufacturer", "model", "size", "year"].map((f) => `fields.${f}`),
    ...["required", "invalid", "out_of_range", "future_date", "too_long", "weight_range"].map((e) => `errors.${e}`),
    ...safetyCodes.map((c) => `safety.${c}`),
    ...Object.values(CATEGORY_SPECS).flatMap((spec) => spec.attributes.flatMap((f) => [
      `attributes.${f.key}`, ...(f.kind === "select" ? f.options.map((o) => `options.${f.key}.${o}`) : []),
    ])),
  ];
  const lookup = (obj: unknown, path: string) =>
    path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);

  it.each([["de", de], ["en", en], ["fr", fr]])("%s has every marketplace text", (_lang, locale) => {
    const missing = required.filter((key) => typeof lookup((locale as { market?: unknown }).market, key) !== "string");
    expect(missing).toEqual([]);
  });
});
