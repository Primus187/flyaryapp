/**
 * Marketplace (plan 6.4): position of a Swiss postal code from the public geo.admin.ch search service
 * (no key needed). Rounded to 2 decimals (about 1 km) – enough for a radius search, never an address.
 */
export interface LatLng { lat: number; lng: number }

const cache = new Map<string, LatLng | null>();

export const roundCoord = (value: number) => Math.round(value * 100) / 100;

/** Picks the result for exactly this postal code from a SearchServer response. */
export function pickPostalCode(json: unknown, plz: string): LatLng | null {
  const results = (json as { results?: { attrs?: { origin?: string; detail?: string; lat?: number; lon?: number } }[] })?.results ?? [];
  const hit = results.find((r) => r.attrs?.origin === "zipcode" && r.attrs.detail === plz && typeof r.attrs.lat === "number" && typeof r.attrs.lon === "number");
  return hit ? { lat: roundCoord(hit.attrs!.lat!), lng: roundCoord(hit.attrs!.lon!) } : null;
}

/** Position of a 4-digit Swiss postal code, or null (unknown, foreign or service unreachable). */
export async function geocodeSwissPostalCode(plz: string, fetchImpl: typeof fetch = fetch): Promise<LatLng | null> {
  const code = plz.trim();
  if (!/^\d{4}$/.test(code)) return null;
  if (cache.has(code)) return cache.get(code)!;
  try {
    const url = `https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText=${code}&type=locations&origins=zipcode&limit=5`;
    const res = await fetchImpl(url);
    if (!res.ok) return null;
    const position = pickPostalCode(await res.json(), code);
    cache.set(code, position);
    return position;
  } catch {
    return null;
  }
}

export type WeightFit = "fits" | "outside" | null;
/** Whether a take-off weight lies in a wing's range; null when the range or the weight is unknown. */
export function weightFit(attributes: Record<string, unknown>, weightKg: number | null): WeightFit {
  const min = attributes.weight_min, max = attributes.weight_max;
  if (weightKg === null || typeof min !== "number" || typeof max !== "number") return null;
  return weightKg >= min && weightKg <= max ? "fits" : "outside";
}

const WEIGHT_KEY = "flyary.market.weight";
/** The take-off weight last used in the filter, remembered in this browser only. */
export function rememberedWeight(): number | null {
  try {
    const v = Number(window.localStorage.getItem(WEIGHT_KEY));
    return Number.isFinite(v) && v >= 30 && v <= 300 ? v : null;
  } catch { return null; }
}
export function rememberWeight(weightKg: number | null) {
  try {
    if (weightKg === null) window.localStorage.removeItem(WEIGHT_KEY);
    else window.localStorage.setItem(WEIGHT_KEY, String(weightKg));
  } catch { /* optional convenience */ }
}
