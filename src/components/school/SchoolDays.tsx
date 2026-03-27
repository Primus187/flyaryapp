import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Users, ClipboardCheck, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface EventInfo {
  id: string;
  title: string;
  event_date: string;
  participantCount: number;
  notesCount: number;
  status: string;
}

interface Props {
  events: EventInfo[];
}

export default function SchoolDays({ events }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        {t("school.noFlightDays")}
      </div>
    );
  }

  const isPast = (date: string) => new Date(date) < new Date();

  return (
    <div className="space-y-2">
      {events.map((ev) => (
        <Card
          key={ev.id}
          className="border-0 shadow-sm cursor-pointer hover:bg-muted/30 active:scale-[0.99] transition-all"
          onClick={() => navigate(`/events/${ev.id}`)}
        >
          <CardContent className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    {new Date(ev.event_date).toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  {ev.status === "cancelled" && (
                    <Badge variant="destructive" className="text-[9px] px-1 py-0">{t("events.cancelled")}</Badge>
                  )}
                </div>
                <p className="font-medium text-sm mt-1 truncate">{ev.title}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> {ev.participantCount}
                  </span>
                  {ev.notesCount > 0 && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <ClipboardCheck className="h-3 w-3" /> {ev.notesCount} {t("school.notes")}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
