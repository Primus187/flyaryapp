import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, MapPin, Users, Clock, ChevronRight, MessageCircle, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import MentionCommentInput from "@/components/MentionCommentInput";
import ReactionPicker, { ReactionBadges, type ReactionType } from "@/components/ReactionPicker";

export interface FeedEvent {
  id: string;
  title: string;
  description: string | null;
  feed_description: string | null;
  event_date: string;
  event_type: string | null;
  meeting_point: string | null;
  max_participants: number | null;
  status: string;
  group_name: string;
  created_at: string;
  published_at: string | null;
  signup_count: number;
  user_signed_up: boolean;
  pilot_name: string;
  avatar_url: string;
  created_by: string;
  photos: { id: string; url: string }[];
  likes: { user_id: string; reaction_type: string }[];
  comments: { id: string; user_id: string; message: string; created_at: string; pilot_name: string }[];
  isBookmarked?: boolean;
}

interface FeedEventCardProps {
  event: FeedEvent;
  onSignup?: (eventId: string) => void;
  onReact: (eventId: string, reactionType: ReactionType) => void;
  onComment: (eventId: string, message: string) => void;
  onBookmarkToggle?: (eventId: string) => void;
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

export default function FeedEventCard({ event, onSignup, onReact, onComment, onBookmarkToggle, onCommentLike, groupMembers }: FeedEventCardProps) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [showComments, setShowComments] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";
  const eventDate = new Date(event.event_date);
  const isPast = eventDate < new Date();
  const isCancelled = event.status === "cancelled";
  const initials = event.pilot_name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";

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

  const handleSubmitComment = (msg: string) => {
    onComment(event.id, msg);
  };

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 p-3 pb-2">
        <button onClick={() => navigate(`/pilot/${event.created_by}`)} className="shrink-0">
          <div className="p-[2px] rounded-full bg-gradient-to-tr from-primary via-secondary to-accent">
            <Avatar className="h-8 w-8 border-2 border-background">
              <AvatarImage src={event.avatar_url} />
              <AvatarFallback className="text-xs bg-muted">{initials}</AvatarFallback>
            </Avatar>
          </div>
        </button>
        <div className="flex-1 min-w-0">
          <button onClick={() => navigate(`/pilot/${event.created_by}`)} className="text-sm font-semibold truncate block">
            {event.pilot_name}
          </button>
          <p className="text-[11px] text-muted-foreground">
            {event.group_name} · {relativeTime(event.published_at || event.created_at, t)}
          </p>
        </div>
        <Badge className={`${statusColor} border-0 shrink-0 text-[10px]`}>{statusLabel}</Badge>
      </div>

      {event.photos.length > 0 && (
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          <img src={event.photos[photoIndex]?.url} alt="" className="w-full h-full object-cover" />
          {event.photos.length > 1 && (
            <>
              {photoIndex > 0 && (
                <button onClick={() => setPhotoIndex(i => i - 1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full w-7 h-7 flex items-center justify-center">‹</button>
              )}
              {photoIndex < event.photos.length - 1 && (
                <button onClick={() => setPhotoIndex(i => i + 1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full w-7 h-7 flex items-center justify-center">›</button>
              )}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {event.photos.map((_, i) => (
                  <div key={i} className={cn("w-1.5 h-1.5 rounded-full transition-colors", i === photoIndex ? "bg-white" : "bg-white/40")} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="relative px-4 py-3 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent">
        <h3 className="text-base font-bold truncate">{event.title}</h3>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{eventDate.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })}</span>
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{eventDate.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</span>
          {event.meeting_point && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{event.meeting_point}</span>}
        </div>
      </div>

      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{event.signup_count}{event.max_participants ? `/${event.max_participants}` : ""} {t("feed.participants")}</span>
          </div>
          <div className="flex items-center gap-2">
            {!isPast && !isCancelled && onSignup && (
              <Button size="sm" variant={event.user_signed_up ? "secondary" : "default"} className="h-7 text-xs rounded-full px-3" onClick={() => onSignup(event.id)}>
                {event.user_signed_up ? t("events.signedUpLabel") : t("events.signUp")}
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => navigate(`/events/${event.id}`)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1 border-t border-border/50">
          <ReactionPicker
            reactions={event.likes}
            currentUserId={user?.id}
            onReact={(type) => onReact(event.id, type)}
            size="sm"
          />
          <button onClick={() => setShowComments(!showComments)} className="active:scale-90 transition-transform">
            <MessageCircle className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          {onBookmarkToggle && (
            <button onClick={() => onBookmarkToggle(event.id)} className="active:scale-90 transition-transform">
              <Bookmark className={cn("h-5 w-5", event.isBookmarked ? "fill-foreground text-foreground" : "text-foreground")} />
            </button>
          )}
        </div>

        <ReactionBadges reactions={event.likes} />

        {event.feed_description && (
          <p className="text-sm">
            <span className="font-semibold mr-1">{event.pilot_name}</span>
            <span className="text-muted-foreground">{event.feed_description}</span>
          </p>
        )}

        {(showComments || event.comments.length > 0) && (
          <div className="space-y-1.5">
            {!showComments && event.comments.length > 2 && (
              <button onClick={() => setShowComments(true)} className="text-xs text-muted-foreground">
                {t("feed.viewAllComments", { count: event.comments.length })}
              </button>
            )}
            {(showComments ? event.comments : event.comments.slice(-2)).map(c => (
              <div key={c.id} className="flex items-start gap-1 group">
                <p className="text-sm flex-1">
                  <span className="font-semibold mr-1">{c.pilot_name}</span>{c.message}
                </p>
                {onCommentLike && (
                  <button onClick={() => onCommentLike(c.id)} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5 active:scale-90">
                    <span className="text-xs text-muted-foreground hover:text-red-500">❤️</span>
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
