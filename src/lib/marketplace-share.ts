/**
 * Marketplace (plan 8.4): public share link. The link points to the Edge Function get-shared-listing (previews
 * for WhatsApp & co.), which sends browsers on to /shared/market/<token>.
 */
import type { MarketplaceListing } from "./marketplace";

export const sharedListingUrl = (token: string, supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL) =>
  `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/get-shared-listing?token=${token}`;

/** Only listed listings for everyone can be opened by people without Flyary (the database checks it too). */
export const canSharePublicly = (l: Pick<MarketplaceListing, "status" | "expires_at" | "visibility">, now: Date = new Date()) =>
  (l.status === "active" || l.status === "reserved") && (l.expires_at === null || new Date(l.expires_at) > now) && l.visibility === "all";

export interface SharedListing extends Pick<MarketplaceListing,
  "id" | "title" | "description" | "listing_type" | "category" | "price_cents" | "price_type" | "condition" | "manufacturer"
  | "model" | "size" | "year" | "attributes" | "quantity" | "postal_code" | "locality" | "canton" | "delivery" | "status" | "bumped_at"> {
  is_school: boolean;
  school: {
    name: string; legal_name: string; street: string; postal_code: string; locality: string; uid_number: string | null;
    vat_registered: boolean; email: string; phone: string | null; warranty_text: string;
  } | null;
  photos: { url: string; thumb_url: string }[];
}

/** null when the listing is not (or no longer) public. */
export async function fetchSharedListing(token: string, supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL,
  fetchImpl: typeof fetch = fetch): Promise<SharedListing | null> {
  const res = await fetchImpl(sharedListingUrl(token, supabaseUrl), { headers: { Accept: "application/json" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as SharedListing;
}
