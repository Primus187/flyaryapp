import { describe, expect, it } from "vitest";
import { equipmentToListing, type EquipmentRow } from "./marketplace-equipment";

const base: EquipmentRow = { id: "e", group_id: "g", name: "Advance Alpha 7 – 26", equipment_type: "glider", size: "26",
  purchase_date: "2021-04-12", last_check_date: "2026-03-20" };

describe("equipmentToListing", () => {
  it("takes over a wing with its last check and purchase year", () => {
    expect(equipmentToListing(base)).toEqual({ category: "glider", title: "Advance Alpha 7 – 26", size: "26", year: "2021",
      condition: "used", attributes: { last_check: "2026-03" } });
  });
  it("maps radios and varios to instruments", () => {
    expect(equipmentToListing({ ...base, equipment_type: "radio", size: null })).toMatchObject({ category: "instrument", size: "", attributes: { instrument_type: "radio" } });
    expect(equipmentToListing({ ...base, equipment_type: "vario" }).attributes).toEqual({ instrument_type: "vario" });
  });
  it("falls back to other and leaves unknown values empty", () => {
    expect(equipmentToListing({ ...base, equipment_type: "windsock", purchase_date: null, last_check_date: null }))
      .toEqual({ category: "other", title: "Advance Alpha 7 – 26", size: "", year: "", condition: "used", attributes: {} });
  });
});

describe("translations of plan 7.1", async () => {
  const locales = {
    de: (await import("@/i18n/locales/de.json")).default,
    en: (await import("@/i18n/locales/en.json")).default,
    fr: (await import("@/i18n/locales/fr.json")).default,
  };
  const keys = ["market.equipment.sell", "market.equipment.inMarket", "market.equipment.prefilled", "market.errors.equipment_other_school"];
  const lookup = (obj: unknown, path: string) =>
    path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
  it.each(Object.entries(locales))("%s has every text", (_lang, locale) => {
    expect(keys.filter((k) => typeof lookup(locale, k) !== "string")).toEqual([]);
  });
});
