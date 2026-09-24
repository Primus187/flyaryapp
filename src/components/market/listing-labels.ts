import type { TFunction } from "i18next";
import type { MarketplaceListing } from "@/lib/marketplace";
import { formatChf } from "@/lib/marketplace-listing";

/** "CHF 1’800", "CHF 1’800 · Verhandelbar", "Gratis", "Preis auf Anfrage". */
export function listingPriceLabel(l: Pick<MarketplaceListing, "price_type" | "price_cents" | "listing_type">, t: TFunction): string {
  if (l.price_type === "free") return t("market.priceTypes.free");
  if (l.price_type === "on_request" || l.price_cents === null) {
    return l.listing_type === "wanted" && l.price_cents === null ? "" : t("market.priceTypes.on_request");
  }
  const price = formatChf(l.price_cents);
  return l.price_type === "negotiable" ? `${price} · ${t("market.priceTypes.negotiable")}` : price;
}
