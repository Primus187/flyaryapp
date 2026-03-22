import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, Clock, ChevronRight } from "lucide-react";

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
}

interface FeedEventCardProps {
  event: FeedEvent;
  onSignup?: (eventId: string) => void;
}

export default function FeedEventCard({ event, onSignup }: FeedEventCardProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";
  const eventDate = new Date(event.event_date);
  const isPast = eventDate < new Date();
  const isCancelled = event.status === "cancelled";

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

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      {/* Gradient header */}
      <div className="relative px-4 py-5 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{event.group_name}</p>
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

      <CardContent className="p-3 space-y-3">
        {event.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
        )}

        {event.event_type && (
          <Badge variant="outline" className="text-[10px]">{event.event_type}</Badge>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>
              {event.signup_count}{event.max_participants ? `/${event.max_participants}` : ""} {t("feed.participants")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isPast && !isCancelled && onSignup && (
              <Button
                size="sm"
                variant={event.user_signed_up ? "secondary" : "default"}
                className="h-7 text-xs rounded-full px-3"
                onClick={() => onSignup(event.id)}
              >
                {event.user_signed_up ? t("events.signedUpLabel") : t("events.signUp")}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs px-2"
              onClick={() => navigate(`/events/${event.id}`)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
