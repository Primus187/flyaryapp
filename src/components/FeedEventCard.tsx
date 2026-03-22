import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar, MapPin, Users, Clock, ChevronRight, Heart, MessageCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FeedEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_type: string | null;
  meeting_point: string | null;
  max_participants: number | null;
  status: string;
  group_name: string;
  created_at: string;
  signup_count: number;
  user_signed_up: boolean;
  likes: { user_id: string }[];
  comments: { id: string; user_id: string; message: string; created_at: string; pilot_name: string }[];
}

interface FeedEventCardProps {
  event: FeedEvent;
  onSignup?: (eventId: string) => void;
  onLikeToggle: (eventId: string) => void;
  onComment: (eventId: string, message: string) => void;
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

export default function FeedEventCard({ event, onSignup, onLikeToggle, onComment }: FeedEventCardProps) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [comment, setComment] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);

  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";
  const eventDate = new Date(event.event_date);
  const isPast = eventDate < new Date();
  const isCancelled = event.status === "cancelled";
  const isLiked = event.likes.some(l => l.user_id === user?.id);

  const statusColor = isCancelled
    ? "bg-destructive/20 text-destructive"
    : event.status === "confirmed"
    ? "bg-emerald-500/20 text-emerald-400"
    : "bg-amber-500/20 text-amber-400";

  const statusLabel = isCancelled
    ? t("events.statusCancelled")
    : event.status === "confirmed"
    ? t("events.statusConfirmed")
    : t("events.statusAnnounced");

  const handleLike = useCallback(() => {
    if (!isLiked) {
      setLikeAnimating(true);
      setTimeout(() => setLikeAnimating(false), 400);
    }
    onLikeToggle(event.id);
  }, [isLiked, onLikeToggle, event.id]);

  const handleSubmitComment = () => {
    if (!comment.trim()) return;
    onComment(event.id, comment.trim());
    setComment("");
  };

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className="relative px-4 py-5 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              {event.group_name} · {relativeTime(event.created_at, t)}
            </p>
            <h3 className="text-base font-bold truncate">{event.title}</h3>
          </div>
          <Badge className={`${statusColor} border-0 shrink-0 text-[10px]`}>{statusLabel}</Badge>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {eventDate.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {eventDate.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
          </span>
          {event.meeting_point && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {event.meeting_point}
            </span>
          )}
        </div>
      </div>

      <CardContent className="p-3 space-y-2">
        {event.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{event.signup_count}{event.max_participants ? `/${event.max_participants}` : ""} {t("feed.participants")}</span>
          </div>
          <div className="flex items-center gap-2">
            {!isPast && !isCancelled && onSignup && (
              <Button size="sm" variant={event.user_signed_up ? "secondary" : "default"}
                className="h-7 text-xs rounded-full px-3" onClick={() => onSignup(event.id)}>
                {event.user_signed_up ? t("events.signedUpLabel") : t("events.signUp")}
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 text-xs px-2"
              onClick={() => navigate(`/events/${event.id}`)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Social interactions */}
        <div className="flex items-center gap-3 pt-1 border-t border-border/50">
          <button onClick={handleLike} className="active:scale-90 transition-transform">
            <Heart className={cn(
              "h-5 w-5 transition-transform",
              isLiked ? "fill-red-500 text-red-500" : "text-foreground",
              likeAnimating && "animate-like-bounce"
            )} />
          </button>
          <button onClick={() => setShowComments(!showComments)} className="active:scale-90 transition-transform">
            <MessageCircle className="h-5 w-5" />
          </button>
        </div>

        {event.likes.length > 0 && (
          <p className="text-sm font-semibold">{event.likes.length} {event.likes.length === 1 ? "Like" : "Likes"}</p>
        )}

        {(showComments || event.comments.length > 0) && (
          <div className="space-y-1.5">
            {!showComments && event.comments.length > 2 && (
              <button onClick={() => setShowComments(true)} className="text-xs text-muted-foreground">
                {t("feed.viewAllComments", { count: event.comments.length })}
              </button>
            )}
            {(showComments ? event.comments : event.comments.slice(-2)).map(c => (
              <p key={c.id} className="text-sm">
                <span className="font-semibold mr-1">{c.pilot_name}</span>{c.message}
              </p>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Input value={comment} onChange={e => setComment(e.target.value)}
            placeholder={t("feed.addComment")}
            className="h-8 text-sm bg-muted/50 border-0"
            onKeyDown={e => e.key === "Enter" && handleSubmitComment()} />
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
