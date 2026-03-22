import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LocationCombobox from "@/components/LocationCombobox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { parseIGC, type IGCData } from "@/lib/igc-parser";
import { ArrowLeft, Upload, Plus, X, Youtube, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

interface LocationOption { id: string; name: string; type: string; }
interface GliderOption { id: string; manufacturer: string; model: string; size: string | null; is_default: boolean; }
interface TrainingItem { id: string; name: string; category_name: string; }
interface GroupOption { id: string; name: string; }

export default function FlightForm() {
  const { id } = useParams();
  const locationState = useLocation().state as any;
  const isEdit = !!id;
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [gliders, setGliders] = useState<GliderOption[]>([]);
  const [igcData, setIgcData] = useState<IGCData | null>(null);
  const [igcFile, setIgcFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [youtubeUrls, setYoutubeUrls] = useState<string[]>([]);
  const [newYoutubeUrl, setNewYoutubeUrl] = useState("");
  const [trainingItems, setTrainingItems] = useState<TrainingItem[]>([]);
  const [selectedTrainingIds, setSelectedTrainingIds] = useState<string[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0], takeoff_location_id: "", landing_location_id: "",
    duration_minutes: "", altitude_gain: "", distance_km: "", thermals: "", wind_speed: "",
    wind_direction: "", glider: "", comments: "", group_id: "", is_solo_shv: false,
  });

  useEffect(() => {
    if (!user) return;
    supabase.from("locations").select("id, name, type").eq("user_id", user.id).order("name").then(({ data }) => { if (data) setLocations(data); });
    supabase.from("training_items").select("id, name, category_id, training_categories(name)").order("sort_order").then(({ data }) => {
      if (data) setTrainingItems(data.map((item: any) => ({ id: item.id, name: item.name, category_name: item.training_categories?.name || "" })));
    });
    supabase.from("group_members").select("group_id, groups(id, name)").eq("user_id", user.id).then(({ data }) => {
      if (data) setGroups(data.map((gm: any) => ({ id: gm.groups.id, name: gm.groups.name })));
    });
    supabase.from("pilot_gliders").select("id, manufacturer, model, size, is_default").eq("user_id", user.id).order("is_default", { ascending: false }).then(({ data }) => {
      if (data) {
        setGliders(data);
        if (!isEdit && !form.glider) {
          const def = data.find((g) => g.is_default);
          if (def) setForm((prev) => ({ ...prev, glider: `${def.manufacturer} ${def.model}${def.size ? ` (${def.size})` : ""}` }));
        }
      }
    });
    if (isEdit) {
      supabase.from("flights").select("*").eq("id", id).single().then(({ data }) => {
        if (data) setForm({ date: data.date, takeoff_location_id: data.takeoff_location_id || "", landing_location_id: data.landing_location_id || "", duration_minutes: data.duration_minutes?.toString() || "", altitude_gain: data.altitude_gain?.toString() || "", distance_km: data.distance_km?.toString() || "", thermals: data.thermals || "", wind_speed: data.wind_speed?.toString() || "", wind_direction: data.wind_direction || "", glider: data.glider || "", comments: data.comments || "", group_id: (data as any).group_id || "" });
      });
      supabase.from("flight_videos").select("youtube_url").eq("flight_id", id).then(({ data }) => { if (data) setYoutubeUrls(data.map((v) => v.youtube_url)); });
      supabase.from("flight_training_items" as any).select("item_id").eq("flight_id", id).then(({ data }) => { if (data) setSelectedTrainingIds((data as any[]).map((d: any) => d.item_id)); });
    }
    if (locationState?.igcFile && locationState?.igcContent) {
      try {
        const parsed = parseIGC(locationState.igcContent);
        setIgcData(parsed); setIgcFile(locationState.igcFile);
        setForm((prev) => ({ ...prev, date: parsed.date || prev.date, duration_minutes: parsed.durationMinutes > 0 ? parsed.durationMinutes.toString() : prev.duration_minutes, altitude_gain: parsed.maxAltitude > 0 ? (parsed.maxAltitude - parsed.minAltitude).toString() : prev.altitude_gain, glider: parsed.glider || prev.glider }));
        toast({ title: t("flights.uploadRecording"), description: `${parsed.points.length} ${t("flights.igcPointsLoaded")}` });
      } catch (err) { console.error("Failed to parse recorded IGC:", err); }
    }
  }, [user, id, isEdit]);

  const handleIGCUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; setIgcFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string; const parsed = parseIGC(content); setIgcData(parsed);
        setForm((prev) => ({ ...prev, date: parsed.date || prev.date, duration_minutes: parsed.durationMinutes > 0 ? parsed.durationMinutes.toString() : prev.duration_minutes, altitude_gain: parsed.maxAltitude > 0 ? (parsed.maxAltitude - parsed.minAltitude).toString() : prev.altitude_gain, glider: parsed.glider || prev.glider }));
        toast({ title: t("flights.igcImported"), description: `${parsed.points.length} ${t("flights.igcPointsLoaded")}` });
      } catch (err: any) { toast({ title: t("flights.igcError"), description: err.message || t("flights.igcReadError"), variant: "destructive" }); setIgcFile(null); }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!user) return; setLoading(true);
    try {
      const flightData = { user_id: user.id, date: form.date, takeoff_location_id: form.takeoff_location_id || null, landing_location_id: form.landing_location_id || null, duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null, altitude_gain: form.altitude_gain ? parseInt(form.altitude_gain) : null, distance_km: form.distance_km ? parseFloat(form.distance_km) : null, thermals: form.thermals || null, wind_speed: form.wind_speed ? parseInt(form.wind_speed) : null, wind_direction: form.wind_direction || null, glider: form.glider || null, comments: form.comments || null, group_id: form.group_id || null } as any;
      let flightId: string;
      if (isEdit) { const { error } = await supabase.from("flights").update(flightData).eq("id", id); if (error) throw error; flightId = id!; }
      else { const { data, error } = await supabase.from("flights").insert(flightData).select("id").single(); if (error) throw error; flightId = data.id; }
      if (igcFile) {
        try {
          const path = `${user.id}/${flightId}/${igcFile.name}`;
          const { error: storageErr } = await supabase.storage.from("igc-files").upload(path, igcFile, { upsert: true }); if (storageErr) throw storageErr;
          const limitedPoints = igcData ? igcData.points.filter((_, i) => i % Math.max(1, Math.floor(igcData.points.length / 2000)) === 0) : null;
          const { error: trackErr } = await supabase.from("igc_tracks").insert([{ flight_id: flightId, storage_path: path, track_data: limitedPoints ? { points: limitedPoints } as any : null }]); if (trackErr) throw trackErr;
        } catch (igcErr: any) { console.error("IGC upload failed:", igcErr); toast({ title: t("flights.igcUploadFailed"), description: t("flights.igcUploadFailedDesc"), variant: "destructive" }); }
      }
      for (const photo of photoFiles) {
        try { const path = `${user.id}/${flightId}/${Date.now()}-${photo.name}`; const { error: photoErr } = await supabase.storage.from("flight-photos").upload(path, photo); if (photoErr) throw photoErr; const { error: insertErr } = await supabase.from("flight_photos").insert({ flight_id: flightId, storage_path: path }); if (insertErr) throw insertErr; }
        catch (photoErr: any) { console.error("Photo upload failed:", photoErr); toast({ title: t("flights.photoUploadFailed"), description: photo.name, variant: "destructive" }); }
      }
      if (!isEdit && youtubeUrls.length > 0) { await supabase.from("flight_videos").insert(youtubeUrls.map((url) => ({ flight_id: flightId, youtube_url: url }))); }
      // Save training items
      if (isEdit) { await supabase.from("flight_training_items" as any).delete().eq("flight_id", flightId); }
      if (selectedTrainingIds.length > 0) { await supabase.from("flight_training_items" as any).insert(selectedTrainingIds.map((item_id) => ({ flight_id: flightId, item_id })) as any); }
      toast({ title: isEdit ? t("flights.flightUpdated") : t("flights.flightSaved") }); navigate(`/flights/${flightId}`);
    } catch (err: any) { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const addYoutubeUrl = () => { if (newYoutubeUrl.trim()) { setYoutubeUrls([...youtubeUrls, newYoutubeUrl.trim()]); setNewYoutubeUrl(""); } };
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: e.target.value });
  const takeoffs = locations.filter((l) => l.type === "takeoff" || l.type === "both");
  const landings = locations.filter((l) => l.type === "landing" || l.type === "both");

  const thermalOptions = [
    { value: "Keine", label: t("flights.thermalNone") }, { value: "Schwach", label: t("flights.thermalWeak") },
    { value: "Mässig", label: t("flights.thermalModerate") }, { value: "Stark", label: t("flights.thermalStrong") },
    { value: "Turbulent", label: t("flights.thermalTurbulent") },
  ];

  return (
    <div className="px-4 pt-4 pb-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl font-bold">{isEdit ? t("flights.editFlight") : t("flights.newFlight")}</h1>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <label className="flex flex-col items-center gap-2 cursor-pointer">
              <Upload className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium text-primary">{t("flights.igcImport")}</span>
              <span className="text-xs text-muted-foreground">{t("flights.igcExtract")}</span>
              <input type="file" accept=".igc" className="hidden" onChange={handleIGCUpload} />
            </label>
            {igcData && <p className="text-xs text-center mt-2 text-muted-foreground">✓ {igcData.points.length} Punkte · {igcData.durationMinutes}min · max {igcData.maxAltitude}m</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">{t("flights.basicData")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">{t("flights.date")}</Label><Input type="date" value={form.date} onChange={set("date")} required /></div>
              <div className="space-y-1.5"><Label className="text-xs">{t("flights.glider")}</Label>
                {gliders.length > 0 ? (
                  <Select value={form.glider} onValueChange={(v) => setForm({ ...form, glider: v })}>
                    <SelectTrigger><SelectValue placeholder={t("flights.selectGlider")} /></SelectTrigger>
                    <SelectContent>{gliders.map((g) => { const label = `${g.manufacturer} ${g.model}${g.size ? ` (${g.size})` : ""}`; return <SelectItem key={g.id} value={label}>{label}</SelectItem>; })}</SelectContent>
                  </Select>
                ) : <Input value={form.glider} onChange={set("glider")} placeholder={t("flights.gliderPlaceholder")} />}
              </div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">{t("flights.takeoff")}</Label>
              <LocationCombobox
                locations={locations}
                value={form.takeoff_location_id}
                onChange={(v) => setForm({ ...form, takeoff_location_id: v })}
                filterType="takeoff"
                onLocationCreated={() => {
                  if (user) supabase.from("locations").select("id, name, type").eq("user_id", user.id).order("name").then(({ data }) => { if (data) setLocations(data); });
                }}
              />
            </div>
            <div className="space-y-1.5"><Label className="text-xs">{t("flights.landing")}</Label>
              <LocationCombobox
                locations={locations}
                value={form.landing_location_id}
                onChange={(v) => setForm({ ...form, landing_location_id: v })}
                filterType="landing"
                onLocationCreated={() => {
                  if (user) supabase.from("locations").select("id, name, type").eq("user_id", user.id).order("name").then(({ data }) => { if (data) setLocations(data); });
                }}
              />
            </div>
           </CardContent>
        </Card>
        {groups.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-1.5">
              <Label className="text-xs">{t("flights.group")}</Label>
              <Select value={form.group_id} onValueChange={(v) => setForm({ ...form, group_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder={t("flights.selectGroup")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("flights.noGroup")}</SelectItem>
                  {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">{t("flights.extendedData")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">{t("flights.duration")}</Label><Input type="number" value={form.duration_minutes} onChange={set("duration_minutes")} /></div>
              <div className="space-y-1.5"><Label className="text-xs">{t("flights.altitudeGain")}</Label><Input type="number" value={form.altitude_gain} onChange={set("altitude_gain")} /></div>
              <div className="space-y-1.5"><Label className="text-xs">{t("flights.distance")}</Label><Input type="number" step="0.1" value={form.distance_km} onChange={set("distance_km")} /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">{t("flights.thermals")}</Label>
              <Select value={form.thermals} onValueChange={(v) => setForm({ ...form, thermals: v })}>
                <SelectTrigger><SelectValue placeholder={t("flights.select")} /></SelectTrigger>
                <SelectContent>{thermalOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">{t("flights.windSpeed")}</Label><Input type="number" value={form.wind_speed} onChange={set("wind_speed")} /></div>
              <div className="space-y-1.5"><Label className="text-xs">{t("flights.windDirection")}</Label>
                <Select value={form.wind_direction} onValueChange={(v) => setForm({ ...form, wind_direction: v })}>
                  <SelectTrigger><SelectValue placeholder={t("flights.direction")} /></SelectTrigger>
                  <SelectContent>{["N", "NE", "E", "SE", "S", "SW", "W", "NW"].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">{t("flights.comments")}</Label><Textarea value={form.comments} onChange={set("comments")} placeholder={t("flights.commentsPlaceholder")} rows={3} /></div>
          </CardContent>
        </Card>
        {trainingItems.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">{t("flights_training.trainedManeuvers")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {selectedTrainingIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedTrainingIds.map((id) => {
                    const item = trainingItems.find((ti) => ti.id === id);
                    return item ? (
                      <Badge key={id} variant="secondary" className="gap-1 pr-1">
                        {item.name}
                        <button type="button" onClick={() => setSelectedTrainingIds((prev) => prev.filter((x) => x !== id))}><X className="h-3 w-3" /></button>
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="w-full">
                    <Plus className="h-4 w-4 mr-1" /> {t("flights_training.selectManeuvers")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 max-h-64 overflow-y-auto p-2" align="start">
                  {(() => {
                    const categories = [...new Set(trainingItems.map((ti) => ti.category_name))];
                    return categories.map((cat) => (
                      <div key={cat} className="mb-2">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-2 py-1">{cat}</p>
                        {trainingItems.filter((ti) => ti.category_name === cat).map((ti) => (
                          <label key={ti.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm">
                            <Checkbox
                              checked={selectedTrainingIds.includes(ti.id)}
                              onCheckedChange={(checked) => {
                                setSelectedTrainingIds((prev) => checked ? [...prev, ti.id] : prev.filter((x) => x !== ti.id));
                              }}
                            />
                            {ti.name}
                          </label>
                        ))}
                      </div>
                    ));
                  })()}
                </PopoverContent>
              </Popover>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">{t("flights.photos")}</CardTitle></CardHeader>
          <CardContent>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-primary"><Plus className="h-4 w-4" /> {t("flights.addPhotos")}<input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setPhotoFiles(Array.from(e.target.files || []))} /></label>
            {photoFiles.length > 0 && <p className="text-xs text-muted-foreground mt-1">{photoFiles.length} {t("flights.photosSelected")}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">{t("flights.youtubeVideos")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {youtubeUrls.map((url, i) => (
              <div key={i} className="flex items-center gap-2 text-xs"><Youtube className="h-4 w-4 text-destructive shrink-0" /><span className="truncate flex-1">{url}</span><button type="button" onClick={() => setYoutubeUrls(youtubeUrls.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button></div>
            ))}
            <div className="flex gap-2"><Input placeholder={t("flights.youtubeUrlPlaceholder")} value={newYoutubeUrl} onChange={(e) => setNewYoutubeUrl(e.target.value)} className="text-sm" /><Button type="button" variant="outline" size="sm" onClick={addYoutubeUrl}>+</Button></div>
          </CardContent>
        </Card>
        <Button type="submit" className="w-full" disabled={loading}>{loading ? t("flights.saving") : isEdit ? t("common.update") : t("flights.flightSaved")}</Button>
      </form>
    </div>
  );
}
