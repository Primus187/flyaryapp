import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Plus, MapPin, AlertTriangle, ChevronDown, ArrowUpCircle, ArrowDownCircle, Combine, BadgeCheck, RotateCcw } from "lucide-react";
import LocationMapPicker from "@/components/LocationMapPicker";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { COMPASS_POINTS } from "@/lib/wind-match";
import OfficialSiteSearch from "@/components/OfficialSiteSearch";
import OfficialSiteHint from "@/components/OfficialSiteHint";
import SiteLinkSuggestions from "@/components/SiteLinkSuggestions";
import DuplicatePlaces from "@/components/DuplicatePlaces";
import type { OfficialSite } from "@/lib/official-sites";
import { ensureOwnLocationForSite, officialName, useOfficialSites, useSiteName } from "@/lib/official-sites-store";

export default function Locations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const [locations, setLocations] = useState<any[]>([]);
  const [flightStats, setFlightStats] = useState<Record<string, { count: number; lastDate: string | null }>>({});
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", latitude: "", longitude: "", type: "both" as string, altitude: "", description: "", country_code: "", optimal_wind_directions: [] as string[] });
  const [backfillProgress, setBackfillProgress] = useState<{ current: number; total: number } | null>(null);
  const cancelledRef = useRef(false);
  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";
  const siteName = useSiteName();
  const { byId: officialById } = useOfficialSites();
  // Only a name the pilot actually changed is sent; the database keeps it as the own name.
  const [nameDirty, setNameDirty] = useState(false);
  const [addingOfficial, setAddingOfficial] = useState(false);

  const getFlagEmoji = (code: string) => { if (!code || code.length !== 2) return ""; return String.fromCodePoint(...code.toUpperCase().split("").map((c) => 127397 + c.charCodeAt(0))); };

  const countries = [
    { code: "CH", name: "Schweiz" }, { code: "DE", name: "Deutschland" }, { code: "AT", name: "Österreich" },
    { code: "FR", name: "Frankreich" }, { code: "IT", name: "Italien" }, { code: "ES", name: "Spanien" },
    { code: "PT", name: "Portugal" }, { code: "SI", name: "Slowenien" }, { code: "HR", name: "Kroatien" },
    { code: "TR", name: "Türkei" }, { code: "GR", name: "Griechenland" }, { code: "NP", name: "Nepal" },
    { code: "CO", name: "Kolumbien" }, { code: "BR", name: "Brasilien" }, { code: "ZA", name: "Südafrika" },
    { code: "US", name: "USA" }, { code: "GB", name: "UK" },
  ];
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ takeoff: true, landing: true, both: true });

  const fetchLocations = useCallback(async () => { if (!user) return; const { data } = await supabase.from("locations").select("*").eq("user_id", user.id).order("name"); if (data) setLocations(data); return data; }, [user]);

  const fetchFlightStats = useCallback(async () => {
    if (!user) return;
    const { data: flights } = await supabase.from("flights").select("takeoff_location_id, landing_location_id, date").eq("user_id", user.id);
    if (!flights) return;
    const stats: Record<string, { count: number; lastDate: string | null }> = {};
    for (const f of flights) {
      for (const locId of [f.takeoff_location_id, f.landing_location_id]) {
        if (!locId) continue;
        if (!stats[locId]) stats[locId] = { count: 0, lastDate: null };
        stats[locId].count++;
        if (!stats[locId].lastDate || f.date > stats[locId].lastDate!) stats[locId].lastDate = f.date;
      }
    }
    setFlightStats(stats);
  }, [user]);

  useEffect(() => { fetchLocations(); fetchFlightStats(); }, [fetchLocations, fetchFlightStats]);

  // Handle ?edit=id from LocationDetail
  useEffect(() => {
    const editParam = searchParams.get("edit");
    if (editParam && locations.length > 0) {
      const loc = locations.find((l) => l.id === editParam);
      if (loc) {
        setForm({ name: loc.official_site_id && !loc.custom_name ? siteName(loc.name) : loc.name, latitude: loc.latitude.toString(), longitude: loc.longitude.toString(), type: loc.type, altitude: loc.altitude?.toString() || "", description: loc.description || "", country_code: loc.country_code || "", optimal_wind_directions: loc.optimal_wind_directions || [] });
        setEditId(loc.id);
        setOpen(true);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, locations, setSearchParams, siteName]);

  // Backfill country_code for locations missing it
  useEffect(() => {
    if (!user) return;
    cancelledRef.current = false;
    const backfill = async () => {
      const { data } = await supabase.from("locations").select("id, latitude, longitude").eq("user_id", user.id).is("country_code", null);
      if (!data) return;
      const toUpdate = data.filter((l) => l.latitude !== 0 || l.longitude !== 0);
      if (toUpdate.length === 0) return;
      setBackfillProgress({ current: 0, total: toUpdate.length });
      for (let i = 0; i < toUpdate.length; i++) {
        if (cancelledRef.current) break;
        const loc = toUpdate[i];
        try {
          const { data: geocodeData, error } = await supabase.functions.invoke('reverse-geocode', { body: { lat: loc.latitude, lon: loc.longitude } });
          const code = geocodeData?.country_code;
          if (code && code.length === 2) {
            await supabase.from("locations").update({ country_code: code }).eq("id", loc.id);
          }
        } catch { /* no country for this site: it stays empty and can be set by hand */ }
        setBackfillProgress({ current: i + 1, total: toUpdate.length });
        if (i < toUpdate.length - 1) await new Promise((r) => setTimeout(r, 1100));
      }
      setBackfillProgress(null);
      fetchLocations();
    };
    backfill();
    return () => { cancelledRef.current = true; };
  }, [user, fetchLocations]);

  const grouped = useMemo(() => ({
    takeoff: locations.filter((l) => l.type === "takeoff"),
    landing: locations.filter((l) => l.type === "landing"),
    both: locations.filter((l) => l.type === "both"),
  }), [locations]);

  const resetForm = () => { setForm({ name: "", latitude: "", longitude: "", type: "both", altitude: "", description: "", country_code: "", optimal_wind_directions: [] }); setEditId(null); setNameDirty(false); };
  const toggleWindDirection = (dir: string) => {
    setForm((prev) => ({
      ...prev,
      optimal_wind_directions: prev.optimal_wind_directions.includes(dir)
        ? prev.optimal_wind_directions.filter((d) => d !== dir)
        : [...prev.optimal_wind_directions, dir],
    }));
  };
  // A place linked to an official site keeps the site's name, type and position (database trigger);
  // only the pilot's notes and wind choice can be changed.
  const editedLocation = editId ? locations.find((l) => l.id === editId) : null;
  const locked = !!editedLocation?.official_site_id;
  const editedSite = editedLocation?.official_site_id ? officialById.get(editedLocation.official_site_id) : undefined;
  const resetToOfficialName = async () => {
    if (!editId) return;
    await supabase.from("locations").update({ custom_name: null }).eq("id", editId);
    toast({ title: t("locations.locationUpdated") }); resetForm(); setOpen(false); fetchLocations();
  };
  const addOfficial = async (site: OfficialSite) => {
    if (!user) return;
    setAddingOfficial(true);
    try {
      await ensureOwnLocationForSite(user.id, site);
      toast({ title: t("locations.official.added", { name: siteName(officialName(site)) }) });
      resetForm(); setOpen(false); fetchLocations();
    } catch (err: unknown) {
      toast({ title: t("common.error"), description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally { setAddingOfficial(false); }
  };
  const handleSave = async () => {
    if (!user) return;
    if (editId && locked) {
      // An empty name goes back to the official one (database trigger).
      await supabase.from("locations").update({ description: form.description || null, optimal_wind_directions: form.optimal_wind_directions, ...(nameDirty ? { name: form.name.trim() } : {}) }).eq("id", editId);
      toast({ title: t("locations.locationUpdated") }); resetForm(); setOpen(false); fetchLocations();
      return;
    }
    const data = { user_id: user.id, name: form.name, latitude: parseFloat(form.latitude), longitude: parseFloat(form.longitude), type: form.type, altitude: form.altitude ? parseInt(form.altitude) : null, description: form.description || null, country_code: form.country_code || null, optimal_wind_directions: form.optimal_wind_directions };
    if (editId) { await supabase.from("locations").update(data as TablesUpdate<"locations">).eq("id", editId); toast({ title: t("locations.locationUpdated") }); }
    else { await supabase.from("locations").insert(data as TablesInsert<"locations">); toast({ title: t("locations.locationCreated") }); }
    resetForm(); setOpen(false); fetchLocations();
  };
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const { data, error } = await supabase.functions.invoke('reverse-geocode', { body: { lat, lon: lng } });
      const code = data?.country_code;
      if (code && code.length === 2) setForm((prev) => ({ ...prev, country_code: code }));
    } catch { /* the country is a convenience: the form works without it */ }
  };
  const handleMapSelect = (lat: number, lng: number) => { setForm((prev) => ({ ...prev, latitude: lat.toString(), longitude: lng.toString() })); reverseGeocode(lat, lng); };

  const toggleSection = (key: string) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const sectionConfig = [
    { key: "takeoff", icon: ArrowUpCircle, label: t("locations.takeoff"), color: "text-success" },
    { key: "landing", icon: ArrowDownCircle, label: t("locations.landingPlace"), color: "text-destructive" },
    { key: "both", icon: Combine, label: t("locations.both"), color: "text-primary" },
  ] as const;

  const renderLocationCard = (loc) => {
    const stats = flightStats[loc.id];
    return (
      <Card key={loc.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate(`/locations/${loc.id}`)}>
        <CardContent className="px-3.5 py-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold flex items-center gap-1.5">
              {loc.latitude === 0 && loc.longitude === 0 && <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />}
              {loc.country_code && <span>{getFlagEmoji(loc.country_code)}</span>}
              <span className="truncate">{siteName(loc.name)}</span>
              {loc.official_site_id && <BadgeCheck className="h-4 w-4 text-primary shrink-0" aria-label={t("locations.official.badge")} />}
            </p>
            <p className="truncate text-[13px] font-medium text-muted-foreground">
              {loc.altitude && <span>{loc.altitude} m</span>}
              {loc.latitude === 0 && loc.longitude === 0 && <span className="text-warning-soft-foreground"> · {t("common.noPosition")}</span>}
              {stats?.lastDate && <span>{(loc.altitude || (loc.latitude === 0 && loc.longitude === 0)) && " · "}{t("locations.lastFlight")}: {new Date(stats.lastDate).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })}</span>}
            </p>
          </div>
          {stats && stats.count > 0 ? (
            <div className="shrink-0 text-right">
              <p className="text-base stat-value">{stats.count}</p>
              <p className="text-[11px] font-semibold text-muted-foreground">{t("dashboard.flights")}</p>
            </div>
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground -rotate-90" />
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <PageContainer>
      <PageHeader
        title={t("locations.title")}
        action={
          <>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate("/map")}><MapPin className="h-4 w-4" /> {t("locations.map")}</Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> {t("locations.newLocation")}</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editId ? t("locations.editLocation") : t("locations.createLocation")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                {!editId && (
                  <>
                    <OfficialSiteSearch onPick={(site) => { void addOfficial(site); }} disabled={addingOfficial} />
                    <p className="text-xs font-medium text-muted-foreground pt-1">{t("locations.official.orOwn")}</p>
                  </>
                )}
                {locked && (
                  <p className="flex items-start gap-1.5 rounded-lg bg-primary/5 border border-primary/40 p-2.5 text-xs">
                    <BadgeCheck className="h-4 w-4 text-primary shrink-0" />{t("locations.official.lockedHint")}
                  </p>
                )}
                <div className="space-y-1.5"><Label className="text-xs">{t("locations.name")}</Label><Input value={form.name} onChange={(e) => { setNameDirty(true); setForm({ ...form, name: e.target.value }); }} placeholder={editedSite ? siteName(officialName(editedSite)) : t("locations.namePlaceholder")} />
                  {editedSite && (
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{t("locations.official.officialName", { name: siteName(officialName(editedSite)) })}</span>
                      {editedLocation?.custom_name && <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => { void resetToOfficialName(); }}><RotateCcw className="h-3 w-3" />{t("locations.official.resetName")}</Button>}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5"><Label className="text-xs">{t("locations.type")}</Label><Select disabled={locked} value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="takeoff">{t("locations.takeoff")}</SelectItem><SelectItem value="landing">{t("locations.landingPlace")}</SelectItem><SelectItem value="both">{t("locations.both")}</SelectItem></SelectContent></Select></div>
                {!locked && <div className="space-y-1.5"><Label className="text-xs">{t("locations.selectOnMap")}</Label><LocationMapPicker latitude={parseFloat(form.latitude) || 0} longitude={parseFloat(form.longitude) || 0} onSelect={handleMapSelect} /><p className="text-xs text-muted-foreground">{t("locations.tapMap")}</p></div>}
                {!editId && <OfficialSiteHint latitude={parseFloat(form.latitude) || 0} longitude={parseFloat(form.longitude) || 0} type={form.type} onUse={(site) => { void addOfficial(site); }} />}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label className="text-xs">{t("locations.latitude")}</Label><Input type="number" step="any" disabled={locked} value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="46.7" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">{t("locations.longitude")}</Label><Input type="number" step="any" disabled={locked} value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="7.6" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label className="text-xs">{t("locations.altitude")}</Label><Input type="number" disabled={locked} value={form.altitude} onChange={(e) => setForm({ ...form, altitude: e.target.value })} /></div></div>
                <div className="space-y-1.5"><Label className="text-xs">{t("locations.country")}</Label><Select disabled={locked} value={form.country_code} onValueChange={(v) => setForm({ ...form, country_code: v })}><SelectTrigger><SelectValue placeholder={t("locations.countryPlaceholder")} /></SelectTrigger><SelectContent>{countries.map((c) => (<SelectItem key={c.code} value={c.code}>{getFlagEmoji(c.code)} {c.name}</SelectItem>))}</SelectContent></Select></div>
                <div className="space-y-1.5"><Label className="text-xs">{t("locations.descriptionLabel")}</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t("common.optional")} /></div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("locations.optimalWind")}</Label>
                  <p className="text-xs text-muted-foreground">{t("locations.optimalWindHint")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {COMPASS_POINTS.map((dir) => (
                      <button
                        key={dir}
                        type="button"
                        onClick={() => toggleWindDirection(dir)}
                        className={`text-xs px-2.5 py-1 rounded-full border ${
                          form.optimal_wind_directions.includes(dir) ? "bg-primary/15 border-primary/50 text-primary font-medium" : "border-border text-muted-foreground"
                        }`}
                      >
                        {t(`locations.compass.${dir}`)}
                      </button>
                    ))}
                  </div>
                </div>
                <Button className="w-full" onClick={handleSave}>{editId ? t("common.update") : t("common.save")}</Button>
              </div>
            </DialogContent>
          </Dialog>
          </>
        }
      />
      {backfillProgress && (
        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          {t("locations.updatingCountries", { current: backfillProgress.current, total: backfillProgress.total })}
        </div>
      )}
      <SiteLinkSuggestions locations={locations} onLinked={fetchLocations} />
      <DuplicatePlaces locations={locations} flightCounts={Object.fromEntries(Object.entries(flightStats).map(([id, s]) => [id, s.count]))} onMerged={() => { void fetchLocations(); void fetchFlightStats(); }} />
      {locations.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><MapPin className="h-10 w-10 mx-auto mb-3 opacity-40" /><p className="text-sm">{t("locations.noLocations")}</p></div>
      ) : (
        <div className="space-y-3">
          {sectionConfig.map(({ key, icon: Icon, label, color }) => {
            const items = grouped[key as keyof typeof grouped];
            if (items.length === 0) return null;
            return (
              <Collapsible key={key} open={openSections[key]} onOpenChange={() => toggleSection(key)}>
                <CollapsibleTrigger className="flex items-center justify-between w-full px-1 py-2 group">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4.5 w-4.5 ${color}`} />
                    <span className="font-semibold text-sm">{label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">({items.length})</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${openSections[key] ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-1.5 pt-1">
                    {items.map(renderLocationCard)}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}