import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, MapPin, Bookmark, X } from "lucide-react";
import { cn } from "@/lib/utils";
import MentionCommentInput from "@/components/MentionCommentInput";
import useEmblaCarousel from "embla-carousel-react";
import DoubleTapHeart from "@/components/DoubleTapHeart";
import ReactionPicker, { ReactionBadges, type ReactionType } from "@/components/ReactionPicker";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const FlightDetailMap = lazy(() => import("@/components/FlightDetailMap"));

export interface FeedFlight {
  id: string;
  date: string;
  created_at: string;
  published_at: string | null;
  feedDescription: string | null;
  glider: string | null;
  duration_minutes: number | null;
  altitude_gain: number | null;
  distance_km: number | null;
  takeoff_name: string | null;
  landing_name: string | null;
  user_id: string;
  pilot_name: string;
  avatar_url: string;
  group_name: string;
  photoUrls: string[];
  videoUrls: string[];
  hasTrack: boolean;
  takeoff: { latitude: number; longitude: number; name?: string } | null;
  landing: { latitude: number; longitude: number; name?: string } | null;
  likes: { user_id: string; reaction_type: string }[];
  comments: { id: string; user_id: string; message: string; created_at: string; pilot_name: string; like_count?: number }[];
  isBookmarked?: boolean;
}

interface FeedCardProps {
  flight: FeedFlight;
  onReact: (flightId: string, reactionType: ReactionType) => void;
  onComment: (flightId: string, message: string) => void;
  onBookmarkToggle?: (flightId: string) => void;
  onCommentLike?: (commentId: string) => void;
  groupMembers?: { user_id: string; pilot_name: string }[];
}

function relativeTime(dateStr: string, t: (key: string, opts?: any) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("feed.justNow");
  if (mins < 60) return t("feed.minutesAgo", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("feed.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  return t("feed.daysAgo", { count: days });
}

function getYoutubeEmbedUrl(url: string): string | null {
  const raw = url.trim();
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.replace(/^www\./, "");
    let videoId: string | null = null;
    if (host === "youtu.be") {
      videoId = parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      if (parsed.pathname === "/watch") videoId = parsed.searchParams.get("v");
      else if (parsed.pathname.startsWith("/shorts/")) videoId = parsed.pathname.split("/")[2] ?? null;
      else if (parsed.pathname.startsWith("/embed/")) videoId = parsed.pathname.split("/")[2] ?? null;
      else if (parsed.pathname.startsWith("/live/")) videoId = parsed.pathname.split("/")[2] ?? null;
    }
    if (!videoId) {
      const m = raw.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{6,})/);
      videoId = m?.[1] ?? null;
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  } catch {
    const m = raw.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{6,})/);
    return m?.[1] ? `https://www.youtube.com/embed/${m[1]}` : null;
  }
}

type MediaSlide =
  | { type: "video"; embedUrl: string }
  | { type: "photo"; url: string; index: number }
  | { type: "map" };

function useTrackPoints(flightId: string, hasTrack: boolean) {
  const [trackPoints, setTrackPoints] = useState<[number, number][] | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!hasTrack || loaded) return;
    setLoaded(true);
    supabase.from("igc_tracks").select("track_data").eq("flight_id", flightId).limit(1).single()
      .then(({ data }) => {
        if (data?.track_data) {
          const raw = data.track_data as any;
          const arr = Array.isArray(raw) ? raw : (raw.points ? raw.points : null);
          if (arr && Array.isArray(arr)) {
            setTrackPoints(arr.slice(0, 500).map((p: any) =>
              (Array.isArray(p) ? [p[0], p[1]] : [p.lat, p.lng]) as [number, number]
            ));
          }
        }
      });
  }, [flightId, hasTrack, loaded]);

  return trackPoints;
}

function UnifiedMediaCarousel({
  slides,
  onDoubleTap,
  onPhotoTap,
  onMapTap,
  takeoff,
  landing,
  trackPoints,
  durationMin,
  distanceKm,
}: {
  slides: MediaSlide[];
  onDoubleTap: () => void;
  onPhotoTap: (photoIndex: number) => void;
  onMapTap: () => void;
  takeoff: FeedFlight["takeoff"];
  landing: FeedFlight["landing"];
  trackPoints: [number, number][] | null;
  durationMin: number | null;
  distanceKm: number | null;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [selected, setSelected] = useState(0);
  const [mapVisible, setMapVisible] = useState(false);
  

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  // Lazy-load map slide when it becomes the selected slide
  useEffect(() => {
    if (!mapVisible && slides[selected]?.type === "map") {
      setMapVisible(true);
    }
  }, [selected, slides, mapVisible]);

  const formatDuration = (min: number) => {
    const h = Math.floor(min / 60); const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  if (slides.length === 0) return null;

  // Single slide — no carousel needed
  if (slides.length === 1) {
    const slide = slides[0];
    return (
      <DoubleTapHeart onDoubleTap={onDoubleTap}>
        <div className="relative w-full aspect-[4/5] bg-muted overflow-hidden">
          {renderSlide(slide)}
        </div>
      </DoubleTapHeart>
    );
  }

  function renderSlide(slide: MediaSlide) {
    if (slide.type === "video") {
      return (
        <div className="relative w-full h-full">
          <iframe
            src={slide.embedUrl}
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>
      );
    }
    if (slide.type === "photo") {
      return (
        <img
          src={slide.url}
          alt=""
          className="w-full h-full object-cover cursor-pointer"
          loading="lazy"
          onClick={(e) => { e.stopPropagation(); onPhotoTap(slide.index); }}
        />
      );
    }
    // Map slide
    return (
      <div className="relative w-full h-full cursor-pointer" onClick={(e) => { e.stopPropagation(); onMapTap(); }}>
        {mapVisible ? (
          <Suspense fallback={<div className="w-full h-full bg-muted animate-pulse" />}>
            <div className="[&_.leaflet-container]:!h-full [&>div]:!h-full pointer-events-none w-full h-full">
              <FlightDetailMap takeoff={takeoff} landing={landing} trackPoints={trackPoints || []} />
            </div>
          </Suspense>
        ) : (
          <div className="w-full h-full bg-muted animate-pulse" />
        )}
        {/* Stats overlay badges on map */}
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

  return (
    <DoubleTapHeart onDoubleTap={onDoubleTap}>
      <div className="relative">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {slides.map((slide, i) => (
              <div key={i} className="flex-[0_0_100%] min-w-0 aspect-[4/5] bg-muted overflow-hidden">
                {renderSlide(slide)}
              </div>
            ))}
          </div>
        </div>
        {/* Counter top-right */}
        <div className="absolute top-3 right-3 bg-black/60 text-white text-xs font-medium px-2 py-0.5 rounded-full z-10">
          {selected + 1}/{slides.length}
        </div>
        {/* Pagination dots */}
        {slides.length > 1 && slides.length <= 10 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
            {slides.map((_, i) => (
              <div key={i} className={cn("w-1.5 h-1.5 rounded-full transition-colors", i === selected ? "bg-white" : "bg-white/40")} />
            ))}
          </div>
        )}
      </div>
    </DoubleTapHeart>
  );
}

export default function FeedCard({ flight, onReact, onComment, onBookmarkToggle, onCommentLike, groupMembers }: FeedCardProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showComments, setShowComments] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const initials = flight.pilot_name ? flight.pilot_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "?";

  const hasPhotos = flight.photoUrls.length > 0;
  const hasVideos = flight.videoUrls && flight.videoUrls.length > 0;
  const showMap = flight.hasTrack || flight.takeoff || flight.landing;
  const trackPoints = useTrackPoints(flight.id, flight.hasTrack);

  // Build unified slide array
  const slides: MediaSlide[] = [];
  if (hasVideos) {
    for (const url of flight.videoUrls) {
      const embedUrl = getYoutubeEmbedUrl(url);
      if (embedUrl) slides.push({ type: "video", embedUrl });
    }
  }
  if (hasPhotos) {
    flight.photoUrls.forEach((url, i) => slides.push({ type: "photo", url, index: i }));
  }
  if (showMap) {
    slides.push({ type: "map" });
  }

  const handleDoubleTapLike = useCallback(() => {
    const isLiked = flight.likes.some(l => l.user_id === user?.id);
    if (!isLiked) onReact(flight.id, "heart");
  }, [flight.likes, user?.id, onReact, flight.id]);

  const handleSubmitComment = (msg: string) => onComment(flight.id, msg);

  const likeCount = flight.likes.length;

  return (
    <>
      <Card className="border-0 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-3 pb-2">
          <div className="p-[2px] rounded-full bg-gradient-to-tr from-primary via-secondary to-accent cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/pilot/${flight.user_id}`); }}>
            <Avatar className="h-8 w-8 border-2 border-background">
              <AvatarImage src={flight.avatar_url} />
              <AvatarFallback className="text-xs bg-muted">{initials}</AvatarFallback>
            </Avatar>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate cursor-pointer" onClick={() => navigate(`/pilot/${flight.user_id}`)}>{flight.pilot_name}</p>
            <p className="text-[11px] text-muted-foreground">
              {flight.group_name && <span>{flight.group_name} · </span>}
              {flight.takeoff_name && <><MapPin className="h-3 w-3 inline mr-0.5" />{flight.takeoff_name} · </>}
              {relativeTime(flight.published_at || flight.created_at, t)}
            </p>
          </div>
        </div>

        {/* Unified Media Carousel */}
        <UnifiedMediaCarousel
          slides={slides}
          onDoubleTap={handleDoubleTapLike}
          onPhotoTap={(idx) => { setLightboxIndex(idx); setLightboxOpen(true); }}
          onMapTap={() => navigate(`/flights/${flight.id}`)}
          takeoff={flight.takeoff}
          landing={flight.landing}
          trackPoints={trackPoints}
          durationMin={flight.duration_minutes}
          distanceKm={flight.distance_km}
        />

        {/* Actions */}
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-3">
            <ReactionPicker
              reactions={flight.likes}
              currentUserId={user?.id}
              onReact={(type) => onReact(flight.id, type)}
            />
            <button onClick={() => setShowComments(!showComments)} className="active:scale-90 transition-transform">
              <MessageCircle className="h-6 w-6" />
            </button>
            <div className="flex-1" />
            {onBookmarkToggle && (
              <button onClick={() => onBookmarkToggle(flight.id)} className="active:scale-90 transition-transform">
                <Bookmark className={cn("h-6 w-6", flight.isBookmarked ? "fill-foreground text-foreground" : "text-foreground")} />
              </button>
            )}
          </div>

          {/* "Gefällt X Personen" */}
          {likeCount > 0 && (
            <p className="text-sm font-semibold">
              {t("feed.likedBy", { count: likeCount, defaultValue: `Gefällt {{count}} Personen` })}
            </p>
          )}

          <ReactionBadges reactions={flight.likes} />

          {flight.feedDescription && (
            <p className="text-sm">
              <span className="font-semibold mr-1">{flight.pilot_name}</span>
              <span className="text-muted-foreground">{flight.feedDescription}</span>
            </p>
          )}

          {flight.glider && (
            <p className="text-sm text-muted-foreground">
              🪂 {flight.glider}
              {flight.altitude_gain ? ` · ↑${flight.altitude_gain}m` : ""}
              {flight.landing_name ? ` · → ${flight.landing_name}` : ""}
            </p>
          )}

          {/* Comments — Instagram style */}
          {(showComments || flight.comments.length > 0) && (
            <div className="space-y-2 pt-1">
              {!showComments && flight.comments.length > 2 && (
                <button onClick={() => setShowComments(true)} className="text-xs text-muted-foreground">
                  {t("feed.viewAllComments", { count: flight.comments.length })}
                </button>
              )}
              {(showComments ? flight.comments : flight.comments.slice(-2)).map(c => (
                <div key={c.id} className="flex items-start gap-2 group">
                  <div className="flex-1">
                    <p className="text-sm">
                      <span className="font-semibold mr-1">{c.pilot_name}</span>
                      {c.message}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{relativeTime(c.created_at, t)}</span>
                      {onCommentLike && (
                        <button
                          onClick={() => onCommentLike(c.id)}
                          className="text-[10px] text-muted-foreground hover:text-red-500 font-medium active:scale-90 transition-transform"
                        >
                          ♥ {c.like_count ? c.like_count : ""}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <MentionCommentInput onSubmit={handleSubmitComment} members={groupMembers} />
        </CardContent>
      </Card>

      {/* Fullscreen Photo Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-none w-screen h-screen p-0 border-0 bg-black/95 flex items-center justify-center [&>button]:hidden">
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 z-50 text-white/80 hover:text-white"
          >
            <X className="h-7 w-7" />
          </button>
          {flight.photoUrls.length > 0 && (
            <LightboxCarousel urls={flight.photoUrls} startIndex={lightboxIndex} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function LightboxCarousel({ urls, startIndex }: { urls: string[]; startIndex: number }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, startIndex });
  const [selected, setSelected] = useState(startIndex);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  return (
    <div className="w-full h-full relative">
      <div className="overflow-hidden h-full" ref={emblaRef}>
        <div className="flex h-full">
          {urls.map((url, i) => (
            <div key={i} className="flex-[0_0_100%] min-w-0 h-full flex items-center justify-center">
              <img src={url} alt="" className="max-w-full max-h-full object-contain" />
            </div>
          ))}
        </div>
      </div>
      {urls.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5">
          {urls.map((_, i) => (
            <div key={i} className={cn("w-2 h-2 rounded-full transition-colors", i === selected ? "bg-white" : "bg-white/40")} />
          ))}
        </div>
      )}
    </div>
  );
}
