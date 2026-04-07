import { useEffect, useState, useMemo, lazy, Suspense } from "react";
import { useParams } from "react-router-dom";
import { MapPin, Clock, TrendingUp, Route, Wind, Mountain } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import useEmblaCarousel from "embla-carousel-react";
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

type HeroSlide =
  | { type: "video"; embedUrl: string }
  | { type: "photo"; url: string }
  | { type: "map" };

function getYoutubeEmbedUrl(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|\/shorts\/|\/embed\/)([^&\s]+)/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

function HeroCarousel({ slides, takeoff, landing, trackPoints, durationMin, distanceKm }: {
  slides: HeroSlide[];
  takeoff: SharedFlightData["takeoff"];
  landing: SharedFlightData["landing"];
  trackPoints: [number, number][];
  durationMin: number | null;
  distanceKm: number | null;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  const formatDuration = (min: number) => {
    const h = Math.floor(min / 60); const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
  };

  if (slides.length === 0) return null;

  function renderSlide(slide: HeroSlide) {
    if (slide.type === "video") {
      return (
        <iframe
          src={slide.embedUrl}
          title="Video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      );
    }
    if (slide.type === "photo") {
      return <img src={slide.url} alt="" className="w-full h-full object-cover" />;
    }
    // Map
    return (
      <div className="relative w-full h-full">
        <div className="[&_.leaflet-container]:!h-full [&>div]:!h-full w-full h-full">
          <FlightDetailMap takeoff={takeoff} landing={landing} trackPoints={trackPoints} />
        </div>
        <div className="absolute bottom-3 left-3 flex gap-1.5 z-10">
          {durationMin != null && (
            <span className="bg-background/80 backdrop-blur-sm text-foreground text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm">
              ⏱ {formatDuration(durationMin)}
            </span>
          )}
          {distanceKm != null && (
            <span className="bg-background/80 backdrop-blur-sm text-foreground text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm">
              ↔ {Number(distanceKm).toFixed(1)}km
            </span>
          )}
        </div>
      </div>
    );
  }

  if (slides.length === 1) {
    return (
      <div className="relative w-full aspect-[4/5] bg-muted overflow-hidden rounded-b-2xl">
        {renderSlide(slides[0])}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-b-2xl" ref={emblaRef}>
        <div className="flex">
          {slides.map((slide, i) => (
            <div key={i} className="flex-[0_0_100%] min-w-0 aspect-[4/5] bg-muted overflow-hidden relative">
              {renderSlide(slide)}
            </div>
          ))}
        </div>
      </div>
      <div className="absolute top-3 right-3 bg-black/60 text-white text-xs font-medium px-2 py-0.5 rounded-full z-10">
        {selected + 1}/{slides.length}
      </div>
      {slides.length <= 10 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1 z-10">
          {slides.map((_, i) => (
            <div key={i} className={cn("w-1.5 h-1.5 rounded-full transition-colors", i === selected ? "bg-white" : "bg-white/40")} />
          ))}
        </div>
      )}
    </div>
  );
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

  const trackPoints2D = useMemo(() => {
    return data?.track_data?.points?.map((p: any) => [p.lat, p.lng] as [number, number]) || [];
  }, [data]);

  useEffect(() => {
    if (!token) return;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    fetch(`${supabaseUrl}/functions/v1/get-shared-flight?token=${token}`, {
      headers: { Accept: "application/json" },
    })
      .then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then((d) => setData(d))
      .catch(() => setError("Flug nicht gefunden"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background px-4 pt-8 pb-8 max-w-lg mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[70vh] w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
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
    const h = Math.floor(min / 60); const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
  };

  const locale = "de-CH";

  // Build hero slides: videos → photos → map
  const heroSlides: HeroSlide[] = [];
  for (const v of data.videos) {
    const embedUrl = getYoutubeEmbedUrl(v.youtube_url);
    if (embedUrl) heroSlides.push({ type: "video", embedUrl });
  }
  for (const p of data.photos) {
    heroSlides.push({ type: "photo", url: p.url });
  }
  const hasTrackForMap = trackPoints2D.length > 1 || data.takeoff || data.landing;
  if (hasTrackForMap) {
    heroSlides.push({ type: "map" });
  }

  const hasTrackFor3D = trackPoints3D.length > 1;

  const statItems = [
    data.duration_minutes != null && { icon: Clock, label: "Dauer", value: formatDuration(data.duration_minutes) },
    data.altitude_gain != null && { icon: TrendingUp, label: "Höhenmeter", value: `${data.altitude_gain} m` },
    data.distance_km != null && { icon: Route, label: "Distanz", value: `${Number(data.distance_km).toFixed(1)} km` },
    data.wind_speed != null && { icon: Wind, label: "Wind", value: `${data.wind_speed} km/h ${data.wind_direction || ""}` },
  ].filter(Boolean) as { icon: any; label: string; value: string }[];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto pb-8">
        {/* Hero Carousel */}
        {heroSlides.length > 0 && !show3D && (
          <div className="relative">
            <HeroCarousel
              slides={heroSlides}
              takeoff={data.takeoff}
              landing={data.landing}
              trackPoints={trackPoints2D}
              durationMin={data.duration_minutes}
              distanceKm={data.distance_km}
            />
            {/* Avatar overlay bottom-left */}
            <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
              <div className="p-[2px] rounded-full bg-gradient-to-tr from-primary via-secondary to-accent">
                <Avatar className="h-10 w-10 border-2 border-background">
                  {data.avatar_url && <AvatarImage src={data.avatar_url} />}
                  <AvatarFallback>{data.pilot_name?.charAt(0) || "P"}</AvatarFallback>
                </Avatar>
              </div>
              <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1">
                <p className="text-white text-sm font-semibold">{data.pilot_name}</p>
                <p className="text-white/70 text-[10px]">
                  {new Date(data.date).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 3D toggle & view */}
        {hasTrackFor3D && (
          <div className="px-4 pt-3">
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
          </div>
        )}

        {show3D && hasTrackFor3D && (
          <div className="px-4 pt-2">
            <Suspense fallback={<div className="h-[55vh] rounded-xl border border-border bg-muted animate-pulse" />}>
              <Flight3DMap points={trackPoints3D} highlightIndex={hoverIdx} onAnimIndex={setAnimIdx} />
              <FlightAltitudeProfile points={trackPoints3D} onHoverIndex={setHoverIdx} animIndex={animIdx} />
            </Suspense>
          </div>
        )}

        {/* Info section */}
        <div className="px-4 pt-4 space-y-3">
          {/* Route & badge */}
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-sm">
              <span className="font-semibold">{data.takeoff?.name || "–"}</span>
              <span className="text-muted-foreground mx-1.5">→</span>
              <span className="font-semibold">{data.landing?.name || "–"}</span>
            </p>
            {data.is_solo_shv && <Badge variant="default" className="text-[10px] px-1.5 py-0 ml-auto">SHV Solo</Badge>}
          </div>

          {/* Compact stats row */}
          {statItems.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {statItems.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5 text-sm">
                  <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{s.label}:</span>
                  <span className="font-semibold">{s.value}</span>
                </div>
              ))}
            </div>
          )}

          {data.glider && (
            <p className="text-sm text-muted-foreground">🪂 {data.glider}</p>
          )}

          {data.comments && (
            <p className="text-sm whitespace-pre-wrap">{data.comments}</p>
          )}
        </div>

        {/* Footer */}
        <div className="pt-8 text-center">
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
