/**
 * Names of official takeoff/landing sites in the app language. The DHV catalogue names every
 * place "<area> Startplatz|Landeplatz [n] [extra]" in German. The area is a proper name and stays
 * as it is; only the site word and the words after it are translated. Kept free of imports so the
 * import script (scripts/import-official-sites.mjs) can use the same rules.
 */
export type SiteLanguage = "de" | "fr" | "en";

const SITE_WORDS: Record<string, { fr: string; en: string }> = {
  "Start-/Landeplatz": { fr: "Décollage/atterrissage", en: "Takeoff/landing" },
  Startplatz: { fr: "Décollage", en: "Takeoff" },
  Landeplatz: { fr: "Atterrissage", en: "Landing" },
  Start: { fr: "Décollage", en: "Takeoff" },
};
// Only translated after the site word, so an area called e.g. "Sommer" keeps its name.
const EXTRA_WORDS: Record<string, { fr: string; en: string }> = {
  Winter: { fr: "hiver", en: "winter" },
  Sommer: { fr: "été", en: "summer" },
  neu: { fr: "nouveau", en: "new" },
};
const SITE_WORD = /(^|\s)(Start-\/Landeplatz|Startplatz|Landeplatz|Start)(?=\s|$)/;

/** Fixes known typos of the source so every language is derived from one clean German name. */
export function normalizeSiteName(name: string): string {
  return name.replace(/\bLandelatz\b/g, "Landeplatz").replace(/\s+/g, " ").trim();
}

export function localizeSiteName(nameDe: string, lang: string): string {
  if (lang !== "fr" && lang !== "en") return nameDe;
  const match = SITE_WORD.exec(nameDe);
  if (!match) return nameDe;
  const start = match.index + match[1].length;
  const end = start + match[2].length;
  const rest = nameDe.slice(end).replace(/\p{L}+/gu, (word) => EXTRA_WORDS[word]?.[lang] ?? word);
  return nameDe.slice(0, start) + SITE_WORDS[match[2]][lang] + rest;
}
