/**
 * Official Flyary names for the sites of the DHV catalogue. The DHV names every place
 * "<area> Startplatz|Landeplatz [n] [extra]". The type is kept as its own field, so the name drops
 * the site word: takeoffs are named after their area ("Kronberg 2"), landings after their
 * municipality ("Jakobsbad"), as pilots call them. Only extras like "Winter" are translated.
 * Kept free of imports so the import script (scripts/import-official-sites.mjs) can use it.
 */
export type SiteLanguage = "de" | "fr" | "en";
export interface SiteNames { de: string; fr: string; en: string }

const SITE_WORD = /(^|\s)(Start-\/Landeplatz|Startplatz|Landeplatz|Start)(?:\s+(\d+))?(?=\s|$)/;
const EXTRA_WORDS: Record<string, { fr: string; en: string }> = {
  Winter: { fr: "hiver", en: "winter" },
  Sommer: { fr: "été", en: "summer" },
  neu: { fr: "nouveau", en: "new" },
};
/** Landings of one municipality closer than this are the same spot and may share a name. */
const SAME_SPOT_METERS = 150;

/** Fixes known typos and writes Swiss German ("ss", no "ß"). */
export function normalizeSiteName(name: string): string {
  return name.replace(/\bLandelatz\b/g, "Landeplatz").replace(/ß/g, "ss").replace(/\s+/g, " ").trim();
}

const localizeExtras = (text: string, lang: SiteLanguage) =>
  lang === "de" ? text : text.replace(/\p{L}+/gu, (word) => EXTRA_WORDS[word]?.[lang] ?? word);

/** Area, number and extras of a DHV place name ("Belalp Startplatz 2 (Winter)" → Belalp, 2, (Winter)). */
export function splitSourceName(sourceName: string): { prefix: string; number: string; extra: string } {
  const m = SITE_WORD.exec(sourceName);
  if (!m) return { prefix: sourceName.trim(), number: "", extra: "" };
  return {
    prefix: sourceName.slice(0, m.index).trim(),
    number: m[3] || "",
    extra: sourceName.slice(m.index + m[0].length).trim(),
  };
}

export interface NamingInput {
  source_id: string;
  source_name: string;
  type: "takeoff" | "landing" | "both";
  area_name: string | null;
  municipality: string | null;
  latitude: number;
  longitude: number;
}

const meters = (a: NamingInput, b: NamingInput) => {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad, dLng = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** Official names for a whole import, keyed by source_id. */
export function officialSiteNames(rows: NamingInput[]): Map<string, SiteNames> {
  const parts = new Map(rows.map((r) => {
    const { prefix, number, extra } = splitSourceName(normalizeSiteName(r.source_name));
    // What sets a landing apart within its municipality: the name part before the site word
    // ("Flöschhorn Landeplatz" is filed under the area Schatthorn in the DHV file).
    const area = prefix || normalizeSiteName(r.area_name || "");
    const base = r.type === "landing" ? normalizeSiteName(r.municipality || "") || prefix || area : prefix || extra || area;
    // "Startplatz Mostelegg": the name follows the site word.
    const rest = r.type !== "landing" && !prefix ? "" : extra;
    return [r.source_id, { base, number, rest, area }];
  }));

  // Landings of one municipality at different spots get their area appended: "Lenk (Metsch)".
  const suffix = new Map<string, string>();
  const byBase = new Map<string, NamingInput[]>();
  for (const r of rows.filter((x) => x.type === "landing")) {
    const key = parts.get(r.source_id)!.base;
    byBase.set(key, [...(byBase.get(key) || []), r]);
  }
  for (const group of byBase.values()) {
    const clusters: NamingInput[][] = [];
    for (const r of group) {
      const cluster = clusters.find((c) => c.some((o) => meters(o, r) <= SAME_SPOT_METERS));
      if (cluster) cluster.push(r); else clusters.push([r]);
    }
    if (clusters.length < 2) continue;
    for (const cluster of clusters) {
      const areas = [...new Set(cluster.map((r) => parts.get(r.source_id)!.area))].sort((a, b) => a.localeCompare(b, "de"));
      for (const r of cluster) suffix.set(r.source_id, `(${areas.join(" / ")})`);
    }
  }

  const out = new Map<string, SiteNames>();
  for (const r of rows) {
    const { base, number, rest } = parts.get(r.source_id)!;
    const build = (lang: SiteLanguage) => [base, number, localizeExtras(rest, lang), suffix.get(r.source_id) || ""].filter(Boolean).join(" ");
    out.set(r.source_id, { de: build("de"), fr: build("fr"), en: build("en") });
  }
  return out;
}
