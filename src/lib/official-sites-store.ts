/**
 * The catalogue of official sites in the browser: loaded once per day, kept in localStorage so names
 * show in the app language right away, shared by every component through useSyncExternalStore.
 * Everything that depends on it degrades to the plain place name while it is empty (not signed in,
 * offline on first start, or migration 0063 not applied yet).
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import type { OfficialSite } from "@/lib/official-sites";

export type CatalogSite = OfficialSite & { active: boolean };
interface Catalog { sites: CatalogSite[]; active: CatalogSite[]; byName: Map<string, CatalogSite> }

const CACHE_KEY = "flyary.officialSites.v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const COLUMNS = "id, name_de, name_fr, name_en, area_name, type, latitude, longitude, altitude, country_code, region, wind_directions, active";

const build = (sites: CatalogSite[]): Catalog => ({ sites, active: sites.filter((s) => s.active), byName: new Map(sites.map((s) => [s.name_de, s])) });
let catalog = build([]);
let loadedAt = 0;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

try {
  const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
  if (Array.isArray(cached?.sites)) { catalog = build(cached.sites); loadedAt = Number(cached.savedAt) || 0; }
} catch { /* no cache */ }

export function loadOfficialSites(force = false): Promise<void> {
  if (import.meta.env.MODE === "test") return Promise.resolve();
  if (loading) return loading;
  if (!force && catalog.sites.length > 0 && Date.now() - loadedAt < MAX_AGE_MS) return Promise.resolve();
  loading = (async () => {
    const all: CatalogSite[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from("official_sites").select(COLUMNS).order("name_de").range(from, from + 999);
      if (error) throw error;
      all.push(...(data as CatalogSite[]));
      if (data.length < 1000) break;
    }
    if (all.length === 0 && catalog.sites.length > 0) return;
    catalog = build(all);
    loadedAt = Date.now();
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: loadedAt, sites: all })); } catch { /* storage full or blocked */ }
    listeners.forEach((l) => l());
  })().catch(() => { /* keep what we have; retried on the next mount */ }).finally(() => { loading = null; });
  return loading;
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export function useOfficialSites(): Catalog {
  useEffect(() => { void loadOfficialSites(); }, []);
  return useSyncExternalStore(subscribe, () => catalog, () => catalog);
}

export function siteNameIn(site: Pick<OfficialSite, "name_de" | "name_fr" | "name_en">, lang: string | undefined): string {
  if (lang?.startsWith("fr")) return site.name_fr;
  if (lang?.startsWith("en")) return site.name_en;
  return site.name_de;
}

/** Place name in the app language: official sites are shown in the current language, own places as typed. */
export function useSiteName() {
  const { i18n } = useTranslation();
  const lang = i18n?.language;
  const { byName } = useOfficialSites();
  return useCallback((name: string | null | undefined): string => {
    if (!name) return name ?? "";
    const site = byName.get(name);
    return site ? siteNameIn(site, lang) : name;
  }, [byName, lang]);
}

/** The pilot's own place for an official site: the existing linked one, or a new one. */
export async function ensureOwnLocationForSite(userId: string, site: OfficialSite): Promise<string> {
  const { data: existing, error: findError } = await supabase.from("locations").select("id")
    .eq("user_id", userId).eq("official_site_id", site.id).order("created_at").limit(1);
  if (findError) throw findError;
  if (existing?.[0]) return existing[0].id;
  // Name, type and position are set by the database from the site (trigger locations_official_site_sync).
  const { data, error } = await supabase.from("locations").insert({
    user_id: userId, official_site_id: site.id, name: site.name_de, type: site.type,
    latitude: site.latitude, longitude: site.longitude, altitude: site.altitude, country_code: site.country_code,
  }).select("id").single();
  if (error) throw error;
  return data.id;
}
