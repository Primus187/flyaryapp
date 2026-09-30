import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, RotateCcw, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import LoadingState from "@/components/layout/LoadingState";
import EmptyState from "@/components/layout/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppAdmin } from "@/hooks/use-app-admin";
import { burnairMapUrl } from "@/lib/burnair";
import { loadOfficialSites } from "@/lib/official-sites-store";
import { isNumberedName, suggestSiteNames } from "@/lib/site-name-suggestions";

interface SiteRow {
  id: string; source_name: string | null; name_de: string; name_override: string | null; area_name: string | null;
  type: "takeoff" | "landing" | "both"; altitude: number | null; wind_directions: string[]; region: string | null;
  municipality: string | null; latitude: number; longitude: number;
}
type Filter = "numbered" | "curated" | "all";

/**
 * Official site names for the app admin (stage C): numbered DHV names ("Kronberg 1 … 4") get a real
 * name, checked against the burnair map. Saving sets official_sites.name_override for everyone
 * without an own name (set_official_site_name, migration 0067).
 */
export default function AdminSites() {
  const { t } = useTranslation();
  const isAdmin = useAppAdmin();
  const [sites, setSites] = useState<SiteRow[] | null>(null);
  const [filter, setFilter] = useState<Filter>("numbered");
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("official_sites")
      .select("id, source_name, name_de, name_override, area_name, type, altitude, wind_directions, region, municipality, latitude, longitude")
      .eq("active", true).order("area_name").order("name_de");
    if (error) { toast.error(t("common.error")); setSites([]); return; }
    setSites(data as SiteRow[]);
  }, [t]);
  useEffect(() => { if (isAdmin) void load(); }, [isAdmin, load]);

  // Suggestions come from the imported names, so they stay available after a name was curated.
  const suggestions = useMemo(() => suggestSiteNames((sites || []).map((s) => ({ id: s.id, name: s.name_de, type: s.type, wind_directions: s.wind_directions }))), [sites]);
  const numbered = useMemo(() => (sites || []).filter((s) => isNumberedName(s.name_de)), [sites]);
  const curatedCount = numbered.filter((s) => s.name_override).length;

  const visible = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return (sites || [])
      .filter((s) => filter === "all" || (filter === "curated" ? !!s.name_override : isNumberedName(s.name_de) && !s.name_override))
      .filter((s) => words.every((w) => `${s.name_override || ""} ${s.name_de} ${s.source_name || ""} ${s.area_name || ""} ${s.municipality || ""} ${s.region || ""}`.toLowerCase().includes(w)));
  }, [sites, filter, query]);
  const groups = useMemo(() => {
    const map = new Map<string, SiteRow[]>();
    for (const s of visible.slice(0, 150)) map.set(s.area_name || "–", [...(map.get(s.area_name || "–") || []), s]);
    return [...map.entries()];
  }, [visible]);

  const save = async (site: SiteRow, name: string) => {
    setSaving(site.id);
    const { error } = await supabase.rpc("set_official_site_name", { _site_id: site.id, _name: name });
    setSaving(null);
    if (error) { toast.error(t("common.error"), { description: error.message }); return; }
    toast.success(name.trim() ? t("adminSites.saved", { name: name.trim() }) : t("adminSites.reset"));
    setDrafts((d) => { const next = { ...d }; delete next[site.id]; return next; });
    setSites((list) => (list || []).map((s) => (s.id === site.id ? { ...s, name_override: name.trim() || null } : s)));
    void loadOfficialSites(true);
  };

  const typeLabel = (type: SiteRow["type"]) => t(type === "takeoff" ? "locations.takeoff" : type === "landing" ? "locations.landingPlace" : "locations.both");

  if (!isAdmin) return <PageContainer><PageHeader title={t("adminSites.title")} back="/admin" /><EmptyState title={t("adminSites.adminOnly")} /></PageContainer>;

  return (
    <PageContainer className="space-y-4">
      <PageHeader title={t("adminSites.title")} subtitle={t("adminSites.subtitle")} back="/admin" />
      {sites === null ? <LoadingState /> : (
        <>
          <p className="text-xs text-muted-foreground">{t("adminSites.progress", { done: curatedCount, total: numbered.length })}</p>
          <div className="flex gap-1.5">
            {(["numbered", "curated", "all"] as const).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>{t(`adminSites.filter.${f}`)}</Button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("adminSites.search")} />
          </div>
          {visible.length === 0 && <EmptyState title={t("adminSites.empty")} />}
          {visible.length > 150 && <p className="text-xs text-muted-foreground">{t("adminSites.more", { count: visible.length - 150 })}</p>}
          {groups.map(([area, rows]) => (
            <div key={area} className="space-y-1.5">
              <h2 className="text-sm font-semibold px-1">{area}<span className="font-normal text-muted-foreground"> · {rows[0].region}</span></h2>
              {rows.map((site) => {
                const suggestion = suggestions.get(site.id);
                const draft = drafts[site.id] ?? site.name_override ?? "";
                return (
                  <Card key={site.id} className="border-0 shadow-sm">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 text-sm">
                          <p className="font-medium truncate">{site.name_override || site.name_de}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {typeLabel(site.type)}{site.altitude ? ` · ${site.altitude} m` : ""}
                            {site.wind_directions.length ? ` · ${site.wind_directions.map((d) => t(`locations.compass.${d}`)).join("/")}` : ""}
                            {site.municipality ? ` · ${site.municipality}` : ""}
                          </p>
                          <p className="text-[11px] text-muted-foreground">DHV: {site.source_name || "–"}{site.name_override ? ` · ${t("adminSites.imported")}: ${site.name_de}` : ""}</p>
                        </div>
                        <Button asChild size="sm" variant="outline" className="h-7 shrink-0 gap-1 px-2 text-xs">
                          <a href={burnairMapUrl(site.latitude, site.longitude)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" />burnair</a>
                        </Button>
                      </div>
                      <div className="flex gap-1.5">
                        <Input className="h-8 text-sm" value={draft} placeholder={suggestion || site.name_de}
                          onChange={(e) => setDrafts((d) => ({ ...d, [site.id]: e.target.value }))} />
                        <Button size="sm" className="h-8" disabled={saving === site.id || !draft.trim() || draft.trim() === (site.name_override || "")}
                          onClick={() => { void save(site, draft); }}>{t("common.save")}</Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestion && suggestion !== site.name_override && (
                          <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => setDrafts((d) => ({ ...d, [site.id]: suggestion }))}>
                            <Sparkles className="h-3 w-3" />{t("adminSites.useSuggestion", { name: suggestion })}
                          </Button>
                        )}
                        {site.name_override && (
                          <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" disabled={saving === site.id} onClick={() => { void save(site, ""); }}>
                            <RotateCcw className="h-3 w-3" />{t("adminSites.resetTo", { name: site.name_de })}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ))}
        </>
      )}
    </PageContainer>
  );
}
