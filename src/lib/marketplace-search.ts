/**
 * Marketplace (plan 4.5): filters of the overview, kept in the URL (so "back" from a listing restores them),
 * and the call of the `marketplace_search` RPC (migration 0035).
 */
import { supabase } from "@/integrations/supabase/client";
import {
  LISTING_CATEGORIES, LISTING_CONDITIONS, type ListingCategory, type ListingCondition, type ListingStatus, type ListingType,
  type PriceType,
} from "./marketplace";
import { CERTIFICATION_CLASSES } from "./marketplace-categories";
import { CANTONS, parsePriceInput } from "./marketplace-listing";
import type { LatLng } from "./geo-ch";

export const SORT_ORDERS = ["newest", "price_asc", "price_desc"] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];
export const PAGE_SIZE = 24;
/** Radius choices around a postal code (plan 6.4); 50 km is the default. */
export const RADIUS_OPTIONS = [10, 25, 50, 100] as const;
const DEFAULT_RADIUS = 50;

export interface SearchFilters {
  q: string;
  type: ListingType | "";
  categories: ListingCategory[];
  conditions: ListingCondition[];
  certifications: string[];
  cantons: string[];
  /** CHF as typed ("500", "1'200"). */
  priceMin: string;
  priceMax: string;
  size: string;
  schoolsOnly: boolean;
  sort: SortOrder;
  /** Radius search around a Swiss postal code (plan 6.4). */
  nearPlz: string;
  radiusKm: number;
  /** Take-off weight in kg as typed (plan 6.4). */
  weightKg: string;
}

export const EMPTY_FILTERS: SearchFilters = {
  q: "", type: "", categories: [], conditions: [], certifications: [], cantons: [], priceMin: "", priceMax: "", size: "",
  schoolsOnly: false, sort: "newest", nearPlz: "", radiusKm: DEFAULT_RADIUS, weightKg: "",
};

/** Take-off weight as a number, or null when empty or not plausible. */
export function parseWeight(input: string): number | null {
  const n = Number.parseInt(input.trim(), 10);
  return Number.isInteger(n) && n >= 30 && n <= 300 ? n : null;
}

/** The class filter only makes sense when wings can be in the result. */
export const showsCertificationFilter = (categories: readonly ListingCategory[]) =>
  categories.length === 0 || categories.some((c) => c === "glider" || c === "tandem");

/** Number of filters set in the filter sheet (search text and categories are visible anyway). */
export function activeFilterCount(f: SearchFilters): number {
  return [f.type !== "", f.conditions.length > 0, showsCertificationFilter(f.categories) && f.certifications.length > 0,
    f.cantons.length > 0, f.priceMin.trim() !== "" || f.priceMax.trim() !== "", f.size.trim() !== "", f.schoolsOnly,
    f.sort !== "newest", f.nearPlz.trim() !== "", parseWeight(f.weightKg) !== null].filter(Boolean).length;
}

/** Filters as the RPC expects them; empty values are left out. The radius needs the postal code's position. */
export function toRpcFilters(f: SearchFilters, near: LatLng | null = null): Record<string, unknown> {
  const out: Record<string, unknown> = { sort: f.sort };
  if (f.q.trim()) out.q = f.q.trim();
  if (f.type) out.type = f.type;
  if (f.categories.length) out.categories = f.categories;
  if (f.conditions.length) out.conditions = f.conditions;
  if (f.certifications.length && showsCertificationFilter(f.categories)) out.certifications = f.certifications;
  if (f.cantons.length) out.cantons = f.cantons;
  const min = parsePriceInput(f.priceMin), max = parsePriceInput(f.priceMax);
  if (min !== null) out.price_min = min;
  if (max !== null) out.price_max = max;
  if (f.size.trim()) out.size = f.size.trim();
  if (f.schoolsOnly) out.schools_only = true;
  if (near && f.nearPlz.trim()) out.near = { lat: near.lat, lng: near.lng, radius_km: f.radiusKm };
  const weight = parseWeight(f.weightKg);
  if (weight !== null) out.weight = weight;
  return out;
}

const list = <T extends string>(value: string | null, allowed: readonly T[]): T[] =>
  (value ?? "").split(",").filter((v): v is T => (allowed as readonly string[]).includes(v));

export function filtersFromParams(p: URLSearchParams): SearchFilters {
  const type = p.get("type");
  const sort = p.get("sort");
  return {
    q: p.get("q") ?? "",
    type: type === "offer" || type === "wanted" ? type : "",
    categories: list(p.get("cat"), LISTING_CATEGORIES),
    conditions: list(p.get("cond"), LISTING_CONDITIONS),
    certifications: list(p.get("class"), CERTIFICATION_CLASSES),
    cantons: list(p.get("canton"), CANTONS),
    priceMin: p.get("min") ?? "",
    priceMax: p.get("max") ?? "",
    size: p.get("size") ?? "",
    schoolsOnly: p.get("schools") === "1",
    sort: (SORT_ORDERS as readonly string[]).includes(sort ?? "") ? (sort as SortOrder) : "newest",
    nearPlz: /^\d{4}$/.test(p.get("near") ?? "") ? p.get("near")! : "",
    radiusKm: (RADIUS_OPTIONS as readonly number[]).includes(Number(p.get("radius"))) ? Number(p.get("radius")) : DEFAULT_RADIUS,
    weightKg: parseWeight(p.get("weight") ?? "") !== null ? String(parseWeight(p.get("weight")!)) : "",
  };
}

export function filtersToParams(f: SearchFilters): URLSearchParams {
  const p = new URLSearchParams();
  const put = (key: string, value: string) => { if (value) p.set(key, value); };
  put("q", f.q.trim());
  put("type", f.type);
  put("cat", f.categories.join(","));
  put("cond", f.conditions.join(","));
  put("class", f.certifications.join(","));
  put("canton", f.cantons.join(","));
  put("min", f.priceMin.trim());
  put("max", f.priceMax.trim());
  put("size", f.size.trim());
  if (f.schoolsOnly) p.set("schools", "1");
  if (f.sort !== "newest") p.set("sort", f.sort);
  if (f.nearPlz.trim()) {
    p.set("near", f.nearPlz.trim());
    if (f.radiusKm !== DEFAULT_RADIUS) p.set("radius", String(f.radiusKm));
  }
  const weight = parseWeight(f.weightKg);
  if (weight !== null) p.set("weight", String(weight));
  return p;
}

export const toggle = <T>(values: readonly T[], value: T): T[] =>
  values.includes(value) ? values.filter((v) => v !== value) : [...values, value];

export interface SearchItem {
  id: string;
  title: string;
  category: ListingCategory;
  listing_type: ListingType;
  price_cents: number | null;
  price_type: PriceType;
  condition: ListingCondition | null;
  size: string | null;
  locality: string | null;
  canton: string | null;
  status: ListingStatus;
  is_school: boolean;
  /** The viewer sells it (no heart; plan 6.1). */
  mine?: boolean;
  bumped_at: string;
  thumb_path: string | null;
}
export interface SearchPage { items: SearchItem[]; next_cursor: Record<string, unknown> | null }

export async function searchListings(f: SearchFilters, cursor: SearchPage["next_cursor"] = null, near: LatLng | null = null): Promise<SearchPage> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- function not in generated types.ts yet
  const { data, error } = await supabase.rpc("marketplace_search" as any, { _filters: toRpcFilters(f, near), _cursor: cursor, _limit: PAGE_SIZE });
  if (error) throw error;
  return data as unknown as SearchPage;
}

/** "vor 3 Tagen", "vor 2 Stunden", "gerade eben" style label via Intl.RelativeTimeFormat. */
export function ageLabel(since: string, locale: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(since).getTime()) / 60000));
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (days < 30) return rtf.format(-days, "day");
  return rtf.format(-Math.round(days / 30), "month");
}
