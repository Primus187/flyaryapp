/**
 * Marketplace (plan 6.2): saved searches (migration 0043). The database stores the filters in the format of
 * marketplace_search (for matching new listings) and the URL query (to open the search again).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { EMPTY_FILTERS, filtersFromParams, filtersToParams, toRpcFilters, type SearchFilters } from "./marketplace-search";
import { geocodeSwissPostalCode, type LatLng } from "./geo-ch";

export const MAX_SAVED_SEARCHES = 5;

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  notify: boolean;
  new_count: number;
  created_at: string;
}

/** Worth saving: anything narrower than "everything" (sorting alone does not count). */
export const hasSearchCriteria = (f: SearchFilters) =>
  filtersToParams({ ...f, sort: EMPTY_FILTERS.sort }).toString() !== "";

/** Filters as stored for matching: like the search, without the sort order. */
export function savedFilters(f: SearchFilters, near: LatLng | null = null): Record<string, unknown> {
  const rest = { ...toRpcFilters(f, near) };
  delete rest.sort;
  return rest;
}

/** Suggested name: search text, else the chosen categories' labels, else a generic label. */
export function suggestName(f: SearchFilters, categoryLabel: (c: string) => string, fallback: string): string {
  const name = f.q.trim() || f.categories.map(categoryLabel).join(", ") || fallback;
  return name.slice(0, 60);
}

const table = () => supabase.from("marketplace_saved_searches");

export async function saveSearch(userId: string, name: string, f: SearchFilters): Promise<string> {
  const near = f.nearPlz ? await geocodeSwissPostalCode(f.nearPlz) : null;
  const { data, error } = await table()
    .insert({ user_id: userId, name: name.trim().slice(0, 60), filters: savedFilters(f, near) as Json, query: filtersToParams(f).toString() })
    .select("id").single();
  if (error) throw error;
  return (data as unknown as { id: string }).id;
}

export async function fetchSavedSearches(): Promise<SavedSearch[]> {
  const { data, error } = await supabase.rpc("marketplace_saved_searches_overview");
  if (error) throw error;
  return (data ?? []) as unknown as SavedSearch[];
}

export async function markViewed(id: string): Promise<void> {
  await table().update({ last_viewed_at: new Date().toISOString() }).eq("id", id);
}

export async function setNotify(id: string, notify: boolean): Promise<void> {
  const { error } = await table().update({ notify }).eq("id", id);
  if (error) throw error;
}

export async function deleteSavedSearch(id: string): Promise<void> {
  const { error } = await table().delete().eq("id", id);
  if (error) throw error;
}

/** The filters a saved search opens with. */
export const savedSearchFilters = (s: Pick<SavedSearch, "query">): SearchFilters => filtersFromParams(new URLSearchParams(s.query));
