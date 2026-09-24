/**
 * Marketplace (plan 4.1): value sets of `marketplace_listings`.
 * They mirror the CHECK constraints in drizzle/migrations/0032_marketplace_listings.sql;
 * src/lib/marketplace.test.ts fails when the two drift apart.
 */

export const LISTING_TYPES = ["offer", "wanted"] as const;
export const LISTING_CATEGORIES = ["glider", "tandem", "harness", "reserve", "instrument", "helmet", "clothing", "other"] as const;
export const PRICE_TYPES = ["fixed", "negotiable", "free", "on_request"] as const;
export const LISTING_CONDITIONS = ["new", "like_new", "used", "for_parts"] as const;
export const DELIVERY_OPTIONS = ["pickup", "shipping", "both"] as const;
export const LISTING_VISIBILITIES = ["all", "school_students"] as const;
export const LISTING_STATUSES = ["draft", "active", "reserved", "sold", "expired", "removed"] as const;

export type ListingType = (typeof LISTING_TYPES)[number];
export type ListingCategory = (typeof LISTING_CATEGORIES)[number];
export type PriceType = (typeof PRICE_TYPES)[number];
export type ListingCondition = (typeof LISTING_CONDITIONS)[number];
export type DeliveryOption = (typeof DELIVERY_OPTIONS)[number];
export type ListingVisibility = (typeof LISTING_VISIBILITIES)[number];
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export interface MarketplaceListing {
  id: string;
  seller_user_id: string | null;
  seller_group_id: string | null;
  created_by: string | null;
  listing_type: ListingType;
  category: ListingCategory;
  title: string;
  description: string;
  price_cents: number | null;
  price_type: PriceType;
  condition: ListingCondition | null;
  manufacturer: string | null;
  model: string | null;
  size: string | null;
  year: number | null;
  attributes: Record<string, unknown>;
  quantity: number;
  postal_code: string | null;
  locality: string | null;
  canton: string | null;
  delivery: DeliveryOption;
  visibility: ListingVisibility;
  status: ListingStatus;
  removed_reason: string | null;
  published_at: string | null;
  expires_at: string | null;
  bumped_at: string | null;
  featured_until: string | null;
  /** Position of the postal code, rounded (plan 6.4). */
  lat?: number | null;
  lng?: number | null;
  created_at: string;
  updated_at: string;
}

/** Columns a client may change directly; everything else only through the marketplace RPCs. */
export const EDITABLE_LISTING_COLUMNS = [
  "listing_type", "category", "title", "description", "price_cents", "price_type", "condition", "manufacturer",
  "model", "size", "year", "attributes", "quantity", "postal_code", "locality", "canton", "delivery", "visibility",
] as const;

export const isSchoolListing = (l: Pick<MarketplaceListing, "seller_group_id">) => l.seller_group_id !== null;

/** Publicly listed right now (the same rule the RLS policy uses for other people). */
export function isListedNow(l: Pick<MarketplaceListing, "status" | "expires_at">, now: Date = new Date()): boolean {
  return (l.status === "active" || l.status === "reserved") && (l.expires_at === null || new Date(l.expires_at) > now);
}
