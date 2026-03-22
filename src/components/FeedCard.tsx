import { useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heart, MessageCircle, Send, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import useEmblaCarousel from "embla-carousel-react";

const FlightDetailMap = lazy(() => import("@/components/FlightDetailMap"));

export interface FeedFlight {
  id: string;
  date: string;
  created_at: string;
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
  trackPoints: [number, number][];
  takeoff: { latitude: number; longitude: number; name?: string } | null;
  landing: { latitude: number; longitude: number; name?: string } | null;
  likes: { user_id: string }[];
  comments: { id: string; user_id: string; message: string; created_at: string; pilot_name: string }[];
}

interface FeedCardProps {
  flight: FeedFlight;
  onLikeToggle: (flightId: string) => void;
  onComment: (flightId: string, message: string) => void;
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

export default function FeedCard({ flight, onLikeToggle, onComment }: FeedCardProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [comment, setComment] = useState("");
  const [showComments, setShowComments] = useState(false);

  const isLiked = flight.likes.some(l => l.user_id === user?.id);
  const initials = flight.pilot_name ? flight.pilot_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "?";
  const hasTrack = flight.trackPoints.length > 0;
  const hasPhotos = flight.photoUrls.length > 0;

  const formatDuration = (min: number) => {
    const h = Math.floor(min / 60); const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const handleSubmitComment = () => {
    if (!comment.trim()) return;
    onComment(flight.id, comment.trim());
    setComment("");
  };

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 pb-2 cursor-pointer" onClick={() => navigate(`/flights/${flight.id}`)}>
        <div className="p-[2px] rounded-full bg-gradient-to-tr from-primary via-secondary to-accent">
          <Avatar className="h-8 w-8 border-2 border-background">
            <AvatarImage src={flight.avatar_url} />
            <AvatarFallback className="text-xs bg-muted">{initials}</AvatarFallback>
          </Avatar>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{flight.pilot_name}</p>
          <p className="text-[11px] text-muted-foreground">
            {flight.group_name && <span>{flight.group_name} · </span>}
            {flight.takeoff_name && <><MapPin className="h-3 w-3 inline mr-0.5" />{flight.takeoff_name} · </>}
            {relativeTime(flight.created_at, t)}
          </p>
        </div>
      </div>

      {hasPhotos && <PhotoCarousel urls={flight.photoUrls} />}

      {/* Mini Map */}
      {(hasTrack || flight.takeoff || flight.landing) && (
        <Suspense fallback={<div className="h-[150px] bg-muted animate-pulse" />}>
          <div className="[&_.leaflet-container]:!h-[150px] [&>div]:!h-[150px]" style={{ height: 150, overflow: "hidden" }}>
            <FlightDetailMap
              takeoff={flight.takeoff}
              landing={flight.landing}
              trackPoints={flight.trackPoints}
            />
          </div>
        </Suspense>
      )}

      {/* Actions */}
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-3">
          <button onClick={() => onLikeToggle(flight.id)} className="active:scale-90 transition-transform">
            <Heart className={cn("h-6 w-6", isLiked ? "fill-red-500 text-red-500" : "text-foreground")} />
          </button>
          <button onClick={() => setShowComments(!showComments)} className="active:scale-90 transition-transform">
            <MessageCircle className="h-6 w-6" />
          </button>
        </div>

        {/* Like count */}
        {flight.likes.length > 0 && (
          <p className="text-sm font-semibold">{flight.likes.length} {flight.likes.length === 1 ? "Like" : "Likes"}</p>
        )}

        {/* Flight info */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {flight.glider && <span className="font-medium text-foreground">🪂 {flight.glider}</span>}
          {flight.duration_minutes && <span>⏱ {formatDuration(flight.duration_minutes)}</span>}
          {flight.altitude_gain && <span>↑ {flight.altitude_gain}m</span>}
          {flight.distance_km && <span>↔ {Number(flight.distance_km).toFixed(1)}km</span>}
          {flight.landing_name && <span>→ {flight.landing_name}</span>}
        </div>

        {/* Comments */}
        {(showComments || flight.comments.length > 0) && (
          <div className="space-y-1.5 pt-1">
            {!showComments && flight.comments.length > 2 && (
              <button onClick={() => setShowComments(true)} className="text-xs text-muted-foreground">
                {t("feed.viewAllComments", { count: flight.comments.length })}
              </button>
            )}
            {(showComments ? flight.comments : flight.comments.slice(-2)).map(c => (
              <p key={c.id} className="text-sm">
                <span className="font-semibold mr-1">{c.pilot_name}</span>
                {c.message}
              </p>
            ))}
          </div>
        )}

        {/* Add comment */}
        <div className="flex items-center gap-2 pt-1">
          <Input
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder={t("feed.addComment")}
            className="h-8 text-sm bg-muted/50 border-0"
            onKeyDown={e => e.key === "Enter" && handleSubmitComment()}
          />
          {comment.trim() && (
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={handleSubmitComment}>
              <Send className="h-4 w-4 text-primary" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
