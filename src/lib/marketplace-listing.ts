/**
 * Marketplace (plan 4.4): rules around creating and running a listing – price input, place, the checks
 * before publishing, running time and bumping. The database enforces the same rules in the RPCs of
 * migration 0034; this module gives the form immediate feedback and the "Meine Anzeigen" page its labels.
 */
import { supabase } from "@/integrations/supabase/client";
import type { ListingStatus, MarketplaceListing } from "./marketplace";
import { CATEGORY_SPECS } from "./marketplace-categories";

export const LISTING_RUNTIME_DAYS = 60;
export const BUMP_INTERVAL_DAYS = 7;
export const MAX_ACTIVE_PRIVATE = 10;
export const MAX_ACTIVE_SCHOOL = 50;
export const MAX_PUBLISH_PER_DAY = 5;
/** "Läuft bald ab" from this many days before the end. */
export const EXPIRY_WARNING_DAYS = 7;

const DAY = 24 * 60 * 60 * 1000;

/** Swiss cantons plus Liechtenstein and "abroad" (stored as code in `canton`). */
export const CANTONS = [
  "AG", "AI", "AR", "BE", "BL", "BS", "FR", "GE", "GL", "GR", "JU", "LU", "NE", "NW", "OW", "SG", "SH", "SO", "SZ",
  "TG", "TI", "UR", "VD", "VS", "ZG", "ZH", "FL", "other",
] as const;

/** "1'800", "1800.50", "1 800,5", "CHF 90.–" → Rappen; null when empty or not a price. */
export function parsePriceInput(input: string): number | null {
  const cleaned = input.replace(/chf/i, "").replace(/[’'\s]/g, "").replace(/[.,]–$|[.,]-$/, "").replace(",", ".");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  return cents <= 10_000_000 ? cents : null;
}

/** Rappen → text for the input field ("1800" or "1800.50"). */
export const priceInputValue = (cents: number | null) =>
  cents === null ? "" : cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);

const chfWhole = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 });
const chfCents = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF", minimumFractionDigits: 2 });
/** "CHF 1’800" for whole francs, "CHF 90.50" otherwise. */
export const formatChf = (cents: number) => (cents % 100 === 0 ? chfWhole : chfCents).format(cents / 100);

export type PublishProblem =
  | "missing_title" | "missing_place" | "missing_price" | "missing_condition" | "missing_attributes" | "missing_photo";

type PublishInput = Pick<MarketplaceListing,
  "title" | "listing_type" | "category" | "price_type" | "price_cents" | "condition" | "postal_code" | "locality" | "attributes">;

/** What still keeps a draft from being published (same order as marketplace_publish). */
export function publishProblems(l: PublishInput, photoCount: number): PublishProblem[] {
  const problems: PublishProblem[] = [];
  if (l.title.trim().length < 3) problems.push("missing_title");
  if (!l.postal_code || !/^\d{4,5}$/.test(l.postal_code) || !l.locality?.trim()) problems.push("missing_place");
  if (l.listing_type === "wanted") return problems;
  if ((l.price_type === "fixed" || l.price_type === "negotiable") && !(l.price_cents && l.price_cents > 0)) problems.push("missing_price");
  if (!l.condition) problems.push("missing_condition");
  const required = CATEGORY_SPECS[l.category].attributes.filter((f) => f.required).map((f) => f.key);
  if (required.some((key) => l.attributes[key] === undefined || l.attributes[key] === null || l.attributes[key] === "")) {
    problems.push("missing_attributes");
  }
  if (photoCount === 0) problems.push("missing_photo");
  return problems;
}

/** Private listings and school occasions run 60 days; a school's new goods do not expire. */
export const listingExpires = (l: Pick<MarketplaceListing, "seller_group_id" | "condition">) =>
  !(l.seller_group_id !== null && l.condition === "new");

/** Whole days left until expiry (0 on the last day), null when it does not expire. */
export function daysLeft(expiresAt: string | null, now: Date = new Date()): number | null {
  if (!expiresAt) return null;
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - now.getTime()) / DAY));
}

/** The status a person sees: an active listing past its end counts as expired before the nightly job runs. */
export function effectiveStatus(l: Pick<MarketplaceListing, "status" | "expires_at">, now: Date = new Date()): ListingStatus {
  if ((l.status === "active" || l.status === "reserved") && l.expires_at && new Date(l.expires_at) <= now) return "expired";
  return l.status;
}

/** When bumping becomes possible again; null = now. */
export function nextBumpAt(bumpedAt: string | null, now: Date = new Date()): Date | null {
  if (!bumpedAt) return null;
  const next = new Date(new Date(bumpedAt).getTime() + BUMP_INTERVAL_DAYS * DAY);
  return next > now ? next : null;
}

export type MineTab = "live" | "drafts" | "ended";
export function mineTab(l: Pick<MarketplaceListing, "status" | "expires_at">, now: Date = new Date()): MineTab {
  const status = effectiveStatus(l, now);
  if (status === "draft") return "drafts";
  return status === "active" || status === "reserved" ? "live" : "ended";
}

export type ListingAction = "publish" | "edit" | "reserve" | "unreserve" | "sold" | "renew" | "bump" | "delete";
/** Actions offered on "Meine Anzeigen" for a listing in its current state (no "renew" for listings that do not expire). */
export function availableActions(l: Pick<MarketplaceListing, "status" | "expires_at">, now: Date = new Date()): ListingAction[] {
  const renew: ListingAction[] = l.expires_at === null ? [] : ["renew"];
  switch (effectiveStatus(l, now)) {
    case "draft": return ["publish", "edit", "delete"];
    case "active": return ["edit", "reserve", "sold", "bump", ...renew, "delete"];
    case "reserved": return ["edit", "unreserve", "sold", "bump", ...renew, "delete"];
    case "expired": return ["renew", "edit", "sold", "delete"];
    default: return ["delete"];
  }
}

export type MarketErrorCode =
  | PublishProblem | "not_found" | "not_allowed" | "own_listing" | "shop_not_ready" | "already_reported" | "reason_required" | "limit_saved_searches" | "equipment_other_school" | "buyer_not_member" | "buyer_not_in_chat" | "cannot_review" | "invalid_rating" | "school_only" | "banned" | "wrong_status" | "limit_active" | "limit_daily" | "bump_too_soon" | "unknown";
const KNOWN_CODES: readonly string[] = [
  "missing_title", "missing_place", "missing_price", "missing_condition", "missing_attributes", "missing_photo",
  "not_found", "not_allowed", "own_listing", "shop_not_ready", "already_reported", "reason_required", "limit_saved_searches", "equipment_other_school", "buyer_not_member", "buyer_not_in_chat", "cannot_review", "invalid_rating", "school_only", "banned", "wrong_status", "limit_active", "limit_daily", "bump_too_soon",
];
/** Code from an RPC error ("marketplace:<code>"), for `market.errors.<code>`. */
export function marketErrorCode(error: unknown): MarketErrorCode {
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : String(error ?? "");
  const code = /marketplace:([a-z_]+)/.exec(message)?.[1];
  return code && KNOWN_CODES.includes(code) ? (code as MarketErrorCode) : "unknown";
}

type StatusRpc = "marketplace_publish" | "marketplace_mark_sold" | "marketplace_renew" | "marketplace_bump";
/** Runs a status RPC; throws with the translated-code in `code`. */
export async function runListingAction(action: Exclude<ListingAction, "edit" | "delete">, listingId: string): Promise<void> {
  const rpc: StatusRpc | "marketplace_reserve" =
    action === "publish" ? "marketplace_publish" : action === "sold" ? "marketplace_mark_sold"
      : action === "renew" ? "marketplace_renew" : action === "bump" ? "marketplace_bump" : "marketplace_reserve";
  const args = rpc === "marketplace_reserve" ? { _listing: listingId, _reserved: action === "reserve" } : { _listing: listingId };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- function not in generated types.ts yet
  const { error } = await supabase.rpc(rpc as any, args);
  if (error) throw Object.assign(new Error(error.message), { code: marketErrorCode(error) });
}
