import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Plus, MapPin, Pencil, Trash2, AlertTriangle, ChevronDown, ArrowUpCircle, ArrowDownCircle, Combine } from "lucide-react";
import LocationMapPicker from "@/components/LocationMapPicker";

export default function Locations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [locations, setLocations] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", latitude: "", longitude: "", type: "both" as string, altitude: "", description: "", country_code: "" });
  const [backfillProgress, setBackfillProgress] = useState<{ current: number; total: number } | null>(null);
  const cancelledRef = useRef(false);

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
  useEffect(() => { fetchLocations(); }, [fetchLocations]);

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
        } catch {}
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

  const resetForm = () => { setForm({ name: "", latitude: "", longitude: "", type: "both", altitude: "", description: "", country_code: "" }); setEditId(null); };
  const handleSave = async () => {
    if (!user) return;
    const data = { user_id: user.id, name: form.name, latitude: parseFloat(form.latitude), longitude: parseFloat(form.longitude), type: form.type as any, altitude: form.altitude ? parseInt(form.altitude) : null, description: form.description || null, country_code: form.country_code || null };
    if (editId) { await supabase.from("locations").update(data).eq("id", editId); toast({ title: t("locations.locationUpdated") }); }
    else { await supabase.from("locations").insert(data); toast({ title: t("locations.locationCreated") }); }
    resetForm(); setOpen(false); fetchLocations();
  };
  const handleEdit = (loc: any) => { setForm({ name: loc.name, latitude: loc.latitude.toString(), longitude: loc.longitude.toString(), type: loc.type, altitude: loc.altitude?.toString() || "", description: loc.description || "", country_code: loc.country_code || "" }); setEditId(loc.id); setOpen(true); };
  const handleDelete = async (id: string) => { if (!confirm(t("locations.deleteLocation"))) return; await supabase.from("locations").delete().eq("id", id); toast({ title: t("locations.locationDeleted") }); fetchLocations(); };
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const { data, error } = await supabase.functions.invoke('reverse-geocode', { body: { lat, lon: lng } });
      const code = data?.country_code;
      if (code && code.length === 2) setForm((prev) => ({ ...prev, country_code: code }));
    } catch {}
  };
  const handleMapSelect = (lat: number, lng: number) => { setForm((prev) => ({ ...prev, latitude: lat.toString(), longitude: lng.toString() })); reverseGeocode(lat, lng); };

  const toggleSection = (key: string) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const sectionConfig = [
    { key: "takeoff", icon: ArrowUpCircle, label: t("locations.takeoff"), color: "text-secondary" },
    { key: "landing", icon: ArrowDownCircle, label: t("locations.landingPlace"), color: "text-destructive" },
    { key: "both", icon: Combine, label: t("locations.both"), color: "text-primary" },
  ] as const;

  const renderLocationCard = (loc: any) => (
    <Card key={loc.id} className="border-0 shadow-sm cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate(`/locations/${loc.id}`)}>
      <CardContent className="p-3 flex items-center justify-between">
        <div>
          <p className="font-medium text-sm flex items-center gap-1.5">
             {loc.latitude === 0 && loc.longitude === 0 && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
{loc.country_code && <span>{getFlagEmoji(loc.country_code)}</span>}
             {loc.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {loc.altitude && <span>{loc.altitude}m</span>}
            {loc.latitude === 0 && loc.longitude === 0 && <span className="text-amber-500"> · {t("common.noPosition")}</span>}
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleEdit(loc); }}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleDelete(loc.id); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("locations.title")}</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate("/map")}><MapPin className="h-4 w-4" /> {t("locations.map")}</Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> {t("locations.newLocation")}</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editId ? t("locations.editLocation") : t("locations.createLocation")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5"><Label className="text-xs">{t("locations.name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("locations.namePlaceholder")} /></div>
                <div className="space-y-1.5"><Label className="text-xs">{t("locations.type")}</Label><Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="takeoff">{t("locations.takeoff")}</SelectItem><SelectItem value="landing">{t("locations.landingPlace")}</SelectItem><SelectItem value="both">{t("locations.both")}</SelectItem></SelectContent></Select></div>
                <div className="space-y-1.5"><Label className="text-xs">{t("locations.selectOnMap")}</Label><LocationMapPicker latitude={parseFloat(form.latitude) || 0} longitude={parseFloat(form.longitude) || 0} onSelect={handleMapSelect} /><p className="text-xs text-muted-foreground">{t("locations.tapMap")}</p></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label className="text-xs">{t("locations.latitude")}</Label><Input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="46.7" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">{t("locations.longitude")}</Label><Input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="7.6" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label className="text-xs">{t("locations.altitude")}</Label><Input type="number" value={form.altitude} onChange={(e) => setForm({ ...form, altitude: e.target.value })} /></div></div>
                <div className="space-y-1.5"><Label className="text-xs">{t("locations.country")}</Label><Select value={form.country_code} onValueChange={(v) => setForm({ ...form, country_code: v })}><SelectTrigger><SelectValue placeholder={t("locations.countryPlaceholder")} /></SelectTrigger><SelectContent>{countries.map((c) => (<SelectItem key={c.code} value={c.code}>{getFlagEmoji(c.code)} {c.name}</SelectItem>))}</SelectContent></Select></div>
                <div className="space-y-1.5"><Label className="text-xs">{t("locations.descriptionLabel")}</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t("common.optional")} /></div>
                <Button className="w-full" onClick={handleSave}>{editId ? t("common.update") : t("common.save")}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      {backfillProgress && (
        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          {t("locations.updatingCountries", { current: backfillProgress.current, total: backfillProgress.total })}
        </div>
      )}
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
    </div>
  );
}