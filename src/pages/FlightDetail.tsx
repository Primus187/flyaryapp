import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Edit, Trash2, Youtube, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function FlightDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [flight, setFlight] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [track, setTrack] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    supabase.from("flights").select("*, takeoff:locations!flights_takeoff_location_id_fkey(name, latitude, longitude), landing:locations!flights_landing_location_id_fkey(name, latitude, longitude)").eq("id", id).single().then(({ data }) => setFlight(data));
    supabase.from("flight_photos").select("*").eq("flight_id", id).then(({ data }) => setPhotos(data || []));
    supabase.from("flight_videos").select("*").eq("flight_id", id).then(({ data }) => setVideos(data || []));
    supabase.from("igc_tracks").select("*").eq("flight_id", id).maybeSingle().then(({ data }) => setTrack(data));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm("Flug wirklich löschen?")) return;
    await supabase.from("flights").delete().eq("id", id);
    toast({ title: "Flug gelöscht" });
    navigate("/flights");
  };

  if (!flight) return <div className="p-4 text-center text-muted-foreground">Laden...</div>;

  const formatDuration = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
  };

  const getYoutubeThumbnail = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return match ? `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg` : null;
  };

  return (
    <div className="px-4 pt-4 pb-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/flights")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">{flight.takeoff?.name || "Flug"}</h1>
            <p className="text-xs text-muted-foreground">{new Date(flight.date).toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/flights/${id}/edit`)}><Edit className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={handleDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      </div>

      {/* Route */}
      {(flight.takeoff || flight.landing) && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <MapPin className="h-5 w-5 text-secondary shrink-0" />
            <div className="text-sm">
              <span className="font-medium">{flight.takeoff?.name || "–"}</span>
              <span className="text-muted-foreground mx-2">→</span>
              <span className="font-medium">{flight.landing?.name || "–"}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Flugzeit", value: flight.duration_minutes ? formatDuration(flight.duration_minutes) : "–" },
          { label: "Höhenmeter", value: flight.altitude_gain ? `+${flight.altitude_gain} m` : "–" },
          { label: "Strecke", value: flight.distance_km ? `${Number(flight.distance_km).toFixed(1)} km` : "–" },
          { label: "Schirm", value: flight.glider || "–" },
          { label: "Thermik", value: flight.thermals || "–" },
          { label: "Wind", value: flight.wind_speed ? `${flight.wind_speed} km/h ${flight.wind_direction || ""}` : "–" },
        ].map(({ label, value }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
              <p className="text-sm font-medium mt-0.5">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Comments */}
      {flight.comments && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Kommentar</CardTitle></CardHeader>
          <CardContent className="pt-0"><p className="text-sm text-muted-foreground">{flight.comments}</p></CardContent>
        </Card>
      )}

      {/* Photos */}
      {photos.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Fotos</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p) => {
                const { data } = supabase.storage.from("flight-photos").getPublicUrl(p.storage_path);
                return <img key={p.id} src={data.publicUrl} alt="" className="rounded-lg aspect-square object-cover" />;
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Videos */}
      {videos.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Videos</CardTitle></CardHeader>
          <CardContent className="pt-0 space-y-2">
            {videos.map((v) => {
              const thumb = getYoutubeThumbnail(v.youtube_url);
              return (
                <a key={v.id} href={v.youtube_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 group">
                  {thumb && <img src={thumb} alt="" className="w-20 rounded" />}
                  <div className="flex items-center gap-1.5 text-sm text-primary group-hover:underline">
                    <Youtube className="h-4 w-4" /> Video ansehen
                  </div>
                </a>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Track info */}
      {track && (
        <Button variant="outline" className="w-full" onClick={() => navigate(`/map?flight=${id}`)}>
          Track auf Karte anzeigen
        </Button>
      )}
    </div>
  );
}
