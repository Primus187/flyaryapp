import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { parseIGC, type IGCData } from "@/lib/igc-parser";
import { ArrowLeft, Upload, Plus, X, Youtube } from "lucide-react";

interface LocationOption {
  id: string;
  name: string;
  type: string;
}

export default function FlightForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [igcData, setIgcData] = useState<IGCData | null>(null);
  const [igcFile, setIgcFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [youtubeUrls, setYoutubeUrls] = useState<string[]>([]);
  const [newYoutubeUrl, setNewYoutubeUrl] = useState("");

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    takeoff_location_id: "",
    landing_location_id: "",
    duration_minutes: "",
    altitude_gain: "",
    distance_km: "",
    thermals: "",
    wind_speed: "",
    wind_direction: "",
    glider: "",
    comments: "",
  });

  useEffect(() => {
    if (!user) return;
    supabase.from("locations").select("id, name, type").eq("user_id", user.id).order("name").then(({ data }) => {
      if (data) setLocations(data);
    });
    if (isEdit) {
      supabase.from("flights").select("*").eq("id", id).single().then(({ data }) => {
        if (data) {
          setForm({
            date: data.date,
            takeoff_location_id: data.takeoff_location_id || "",
            landing_location_id: data.landing_location_id || "",
            duration_minutes: data.duration_minutes?.toString() || "",
            altitude_gain: data.altitude_gain?.toString() || "",
            distance_km: data.distance_km?.toString() || "",
            thermals: data.thermals || "",
            wind_speed: data.wind_speed?.toString() || "",
            wind_direction: data.wind_direction || "",
            glider: data.glider || "",
            comments: data.comments || "",
          });
        }
      });
      supabase.from("flight_videos").select("youtube_url").eq("flight_id", id).then(({ data }) => {
        if (data) setYoutubeUrls(data.map((v) => v.youtube_url));
      });
    }
  }, [user, id, isEdit]);

  const handleIGCUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIgcFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const parsed = parseIGC(content);
      setIgcData(parsed);
      setForm((prev) => ({
        ...prev,
        date: parsed.date || prev.date,
        duration_minutes: parsed.durationMinutes > 0 ? parsed.durationMinutes.toString() : prev.duration_minutes,
        altitude_gain: parsed.maxAltitude > 0 ? (parsed.maxAltitude - parsed.minAltitude).toString() : prev.altitude_gain,
        glider: parsed.glider || prev.glider,
      }));
      toast({ title: "IGC importiert", description: `${parsed.points.length} Trackpunkte geladen` });
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const flightData = {
        user_id: user.id,
        date: form.date,
        takeoff_location_id: form.takeoff_location_id || null,
        landing_location_id: form.landing_location_id || null,
        duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
        altitude_gain: form.altitude_gain ? parseInt(form.altitude_gain) : null,
        distance_km: form.distance_km ? parseFloat(form.distance_km) : null,
        thermals: form.thermals || null,
        wind_speed: form.wind_speed ? parseInt(form.wind_speed) : null,
        wind_direction: form.wind_direction || null,
        glider: form.glider || null,
        comments: form.comments || null,
      };

      let flightId: string;
      if (isEdit) {
        const { error } = await supabase.from("flights").update(flightData).eq("id", id);
        if (error) throw error;
        flightId = id!;
      } else {
        const { data, error } = await supabase.from("flights").insert(flightData).select("id").single();
        if (error) throw error;
        flightId = data.id;
      }

      // Upload IGC
      if (igcFile) {
        const path = `${user.id}/${flightId}/${igcFile.name}`;
        await supabase.storage.from("igc-files").upload(path, igcFile, { upsert: true });
        await supabase.from("igc_tracks").insert({
          flight_id: flightId,
          storage_path: path,
          track_data: igcData ? { points: igcData.points } : null,
        });
      }

      // Upload photos
      for (const photo of photoFiles) {
        const path = `${user.id}/${flightId}/${Date.now()}-${photo.name}`;
        await supabase.storage.from("flight-photos").upload(path, photo);
        await supabase.from("flight_photos").insert({ flight_id: flightId, storage_path: path });
      }

      // Save YouTube links
      if (!isEdit && youtubeUrls.length > 0) {
        await supabase.from("flight_videos").insert(youtubeUrls.map((url) => ({ flight_id: flightId, youtube_url: url })));
      }

      toast({ title: isEdit ? "Flug aktualisiert" : "Flug gespeichert" });
      navigate(`/flights/${flightId}`);
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const addYoutubeUrl = () => {
    if (newYoutubeUrl.trim()) {
      setYoutubeUrls([...youtubeUrls, newYoutubeUrl.trim()]);
      setNewYoutubeUrl("");
    }
  };

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const takeoffs = locations.filter((l) => l.type === "takeoff" || l.type === "both");
  const landings = locations.filter((l) => l.type === "landing" || l.type === "both");

  return (
    <div className="px-4 pt-4 pb-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">{isEdit ? "Flug bearbeiten" : "Neuer Flug"}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* IGC Upload */}
        <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <label className="flex flex-col items-center gap-2 cursor-pointer">
              <Upload className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium text-primary">IGC-Datei importieren</span>
              <span className="text-xs text-muted-foreground">Flugdaten werden automatisch extrahiert</span>
              <input type="file" accept=".igc" className="hidden" onChange={handleIGCUpload} />
            </label>
            {igcData && (
              <p className="text-xs text-center mt-2 text-muted-foreground">
                ✓ {igcData.points.length} Punkte · {igcData.durationMinutes}min · max {igcData.maxAltitude}m
              </p>
            )}
          </CardContent>
        </Card>

        {/* Basic data */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Basisdaten</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Datum</Label>
                <Input type="date" value={form.date} onChange={set("date")} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Schirm</Label>
                <Input value={form.glider} onChange={set("glider")} placeholder="z.B. Gin Explorer 3" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Startplatz</Label>
              <Select value={form.takeoff_location_id} onValueChange={(v) => setForm({ ...form, takeoff_location_id: v })}>
                <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                <SelectContent>
                  {takeoffs.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Landeplatz</Label>
              <Select value={form.landing_location_id} onValueChange={(v) => setForm({ ...form, landing_location_id: v })}>
                <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                <SelectContent>
                  {landings.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Extended data */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Erweiterte Daten</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Flugzeit (min)</Label>
                <Input type="number" value={form.duration_minutes} onChange={set("duration_minutes")} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Höhenmeter</Label>
                <Input type="number" value={form.altitude_gain} onChange={set("altitude_gain")} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Strecke (km)</Label>
                <Input type="number" step="0.1" value={form.distance_km} onChange={set("distance_km")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Thermik-Bedingungen</Label>
              <Select value={form.thermals} onValueChange={(v) => setForm({ ...form, thermals: v })}>
                <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                <SelectContent>
                  {["Keine", "Schwach", "Mässig", "Stark", "Turbulent"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Wind (km/h)</Label>
                <Input type="number" value={form.wind_speed} onChange={set("wind_speed")} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Windrichtung</Label>
                <Select value={form.wind_direction} onValueChange={(v) => setForm({ ...form, wind_direction: v })}>
                  <SelectTrigger><SelectValue placeholder="Richtung" /></SelectTrigger>
                  <SelectContent>
                    {["N", "NE", "E", "SE", "S", "SW", "W", "NW"].map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Kommentar</Label>
              <Textarea value={form.comments} onChange={set("comments")} placeholder="Notizen zum Flug..." rows={3} />
            </div>
          </CardContent>
        </Card>

        {/* Photos */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Fotos</CardTitle></CardHeader>
          <CardContent>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-primary">
              <Plus className="h-4 w-4" /> Fotos hinzufügen
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setPhotoFiles(Array.from(e.target.files || []))} />
            </label>
            {photoFiles.length > 0 && <p className="text-xs text-muted-foreground mt-1">{photoFiles.length} Foto(s) ausgewählt</p>}
          </CardContent>
        </Card>

        {/* YouTube */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">YouTube Videos</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {youtubeUrls.map((url, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <Youtube className="h-4 w-4 text-destructive shrink-0" />
                <span className="truncate flex-1">{url}</span>
                <button type="button" onClick={() => setYoutubeUrls(youtubeUrls.filter((_, j) => j !== i))}>
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input placeholder="YouTube URL einfügen" value={newYoutubeUrl} onChange={(e) => setNewYoutubeUrl(e.target.value)} className="text-sm" />
              <Button type="button" variant="outline" size="sm" onClick={addYoutubeUrl}>+</Button>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Speichern..." : isEdit ? "Aktualisieren" : "Flug speichern"}
        </Button>
      </form>
    </div>
  );
}
