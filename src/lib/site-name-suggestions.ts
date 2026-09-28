/**
 * Suggestions for official names that only differ by a number ("Kronberg 1" … "Kronberg 4"): the
 * takeoff's main wind direction tells them apart ("Kronberg Süd"). Only a starting point for the
 * admin, who checks it (e.g. against the burnair map) before saving.
 */
const ANGLES: Record<string, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
const WORDS = ["Nord", "Nordost", "Ost", "Südost", "Süd", "Südwest", "West", "Nordwest"];

/** German main direction of a set of compass points, or null when they cancel out (e.g. N and S). */
export function mainDirection(directions: string[]): string | null {
  let x = 0, y = 0;
  for (const d of directions) {
    const a = ANGLES[d];
    if (a === undefined) continue;
    x += Math.sin((a * Math.PI) / 180);
    y += Math.cos((a * Math.PI) / 180);
  }
  if (Math.hypot(x, y) < 0.5) return null;
  const angle = ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
  // Exactly between two points (S + SW = 202.5°) always goes to the counter-clockwise one.
  return WORDS[Math.round(angle / 45 - 1e-6) % 8];
}

export interface NamedSite { id: string; name: string; type: string; wind_directions: string[] }

const NUMBERED = /^(.*\S)\s+(\d+)$/;

/** Names that end in a bare number, as the import writes them for several takeoffs of one area. */
export const isNumberedName = (name: string) => NUMBERED.test(name);

/** Suggested names for numbered takeoffs, keyed by site id; a number stays when two share a direction. */
export function suggestSiteNames(sites: NamedSite[]): Map<string, string> {
  const groups = new Map<string, { site: NamedSite; number: number }[]>();
  for (const site of sites) {
    const m = NUMBERED.exec(site.name);
    if (!m || site.type === "landing") continue;
    const key = `${site.type}|${m[1]}`;
    groups.set(key, [...(groups.get(key) || []), { site, number: Number(m[2]) }]);
  }
  const out = new Map<string, string>();
  for (const [key, members] of groups) {
    const base = key.split("|")[1];
    const named = members.map((m) => ({ ...m, direction: mainDirection(m.site.wind_directions) }));
    for (const m of named) {
      if (!m.direction) continue;
      const same = named.filter((o) => o.direction === m.direction);
      out.set(m.site.id, same.length > 1 ? `${base} ${m.direction} ${same.sort((a, b) => a.number - b.number).indexOf(m) + 1}` : `${base} ${m.direction}`);
    }
  }
  return out;
}
