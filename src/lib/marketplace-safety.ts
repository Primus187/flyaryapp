/**
 * Marketplace (plan 4.2): safety hints for buyers. Information only – nothing is ever blocked.
 * Texts: `market.safety.<code>` in the locale files (with {{months}} where given).
 */
import type { ListingCategory, ListingCondition, ListingType } from "./marketplace";
import { CATEGORY_SPECS, EXPERT_CLASSES, parseMonthDate } from "./marketplace-categories";

export type SafetyHintCode =
  | "not_airworthy"
  | "reserve_repack_unknown"
  | "reserve_repack_overdue"
  | "wing_check_missing"
  | "wing_check_old"
  | "expert_class"
  | "check_before_flight";

export interface SafetyHint {
  code: SafetyHintCode;
  severity: "warning" | "info";
  /** Age in whole months for the overdue/old hints. */
  months?: number;
}

/** A reserve should be repacked at least every 6 months (common manufacturer recommendation). */
export const RESERVE_REPACK_MONTHS = 6;
/** A wing without a check for more than 2 years is flagged. */
export const WING_CHECK_MONTHS = 24;

/** Whole months from `from` to `to` (the day of month counts: 17 Jan → 16 Feb is 0). */
export function monthsBetween(from: Date, to: Date): number {
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

export interface SafetyInput {
  category: ListingCategory;
  condition: ListingCondition | null;
  listing_type: ListingType;
  attributes: Record<string, unknown>;
}

export function safetyHints(listing: SafetyInput, now: Date = new Date()): SafetyHint[] {
  if (listing.listing_type === "wanted") return [];
  if (listing.condition === "for_parts") return [{ code: "not_airworthy", severity: "warning" }];

  const hints: SafetyHint[] = [];
  const isNew = listing.condition === "new";
  const { attributes: a, category } = listing;

  if (category === "reserve") {
    const repack = parseMonthDate(a.last_repack);
    if (!repack) {
      if (!isNew) hints.push({ code: "reserve_repack_unknown", severity: "warning" });
    } else {
      const months = monthsBetween(repack, now);
      if (months > RESERVE_REPACK_MONTHS) hints.push({ code: "reserve_repack_overdue", severity: "warning", months });
    }
  }

  if (category === "glider" || category === "tandem") {
    const check = parseMonthDate(a.last_check);
    if (!check) {
      if (!isNew) hints.push({ code: "wing_check_missing", severity: "warning" });
    } else {
      const months = monthsBetween(check, now);
      if (months > WING_CHECK_MONTHS) hints.push({ code: "wing_check_old", severity: "warning", months });
    }
    if (typeof a.certification === "string" && EXPERT_CLASSES.includes(a.certification)) {
      hints.push({ code: "expert_class", severity: "info" });
    }
  }

  if (CATEGORY_SPECS[category].flightGear) hints.push({ code: "check_before_flight", severity: "info" });
  return hints;
}
