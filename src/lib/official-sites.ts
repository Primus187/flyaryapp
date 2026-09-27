/** Official takeoff/landing sites (public.official_sites): lookup by position. */
export interface OfficialSite {
  id: string;
  name_de: string;
  name_fr: string;
  name_en: string;
  area_name: string | null;
  type: "takeoff" | "landing" | "both";
  latitude: number;
  longitude: number;
  altitude: number | null;
  country_code: string;
  region: string | null;
  wind_directions: string[];
}

/** Takeoff/landing distance at which a place counts as "the same site". */
export const SAME_SITE_METERS = 300;
/** How far from the first/last track point an official site is still suggested. */
export const TRACK_SITE_METERS = 500;

export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const fitsType = (siteType: string, wanted: "takeoff" | "landing" | "both") =>
  wanted === "both" || siteType === "both" || siteType === wanted;

export function nearestSite<T extends { latitude: number; longitude: number; type: string }>(
  sites: T[], lat: number, lng: number, wanted: "takeoff" | "landing" | "both", maxMeters: number,
): { site: T; meters: number } | null {
  let best: { site: T; meters: number } | null = null;
  for (const site of sites) {
    if (!fitsType(site.type, wanted) || (site.latitude === 0 && site.longitude === 0)) continue;
    const meters = distanceMeters(lat, lng, site.latitude, site.longitude);
    if (meters <= maxMeters && (!best || meters < best.meters)) best = { site, meters };
  }
  return best;
}

export interface OwnLocation { id: string; name: string; type: string; latitude: number; longitude: number; official_site_id?: string | null }

/** Own, not yet linked places that lie on an official site of a fitting type (nearest first per place). */
export function suggestSiteLinks(own: OwnLocation[], sites: OfficialSite[], maxMeters = SAME_SITE_METERS) {
  const out: { location: OwnLocation; site: OfficialSite; meters: number }[] = [];
  for (const location of own) {
    if (location.official_site_id || (location.latitude === 0 && location.longitude === 0)) continue;
    const wanted = location.type === "takeoff" || location.type === "landing" ? location.type : "both";
    const hit = nearestSite(sites, location.latitude, location.longitude, wanted, maxMeters);
    if (hit) out.push({ location, site: hit.site, meters: Math.round(hit.meters) });
  }
  return out.sort((a, b) => a.location.name.localeCompare(b.location.name));
}

const searchWords = (s: string) => s.toLocaleLowerCase("de-CH").normalize("NFD").replace(/\p{M}/gu, "").split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Search in the catalogue: every typed word must start a word of the name (any language) or region. */
export function searchSites(sites: OfficialSite[], query: string, wanted: "takeoff" | "landing" | "both", limit = 30) {
  const words = searchWords(query);
  if (words.length === 0) return [];
  return sites
    .filter((s) => fitsType(s.type, wanted))
    .filter((s) => {
      const hay = searchWords(`${s.name_de} ${s.name_fr} ${s.name_en} ${s.region || ""}`);
      return words.every((w) => hay.some((h) => h.startsWith(w)));
    })
    .sort((a, b) => a.name_de.localeCompare(b.name_de, "de", { numeric: true }))
    .slice(0, limit);
}
