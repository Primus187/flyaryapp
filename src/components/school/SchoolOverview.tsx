import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Calendar, ClipboardList, Plus, Send } from "lucide-react";

interface Props {
  groupId: string;
  studentCount: number;
  nextEvent: { id: string; title: string; event_date: string } | null;
  openNotesCount: number;
}

export default function SchoolOverview({ groupId, studentCount, nextEvent, openNotesCount }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const kpis = [
    { icon: Users, label: t("school.activeStudents"), value: studentCount },
    { icon: ClipboardList, label: t("school.openReviews"), value: openNotesCount },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {kpis.map(({ icon: Icon, label, value }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex flex-col items-center gap-1">
              <Icon className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{value}</span>
              <span className="text-[10px] text-muted-foreground text-center">{label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {nextEvent && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase font-semibold">{t("school.nextFlightDay")}</p>
            <p className="font-medium mt-1">{nextEvent.title}</p>
            <p className="text-sm text-muted-foreground">
              {new Date(nextEvent.event_date).toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "short" })}
            </p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => navigate(`/events/${nextEvent.id}`)}>
              <Calendar className="h-3.5 w-3.5 mr-1" />
              {t("school.openEvent")}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => navigate(`/events/new?group=${groupId}`)}>
          <Plus className="h-4 w-4" />
          <span className="text-xs">{t("school.newFlightDay")}</span>
        </Button>
        <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => nextEvent ? navigate(`/events/${nextEvent.id}`) : null}>
          <Send className="h-4 w-4" />
          <span className="text-xs">{t("school.telegram")}</span>
        </Button>
      </div>
    </div>
  );
}
