import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, MapPin, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import MentionCommentInput from "@/components/MentionCommentInput";
import useEmblaCarousel from "embla-carousel-react";
import DoubleTapHeart from "@/components/DoubleTapHeart";

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
  trackPoints: [number, number][];
  takeoff: { latitude: number; longitude: number; name?: string } | null;
  landing: { latitude: number; longitude: number; name?: string } | null;
  likes: { user_id: string }[];
  comments: { id: string; user_id: string; message: string; created_at: string; pilot_name: string; like_count?: number }[];
  isBookmarked?: boolean;
}

interface FeedCardProps {
  flight: FeedFlight;
  onLikeToggle: (flightId: string) => void;
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

function PhotoCarousel({ urls }: { urls: string[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  if (urls.length === 1) {
    return (
      <div className="aspect-square w-full overflow-hidden bg-muted">
        <img src={urls[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {urls.map((url, i) => (
            <div key={i} className="flex-[0_0_100%] min-w-0 aspect-square bg-muted">
              <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      </div>
      {urls.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {urls.map((_, i) => (
            <div key={i} className={cn("w-1.5 h-1.5 rounded-full transition-colors", i === selected ? "bg-white" : "bg-white/40")} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FeedCard({ flight, onLikeToggle, onComment, onBookmarkToggle, onCommentLike, groupMembers }: FeedCardProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showComments, setShowComments] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);

  const isLiked = flight.likes.some(l => l.user_id === user?.id);
  const initials = flight.pilot_name ? flight.pilot_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "?";
  const hasTrack = flight.trackPoints.length > 0;
  const hasPhotos = flight.photoUrls.length > 0;
  const hasVideos = flight.videoUrls && flight.videoUrls.length > 0;

  const formatDuration = (min: number) => {
    const h = Math.floor(min / 60); const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const handleLike = useCallback(() => {
    if (!isLiked) {
      setLikeAnimating(true);
      setTimeout(() => setLikeAnimating(false), 400);
    }
    onLikeToggle(flight.id);
  }, [isLiked, onLikeToggle, flight.id]);

  const handleDoubleTapLike = useCallback(() => {
    if (!isLiked) {
      onLikeToggle(flight.id);
    }
    setLikeAnimating(true);
    setTimeout(() => setLikeAnimating(false), 400);
  }, [isLiked, onLikeToggle, flight.id]);

  const handleSubmitComment = (msg: string) => {
    onComment(flight.id, msg);
  };

  return (
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

      {/* Videos */}
      {hasVideos && (
        <DoubleTapHeart onDoubleTap={handleDoubleTapLike}>
          <div className="space-y-0">
            {flight.videoUrls.map((url, i) => {
              const embedUrl = getYoutubeEmbedUrl(url);
              return embedUrl ? (
                <div key={i} className="relative w-full aspect-video bg-muted">
                  <iframe
                    src={embedUrl}
                    title="YouTube video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                </div>
              ) : null;
            })}
          </div>
        </DoubleTapHeart>
      )}

      {/* Photos with double-tap like */}
      {hasPhotos && (
        <DoubleTapHeart onDoubleTap={handleDoubleTapLike}>
          <PhotoCarousel urls={flight.photoUrls} />
        </DoubleTapHeart>
      )}

      {/* Mini Map */}
      {(hasTrack || flight.takeoff || flight.landing) && (
        <DoubleTapHeart onDoubleTap={handleDoubleTapLike}>
          <div className="relative cursor-pointer" onClick={() => navigate(`/flights/${flight.id}`)}>
            <Suspense fallback={<div className="h-[150px] bg-muted animate-pulse" />}>
              <div className="[&_.leaflet-container]:!h-[150px] [&>div]:!h-[150px] pointer-events-none" style={{ height: 150, overflow: "hidden" }}>
                <FlightDetailMap takeoff={flight.takeoff} landing={flight.landing} trackPoints={flight.trackPoints} />
              </div>
            </Suspense>
            <div className="absolute bottom-2 left-2 flex gap-1.5 z-10">
              {flight.duration_minutes && (
                <span className="bg-background/80 backdrop-blur-sm text-foreground text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm">
                  ⏱ {formatDuration(flight.duration_minutes)}
                </span>
              )}
              {flight.distance_km && (
                <span className="bg-background/80 backdrop-blur-sm text-foreground text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm">
                  ↔ {Number(flight.distance_km).toFixed(1)}km
                </span>
              )}
            </div>
          </div>
        </DoubleTapHeart>
      )}

      {/* Actions */}
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-3">
          <button onClick={handleLike} className="active:scale-90 transition-transform">
            <Heart className={cn("h-6 w-6 transition-transform", isLiked ? "fill-red-500 text-red-500" : "text-foreground", likeAnimating && "animate-like-bounce")} />
          </button>
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

        {flight.likes.length > 0 && (
          <p className="text-sm font-semibold">{flight.likes.length} {flight.likes.length === 1 ? "Like" : "Likes"}</p>
        )}

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

        {/* Comments */}
        {(showComments || flight.comments.length > 0) && (
          <div className="space-y-1.5 pt-1">
            {!showComments && flight.comments.length > 2 && (
              <button onClick={() => setShowComments(true)} className="text-xs text-muted-foreground">
                {t("feed.viewAllComments", { count: flight.comments.length })}
              </button>
            )}
            {(showComments ? flight.comments : flight.comments.slice(-2)).map(c => (
              <div key={c.id} className="flex items-start gap-1 group">
                <p className="text-sm flex-1">
                  <span className="font-semibold mr-1">{c.pilot_name}</span>
                  {c.message}
                </p>
                {onCommentLike && (
                  <button
                    onClick={() => onCommentLike(c.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5 active:scale-90"
                  >
                    <Heart className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <MentionCommentInput onSubmit={handleSubmitComment} members={groupMembers} />
      </CardContent>
    </Card>
  );
}
