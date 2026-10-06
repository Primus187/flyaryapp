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
    ? "bg-success-soft text-success-soft-foreground "
    : status === "cancelled"
      ? "bg-destructive-soft text-destructive-soft-foreground "
      : "bg-accent text-accent-foreground ";

  const meta = [
    new Date(date).toLocaleDateString(locale, { weekday: "short" }),
    category ? t(`events.categories.${category}`, { defaultValue: category }) : null,
    groupName || null,
  ].filter(Boolean).join(" · ");

  return (
    <Card
      className={cn(
        "transition-colors",
        past ? "opacity-60" : "hover:bg-accent/50",
        onClick && !past ? "cursor-pointer active:scale-[0.99] transition-all" : "",
      )}
    >
      <CardContent className="p-3.5">
        <div className="flex items-start gap-3" onClick={onClick}>
          <div className="w-10 shrink-0">
            <p className="text-2xl leading-[26px] stat-value">{String(new Date(date).getDate()).padStart(2, "0")}</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{new Date(date).toLocaleDateString(locale, { month: "short" }).replace(".", "")}</p>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="truncate text-[15px] font-bold">{title}</p>
            </div>
            <p className="text-[13px] font-medium text-muted-foreground">{meta}</p>
            {status && <Badge className={cn("mt-1.5", statusColor)}>{statusLabel}</Badge>}
            {meetingPoint && (
              <p className="text-[13px] font-medium text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" /> {meetingPoint}
              </p>
            )}
            <div className="flex items-center gap-3 mt-0.5">
              {signedUpCount != null && (
                <span className="text-[13px] font-medium text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {signedUpCount}{maxParticipants ? `/${maxParticipants}` : ""} {t("events.signedUp")}
                </span>
              )}
              {notesCount != null && notesCount > 0 && (
                <span className="text-[13px] font-medium text-muted-foreground flex items-center gap-1">
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
