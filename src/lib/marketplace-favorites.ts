/**
 * Marketplace (plan 6.1): favourites ("Merkliste", migration 0042). Changes that matter (cheaper, reserved,
 * sold) are announced by the database; the app only keeps the list.
 */
import { supabase } from "@/integrations/supabase/client";
import type { ListingCategory, ListingStatus, ListingType, PriceType } from "./marketplace";

export interface FavoriteItem {
  id: string;
  title: string;
  category: ListingCategory;
  listing_type: ListingType;
  price_cents: number | null;
  price_type: PriceType;
  locality: string | null;
  is_school: boolean;
  status: ListingStatus;
  /** Still open in the market for this person. */
  available: boolean;
  thumb_path: string | null;
  saved_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet
const favorites = () => supabase.from("marketplace_favorites" as any);

export async function fetchFavoriteIds(): Promise<Set<string>> {
  const { data } = await favorites().select("listing_id");
  return new Set(((data ?? []) as unknown as { listing_id: string }[]).map((f) => f.listing_id));
}

export async function setFavorite(userId: string, listingId: string, on: boolean): Promise<void> {
  const { error } = on
    ? await favorites().insert({ user_id: userId, listing_id: listingId })
    : await favorites().delete().eq("user_id", userId).eq("listing_id", listingId);
  // a double tap may insert twice: already kept counts as success
  if (error && !(on && error.code === "23505")) throw error;
}

/** Available ones first (newest saved first), then the ones that are gone. */
export function sortFavorites(items: readonly FavoriteItem[]): FavoriteItem[] {
  return [...items].sort((a, b) => Number(b.available) - Number(a.available) || b.saved_at.localeCompare(a.saved_at));
}

export async function fetchMyFavorites(): Promise<FavoriteItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- function not in generated types.ts yet
  const { data, error } = await supabase.rpc("marketplace_my_favorites" as any);
  if (error) throw error;
  return sortFavorites((data ?? []) as unknown as FavoriteItem[]);
}

/** Updates a set of ids without mutating it (for optimistic heart toggles). */
export function toggledSet(ids: ReadonlySet<string>, id: string, on: boolean): Set<string> {
  const next = new Set(ids);
  if (on) next.add(id); else next.delete(id);
  return next;
}
