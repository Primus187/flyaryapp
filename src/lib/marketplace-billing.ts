/**
 * Marketplace (plan 7.2): sell a school listing to a member and put it on their bill (migration 0046).
 * Prices are Rappen in the marketplace and CHF in the billing – the database converts.
 */
import { supabase } from "@/integrations/supabase/client";

export interface SaleCandidate { user_id: string; pilot_name: string }

export async function fetchSaleCandidates(listingId: string): Promise<SaleCandidate[]> {
  const { data, error } = await supabase.rpc("marketplace_sale_candidates", { _listing: listingId });
  if (error) throw error;
  return (data ?? []) as unknown as SaleCandidate[];
}

/** Returns the id of the new billing item; the listing is marked sold (or one piece less). */
export async function sellToMember(listingId: string, buyerId: string, priceCents: number | null): Promise<string> {
  const { data, error } = await supabase.rpc("marketplace_sell_to_member", { _listing: listingId, _buyer: buyerId, _price_cents: priceCents });
  if (error) throw error;
  return data as unknown as string;
}

/** Case-insensitive name filter for the member picker. */
export const filterCandidates = (list: readonly SaleCandidate[], query: string) => {
  const q = query.trim().toLowerCase();
  return q ? list.filter((c) => c.pilot_name.toLowerCase().includes(q)) : [...list];
};
