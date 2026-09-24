/**
 * Marketplace (plan 4.2): category-specific fields of a listing, stored in `marketplace_listings.attributes`.
 * The common fields (manufacturer, model, size, year, condition) are real columns; this module describes
 * everything a category adds on top, and validates/cleans what a form sends before it is saved.
 * Labels: `market.attributes.<key>` and `market.options.<key>.<value>` in the locale files.
 */
import { LISTING_CATEGORIES, type ListingCategory, type ListingType } from "./marketplace";

/** Month or day, e.g. "2026-04" or "2026-04-17" – checks and repacks are usually known to the month. */
export type MonthDate = string;

interface BaseField { key: string; required?: boolean }
export interface NumberField extends BaseField { kind: "number"; min: number; max: number; unit?: "kg" | "h" | "s"; integer?: boolean }
export interface SelectField extends BaseField { kind: "select"; options: readonly string[] }
export interface DateField extends BaseField { kind: "month" }
export interface BooleanField extends BaseField { kind: "boolean" }
export interface TextField extends BaseField { kind: "text"; maxLength: number }
export type AttributeField = NumberField | SelectField | DateField | BooleanField | TextField;

export interface CategorySpec {
  category: ListingCategory;
  /** Shows the manufacturer/model/year inputs. */
  usesModel: boolean;
  /** Shows the size input. */
  usesSize: boolean;
  /** Worn or flown equipment: gets the general "have it checked before flying" hint. */
  flightGear: boolean;
  attributes: readonly AttributeField[];
}

export const CERTIFICATION_CLASSES = ["a", "b", "c", "d", "ccc", "none"] as const;
/** Classes that are not suitable for beginners (plan 4.2 hint). */
export const EXPERT_CLASSES: readonly string[] = ["c", "d", "ccc"];

const wingFields: readonly AttributeField[] = [
  { key: "certification", kind: "select", options: CERTIFICATION_CLASSES, required: true },
  { key: "weight_min", kind: "number", min: 30, max: 300, unit: "kg", integer: true },
  { key: "weight_max", kind: "number", min: 30, max: 300, unit: "kg", integer: true },
  { key: "flight_hours", kind: "number", min: 0, max: 5000, unit: "h", integer: true },
  { key: "last_check", kind: "month" },
  { key: "porosity", kind: "number", min: 0, max: 5000, unit: "s", integer: true },
  { key: "repairs", kind: "text", maxLength: 300 },
];

export const CATEGORY_SPECS: Readonly<Record<ListingCategory, CategorySpec>> = {
  glider: { category: "glider", usesModel: true, usesSize: true, flightGear: true, attributes: wingFields },
  tandem: { category: "tandem", usesModel: true, usesSize: true, flightGear: true, attributes: wingFields },
  harness: {
    category: "harness", usesModel: true, usesSize: true, flightGear: true, attributes: [
      { key: "harness_type", kind: "select", options: ["seat", "pod", "reversible", "tandem"], required: true },
      { key: "protector", kind: "select", options: ["airbag", "foam", "hybrid", "none"] },
      { key: "reserve_container", kind: "boolean" },
    ],
  },
  reserve: {
    category: "reserve", usesModel: true, usesSize: false, flightGear: true, attributes: [
      { key: "reserve_type", kind: "select", options: ["round", "rogallo", "cross", "other"], required: true },
      { key: "max_load", kind: "number", min: 50, max: 300, unit: "kg", integer: true, required: true },
      { key: "last_repack", kind: "month" },
    ],
  },
  instrument: {
    category: "instrument", usesModel: true, usesSize: false, flightGear: false, attributes: [
      { key: "instrument_type", kind: "select", options: ["vario", "gps", "radio", "combo", "other"], required: true },
    ],
  },
  helmet: {
    category: "helmet", usesModel: true, usesSize: true, flightGear: true, attributes: [
      { key: "norm", kind: "select", options: ["en966", "en1077", "other"] },
    ],
  },
  clothing: { category: "clothing", usesModel: false, usesSize: true, flightGear: false, attributes: [] },
  other: { category: "other", usesModel: false, usesSize: false, flightGear: false, attributes: [] },
};

export const categorySpec = (category: ListingCategory): CategorySpec => CATEGORY_SPECS[category];
export const isListingCategory = (value: string): value is ListingCategory =>
  (LISTING_CATEGORIES as readonly string[]).includes(value);

export type AttributeErrorCode = "required" | "invalid" | "out_of_range" | "future_date" | "too_long" | "weight_range";
export interface AttributeError { key: string; code: AttributeErrorCode }
export interface AttributeValidation {
  ok: boolean;
  errors: AttributeError[];
  /** Only the known keys with valid values; empty inputs are dropped. Save this, not the raw input. */
  cleaned: Record<string, unknown>;
}

const MONTH_DATE = /^(\d{4})-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/;

/** First day of the given month/day as a UTC date, or null when the value is not a valid MonthDate. */
export function parseMonthDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const m = MONTH_DATE.exec(value);
  if (!m) return null;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, m[3] ? Number(m[3]) : 1));
  return m[3] && date.getUTCDate() !== Number(m[3]) ? null : date; // rejects 2026-02-30
}

const isEmpty = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/**
 * Validates the category attributes of a listing. Unknown keys are dropped. Required fields apply to
 * offers only: a "wanted" listing may leave everything open.
 */
export function validateAttributes(
  category: ListingCategory,
  input: Record<string, unknown>,
  listingType: ListingType = "offer",
  now: Date = new Date(),
): AttributeValidation {
  const errors: AttributeError[] = [];
  const cleaned: Record<string, unknown> = {};

  for (const field of CATEGORY_SPECS[category].attributes) {
    const raw = input[field.key];
    if (isEmpty(raw)) {
      if (field.required && listingType === "offer") errors.push({ key: field.key, code: "required" });
      continue;
    }
    switch (field.kind) {
      case "number": {
        const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.replace(",", ".")) : NaN;
        if (!Number.isFinite(n) || (field.integer && !Number.isInteger(n))) errors.push({ key: field.key, code: "invalid" });
        else if (n < field.min || n > field.max) errors.push({ key: field.key, code: "out_of_range" });
        else cleaned[field.key] = n;
        break;
      }
      case "select":
        if (typeof raw === "string" && field.options.includes(raw)) cleaned[field.key] = raw;
        else errors.push({ key: field.key, code: "invalid" });
        break;
      case "month": {
        const date = parseMonthDate(raw);
        if (!date) errors.push({ key: field.key, code: "invalid" });
        else if (date > now) errors.push({ key: field.key, code: "future_date" });
        else cleaned[field.key] = raw;
        break;
      }
      case "boolean":
        if (typeof raw === "boolean") cleaned[field.key] = raw;
        else errors.push({ key: field.key, code: "invalid" });
        break;
      case "text": {
        const text = String(raw).trim();
        if (text.length > field.maxLength) errors.push({ key: field.key, code: "too_long" });
        else cleaned[field.key] = text;
        break;
      }
    }
  }

  const min = cleaned.weight_min, max = cleaned.weight_max;
  if (typeof min === "number" && typeof max === "number" && min > max) errors.push({ key: "weight_max", code: "weight_range" });

  return { ok: errors.length === 0, errors, cleaned };
}
