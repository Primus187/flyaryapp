import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ClipboardCheck, MapPin, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EventListItemProps {
  title: string;
  /** ISO-Datum des Termins. */
  date: string;
  /** announced | confirmed | cancelled */
  status?: string | null;
  category?: string | null;
  groupName?: string | null;
  meetingPoint?: string | null;
  signedUpCount?: number | null;
  maxParticipants?: number | null;
  /** Anzahl Kontrollblatt-Notizen (nur Flugschule). */
  notesCount?: number | null;
  past?: boolean;
  onClick?: () => void;
  /** Aktion rechts, z. B. Anmelde-Knopf. Ohne Aktion erscheint ein Pfeil. */
  action?: React.ReactNode;
  locale?: string;
}

/** Gemeinsame Terminzeile für Terminliste und Flugschul-Flugtage. */
export default function EventListItem({
  title, date, status, category, groupName, meetingPoint,
  signedUpCount, maxParticipants, notesCount, past, onClick, action, locale = "de-CH",
}: EventListItemProps) {
  const { t } = useTranslation();

  const statusLabel = status === "confirmed"
    ? t("events.statusConfirmed")
    : status === "cancelled"
      ? t("events.statusCancelled")
      : t("events.statusAnnounced");
  const statusColor = status === "confirmed"
    ? "bg-green-100 text-green-800 hover:bg-green-100/80 dark:bg-green-900/30 dark:text-green-400"
    : status === "cancelled"
      ? "bg-red-100 text-red-800 hover:bg-red-100/80 dark:bg-red-900/30 dark:text-red-400"
      : "bg-blue-100 text-blue-800 hover:bg-blue-100/80 dark:bg-blue-900/30 dark:text-blue-400";

  const meta = [
    new Date(date).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
    category ? t(`events.categories.${category}`, { defaultValue: category }) : null,
    groupName || null,
  ].filter(Boolean).join(" · ");

  return (
    <Card
      className={cn(
        "border-0 shadow-sm transition-colors",
        past ? "opacity-60" : "hover:bg-accent/50",
        onClick && !past ? "cursor-pointer active:scale-[0.99] transition-all" : "",
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2" onClick={onClick}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-medium text-sm truncate">{title}</p>
              {status && <Badge className={cn("text-[10px] shrink-0", statusColor)}>{statusLabel}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">{meta}</p>
            {meetingPoint && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 shrink-0" /> {meetingPoint}
              </p>
            )}
            <div className="flex items-center gap-3 mt-0.5">
              {signedUpCount != null && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {signedUpCount}{maxParticipants ? `/${maxParticipants}` : ""} {t("events.signedUp")}
                </span>
              )}
              {notesCount != null && notesCount > 0 && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <ClipboardCheck className="h-3 w-3" /> {notesCount} {t("school.notes")}
                </span>
              )}
            </div>
          </div>
          {action ?? <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />}
        </div>
      </CardContent>
    </Card>
  );
}
