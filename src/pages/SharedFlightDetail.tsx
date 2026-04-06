import { useEffect, useState, useMemo, lazy, Suspense } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Clock, TrendingUp, Route, Wind, Thermometer, Mountain } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import FlightDetailMap from "@/components/FlightDetailMap";

const Flight3DMap = lazy(() => import("@/components/Flight3DMap"));
const FlightAltitudeProfile = lazy(() => import("@/components/FlightAltitudeProfile"));

interface SharedFlightData {
  date: string;
  glider: string | null;
  duration_minutes: number | null;
  altitude_gain: number | null;
  distance_km: number | null;
  thermals: string | null;
  wind_speed: number | null;
  wind_direction: string | null;
  comments: string | null;
  is_solo_shv: boolean;
  takeoff: { name: string; latitude: number; longitude: number } | null;
  landing: { name: string; latitude: number; longitude: number } | null;
  photos: { id: string; url: string }[];
  videos: { id: string; youtube_url: string }[];
  track_data: { points: any[] } | null;
  pilot_name: string;
  avatar_url: string;
}

export default function SharedFlightDetail() {
  const { token } = useParams();
  const [data, setData] = useState<SharedFlightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [show3D, setShow3D] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [animIdx, setAnimIdx] = useState<number | null>(null);

  const trackPoints3D = useMemo(() => {
    const raw = data?.track_data?.points;
    if (!raw || !Array.isArray(raw)) return [];
    return raw.map((p: any) => ({ lat: p.lat, lng: p.lng, altitude: p.altitude || 0, time: p.time || "" }));
  }, [data]);

  useEffect(() => {
    if (!token) return;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    fetch(`${supabaseUrl}/functions/v1/get-shared-flight?token=${token}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((d) => setData(d))
      .catch(() => setError("Flug nicht gefunden"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background px-4 pt-8 pb-8 max-w-lg mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-muted-foreground">{error || "Flug nicht gefunden"}</p>
          <a href="/" className="text-sm text-primary hover:underline">Zur App →</a>
        </div>
      </div>
    );
  }

  const formatDuration = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
  };

  const getYoutubeEmbedUrl = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  };

  const locale = "de-CH";

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 pt-6 pb-8 max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            {data.avatar_url && <AvatarImage src={data.avatar_url} />}
            <AvatarFallback>{data.pilot_name?.charAt(0) || "P"}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">{data.takeoff?.name || "Flug"}</h1>
              {data.is_solo_shv && <Badge variant="default" className="text-[10px] px-1.5 py-0">SHV Solo</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.pilot_name} · {new Date(data.date).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>

        {/* Route */}
        {(data.takeoff || data.landing) && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <MapPin className="h-5 w-5 text-secondary shrink-0" />
              <div className="text-sm">
                <span className="font-medium">{data.takeoff?.name || "–"}</span>
                <span className="text-muted-foreground mx-2">→</span>
                <span className="font-medium">{data.landing?.name || "–"}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Map */}
        {data.track_data?.points?.length && data.track_data.points.length > 1 && (
          <div className="flex gap-1 justify-end">
            <button
              className={`px-3 py-1 text-xs rounded-md font-medium ${!show3D ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              onClick={() => setShow3D(false)}
            >2D</button>
            <button
              className={`px-3 py-1 text-xs rounded-md font-medium flex items-center gap-1 ${show3D ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              onClick={() => setShow3D(true)}
            >
              <Mountain className="h-3.5 w-3.5" /> 3D
            </button>
          </div>
        )}

        {show3D && trackPoints3D.length > 1 ? (
          <Suspense fallback={<div className="h-[55vh] rounded-xl border border-border bg-muted animate-pulse" />}>
            <Flight3DMap points={trackPoints3D} highlightIndex={hoverIdx} onAnimIndex={setAnimIdx} />
            <FlightAltitudeProfile points={trackPoints3D} onHoverIndex={setHoverIdx} animIndex={animIdx} />
          </Suspense>
        ) : (
          <FlightDetailMap
            takeoff={data.takeoff}
            landing={data.landing}
            trackPoints={data.track_data?.points?.map((p: any) => [p.lat, p.lng] as [number, number]) || []}
          />
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {data.duration_minutes != null && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div><p className="text-xs text-muted-foreground">Dauer</p><p className="font-semibold text-sm">{formatDuration(data.duration_minutes)}</p></div>
              </CardContent>
            </Card>
          )}
          {data.altitude_gain != null && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <div><p className="text-xs text-muted-foreground">Höhenmeter</p><p className="font-semibold text-sm">{data.altitude_gain} m</p></div>
              </CardContent>
            </Card>
          )}
          {data.distance_km != null && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3 flex items-center gap-2">
                <Route className="h-4 w-4 text-muted-foreground" />
                <div><p className="text-xs text-muted-foreground">Distanz</p><p className="font-semibold text-sm">{Number(data.distance_km).toFixed(1)} km</p></div>
              </CardContent>
            </Card>
          )}
          {data.wind_speed != null && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3 flex items-center gap-2">
                <Wind className="h-4 w-4 text-muted-foreground" />
                <div><p className="text-xs text-muted-foreground">Wind</p><p className="font-semibold text-sm">{data.wind_speed} km/h {data.wind_direction || ""}</p></div>
              </CardContent>
            </Card>
          )}
        </div>

        {data.glider && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 text-sm">
              <span className="text-muted-foreground">Gleitschirm: </span>
              <span className="font-medium">{data.glider}</span>
            </CardContent>
          </Card>
        )}

        {data.comments && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 text-sm whitespace-pre-wrap">{data.comments}</CardContent>
          </Card>
        )}

        {/* Photos */}
        {data.photos.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {data.photos.map((p) => (
              <img key={p.id} src={p.url} className="h-32 rounded-lg object-cover shrink-0" alt="Flight photo" />
            ))}
          </div>
        )}

        {/* Videos */}
        {data.videos.map((v) => {
          const embedUrl = getYoutubeEmbedUrl(v.youtube_url);
          if (!embedUrl) return null;
          return (
            <div key={v.id} className="aspect-video rounded-xl overflow-hidden">
              <iframe src={embedUrl} className="w-full h-full" allowFullScreen />
            </div>
          );
        })}

        {/* Footer */}
        <div className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">
            Geteilt über{" "}
            <a href="https://flyaryapp.lovable.app" className="text-primary hover:underline font-medium">
              FlyAry
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
