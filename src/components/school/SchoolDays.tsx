import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import EventListItem from "@/components/events/EventListItem";

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
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        {t("school.noFlightDays")}
      </div>
    );
  }

  const now = new Date();

  return (
    <div className="space-y-2">
      {events.map((ev) => (
        <EventListItem
          key={ev.id}
          title={ev.title}
          date={ev.event_date}
          status={ev.status}
          signedUpCount={ev.participantCount}
          notesCount={ev.notesCount}
          past={new Date(ev.event_date) < now}
          locale={locale}
          onClick={() => navigate(`/events/${ev.id}`)}
        />
      ))}
    </div>
  );
}
