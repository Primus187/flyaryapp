import type { TFunction } from "i18next";
import type { MarketplaceListing } from "@/lib/marketplace";
import { CATEGORY_SPECS, parseMonthDate, type AttributeField } from "@/lib/marketplace-categories";

type DetailSource = Pick<MarketplaceListing, "category" | "condition" | "manufacturer" | "model" | "year" | "size" | "attributes">;

/** Label/value rows of a listing's details (category, condition, model, size, category attributes). Used by the
 *  detail page and the public share page (plan 8.4). */
export function listingDetailRows(listing: DetailSource, t: TFunction, locale: string): [string, string][] {
  const spec = CATEGORY_SPECS[listing.category];
  const monthFormat = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
  const attributeText = (field: AttributeField, value: unknown): string | null => {
    if (value === undefined || value === null || value === "") return null;
    switch (field.kind) {
      case "select": return t(`market.options.${field.key}.${value}`);
      case "boolean": return value ? t("common.yes") : t("common.no");
      case "month": { const d = parseMonthDate(value); return d ? monthFormat.format(d) : String(value); }
      case "number": {
        const text = field.unit ? `${value} ${field.unit}` : String(value);
        return field.key === "flight_hours" && listing.attributes.hours_from_logbook === true ? `${text} (${t("market.detail.fromLogbook")})` : text;
      }
      default: return String(value);
    }
  };
  return [
    [t("market.form.category"), t(`market.categories.${listing.category}`)],
    ...(listing.condition ? [[t("market.form.condition"), t(`market.conditions.${listing.condition}`)] as [string, string]] : []),
    ...(spec.usesModel ? ([
      [t("market.fields.manufacturer"), listing.manufacturer], [t("market.fields.model"), listing.model],
      [t("market.fields.year"), listing.year ? String(listing.year) : null],
    ] as [string, string | null][]) : []).filter((d): d is [string, string] => !!d[1]),
    ...(listing.size ? [[t("market.fields.size"), listing.size] as [string, string]] : []),
    ...spec.attributes
      .filter((f) => !(f.kind === "boolean" && f.hidden))
      .map((f) => [t(`market.attributes.${f.key}`), attributeText(f, listing.attributes[f.key])] as [string, string | null])
      .filter((d): d is [string, string] => !!d[1]),
  ];
}
