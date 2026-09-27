/**
 * Reads the DHV site database export (format "DHV XML", one file per country) into the rows of
 * public.official_sites. Pure and import-free so scripts/import-official-sites.mjs can use it.
 * A landing shared by several flying areas appears once per area in the file; it is kept once.
 */
export interface DhvSiteRow {
  source_id: string;
  area_name: string | null;
  name_de: string;
  type: "takeoff" | "landing" | "both";
  latitude: number;
  longitude: number;
  altitude: number | null;
  country_code: string;
  region: string | null;
  municipality: string | null;
  wind_directions: string[];
  paragliding: boolean;
  hanggliding: boolean;
  source_url: string | null;
}

const text = (block: string, tag: string): string | null => {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (!m) return null;
  const value = m[1].replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1").trim();
  return value === "" ? null : value;
};

// 16-point compass as the DHV writes it (German: O = east).
const POINTS16 = ["N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const TO_APP: Record<string, string> = { N: "N", NO: "NE", O: "E", SO: "SE", S: "S", SW: "SW", W: "W", NW: "NW" };

/** "SW-W", "NO-S", "S, NO", "W-WNW" → app compass points (N, NE, … NW), ranges clockwise. */
export function parseDhvDirections(value: string | null): string[] {
  if (!value) return [];
  const out = new Set<string>();
  for (const part of value.split(",").map((p) => p.trim().toUpperCase()).filter(Boolean)) {
    const [from, to = from] = part.split("-").map((p) => p.trim());
    const a = POINTS16.indexOf(from), b = POINTS16.indexOf(to);
    if (a < 0 || b < 0) continue;
    const span: string[] = [];
    for (let i = a; ; i = (i + 1) % 16) { span.push(POINTS16[i]); if (i === b) break; }
    const main = span.filter((p) => TO_APP[p]);
    // A range between two in-between points (e.g. "WNW") still points somewhere: use its neighbours.
    if (main.length === 0) for (const p of span) { const i = POINTS16.indexOf(p); main.push(POINTS16[(i + 15) % 16], POINTS16[(i + 1) % 16]); }
    main.forEach((p) => TO_APP[p] && out.add(TO_APP[p]));
  }
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"].filter((p) => out.has(p));
}

export function parseDhvXml(xml: string, normalizeName: (name: string) => string = (n) => n): DhvSiteRow[] {
  const rows = new Map<string, DhvSiteRow>();
  for (const [, site] of xml.matchAll(/<FlyingSite>([\s\S]*?)<\/FlyingSite>/g)) {
    const areaName = text(site, "SiteName");
    const siteUrl = text(site, "SiteUrl");
    for (const [, loc] of site.matchAll(/<Location>([\s\S]*?)<\/Location>/g)) {
      const id = text(loc, "LocationID");
      const rawName = text(loc, "LocationName");
      const [lng, lat] = (text(loc, "Coordinates") || "").split(",").map(Number);
      if (!id || !rawName || !Number.isFinite(lat) || !Number.isFinite(lng) || rows.has(id)) continue;
      const name = normalizeName(rawName);
      const kind = text(loc, "LocationType");
      const altitude = Number.parseInt(text(loc, "Altitude") || "", 10);
      rows.set(id, {
        source_id: id,
        area_name: areaName,
        name_de: name,
        type: /Start-\/Landeplatz/.test(name) ? "both" : kind === "1" ? "takeoff" : kind === "2" ? "landing" : "both",
        latitude: lat,
        longitude: lng,
        altitude: Number.isFinite(altitude) ? altitude : null,
        country_code: (text(loc, "LocationCountry") || "").toUpperCase(),
        region: text(loc, "Region"),
        municipality: text(loc, "Municipality"),
        wind_directions: parseDhvDirections(text(loc, "DirectionsText")),
        paragliding: text(loc, "Paragliding") === "true",
        hanggliding: text(loc, "Hanggliding") === "true",
        source_url: siteUrl,
      });
    }
  }
  return [...rows.values()];
}
