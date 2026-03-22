import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ArrowLeft, Edit, Trash2, Youtube, MapPin, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { parseIGC } from "@/lib/igc-parser";
import FlightDetailMap from "@/components/FlightDetailMap";

export default function FlightDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const [flight, setFlight] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [track, setTrack] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [trainedManeuvers, setTrainedManeuvers] = useState<string[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const igcInputRef = useRef<HTMLInputElement>(null);
  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";

  useEffect(() => {
    if (!id) return;
    supabase.from("flights").select("*, takeoff:locations!flights_takeoff_location_id_fkey(name, latitude, longitude), landing:locations!flights_landing_location_id_fkey(name, latitude, longitude)").eq("id", id).single().then(({ data }) => setFlight(data));
    supabase.from("flight_photos").select("*").eq("flight_id", id).then(({ data }) => setPhotos(data || []));
    supabase.from("flight_videos").select("*").eq("flight_id", id).then(({ data }) => setVideos(data || []));
    supabase.from("igc_tracks").select("*").eq("flight_id", id).maybeSingle().then(({ data }) => setTrack(data));
    supabase.from("flight_training_items" as any).select("item_id, training_items(name)").eq("flight_id", id).then(({ data }) => {
      if (data) setTrainedManeuvers((data as any[]).map((d: any) => d.training_items?.name).filter(Boolean));
    });
  }, [id]);

  const handleDelete = async () => { if (!confirm(t("flights.deleteFlight"))) return; await supabase.from("flights").delete().eq("id", id); toast({ title: t("flights.flightDeleted") }); navigate("/flights"); };

  const handleIGCUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !user || !id) return; setUploading(true);
    try {
      const content = await file.text(); const parsed = parseIGC(content);
      const path = `${user.id}/${id}/${file.name}`;
      const { error: storageErr } = await supabase.storage.from("igc-files").upload(path, file, { upsert: true }); if (storageErr) throw storageErr;
      const limitedPoints = parsed.points.filter((_, i) => i % Math.max(1, Math.floor(parsed.points.length / 2000)) === 0);
      if (track) await supabase.from("igc_tracks").delete().eq("id", track.id);
      const { data: newTrack, error: trackErr } = await supabase.from("igc_tracks").insert({ flight_id: id, storage_path: path, track_data: { points: limitedPoints } as any }).select().single();
      if (trackErr) throw trackErr;
      setTrack(newTrack);
      toast({ title: t("flights.igcUploaded"), description: `${parsed.points.length} ${t("flights.igcPointsLoaded")}` });
    } catch (err: any) { toast({ title: t("flights.igcUploadFailed"), description: err.message, variant: "destructive" }); }
    finally { setUploading(false); if (igcInputRef.current) igcInputRef.current.value = ""; }
  };

  if (!flight) return <div className="p-4 text-center text-muted-foreground">{t("common.loading")}</div>;
  const formatDuration = (min: number) => { const h = Math.floor(min / 60); const m = min % 60; return h > 0 ? `${h}h ${m}m` : `${m} min`; };
  const getYoutubeThumbnail = (url: string) => { const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/); return match ? `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg` : null; };

  return (
    <div className="px-4 pt-4 pb-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/flights")}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-lg font-bold">{flight.takeoff?.name || t("flights.flight")}</h1>
            <p className="text-xs text-muted-foreground">{new Date(flight.date).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/flights/${id}/edit`)}><Edit className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={handleDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      </div>
      {(flight.takeoff || flight.landing) && (
        <Card className="border-0 shadow-sm"><CardContent className="p-4 flex items-center gap-3"><MapPin className="h-5 w-5 text-secondary shrink-0" /><div className="text-sm"><span className="font-medium">{flight.takeoff?.name || "–"}</span><span className="text-muted-foreground mx-2">→</span><span className="font-medium">{flight.landing?.name || "–"}</span></div></CardContent></Card>
      )}
      <FlightDetailMap takeoff={flight.takeoff ? { name: flight.takeoff.name, latitude: flight.takeoff.latitude, longitude: flight.takeoff.longitude } : null} landing={flight.landing ? { name: flight.landing.name, latitude: flight.landing.latitude, longitude: flight.landing.longitude } : null} trackPoints={track?.track_data ? ((track.track_data as any).points || []).map((p: any) => [p.lat, p.lng] as [number, number]) : []} />
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: t("flights.flightTime"), value: flight.duration_minutes ? formatDuration(flight.duration_minutes) : "–" },
          { label: t("flights.altitude"), value: flight.altitude_gain ? `+${flight.altitude_gain} m` : "–" },
          { label: t("flights.distanceLabel"), value: flight.distance_km ? `${Number(flight.distance_km).toFixed(1)} km` : "–" },
          { label: t("flights.gliderLabel"), value: flight.glider || "–" },
          { label: t("flights.thermalsLabel"), value: flight.thermals || "–" },
          { label: t("flights.windLabel"), value: flight.wind_speed ? `${flight.wind_speed} km/h ${flight.wind_direction || ""}` : "–" },
        ].map(({ label, value }) => (
          <Card key={label} className="border-0 shadow-sm"><CardContent className="p-3"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p><p className="text-sm font-medium mt-0.5">{value}</p></CardContent></Card>
        ))}
      </div>
      {flight.comments && (<Card className="border-0 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm">{t("flights.comments")}</CardTitle></CardHeader><CardContent className="pt-0"><p className="text-sm text-muted-foreground">{flight.comments}</p></CardContent></Card>)}
      {trainedManeuvers.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("flights_training.trainedManeuvers")}</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-1.5">
              {trainedManeuvers.map((name) => (
                <Badge key={name} variant="secondary">{name}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {photos.length > 0 && (
        <Card className="border-0 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm">{t("flights.photos")}</CardTitle></CardHeader><CardContent className="pt-0"><div className="grid grid-cols-3 gap-2">{photos.map((p) => { const { data } = supabase.storage.from("flight-photos").getPublicUrl(p.storage_path); return (<img key={p.id} src={data.publicUrl} alt="" className="rounded-lg aspect-square object-cover cursor-pointer active:scale-[0.97] transition-transform" onClick={() => setLightboxUrl(data.publicUrl)} />); })}</div></CardContent></Card>
      )}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-0 bg-transparent shadow-none [&>button]:text-white [&>button]:bg-black/50 [&>button]:rounded-full [&>button]:p-1">{lightboxUrl && <img src={lightboxUrl} alt="" className="w-full h-auto max-h-[90vh] object-contain rounded-lg" />}</DialogContent>
      </Dialog>
      {videos.length > 0 && (
        <Card className="border-0 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm">{t("flights.videos")}</CardTitle></CardHeader><CardContent className="pt-0 space-y-2">{videos.map((v) => { const thumb = getYoutubeThumbnail(v.youtube_url); return (<a key={v.id} href={v.youtube_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 group">{thumb && <img src={thumb} alt="" className="w-20 rounded" />}<div className="flex items-center gap-1.5 text-sm text-primary group-hover:underline"><Youtube className="h-4 w-4" /> {t("flights.watchVideo")}</div></a>); })}</CardContent></Card>
      )}
      <input ref={igcInputRef} type="file" accept=".igc" className="hidden" onChange={handleIGCUpload} />
      <Button variant="outline" className="w-full gap-2" onClick={() => igcInputRef.current?.click()} disabled={uploading}>
        <Upload className="h-4 w-4" />{uploading ? t("flights.uploading") : track ? t("flights.igcReplace") : t("flights.igcAttach")}
      </Button>
    </div>
  );
}
