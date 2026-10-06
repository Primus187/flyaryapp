import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Calendar, ClipboardList, Plus, Send, Receipt, Gauge } from "lucide-react";
import SchoolSetupCard from "./SchoolSetupCard";
import SchoolInvite from "./SchoolInvite";
import { shvMinimumPerformanceStatus, type ShvMinimumPerformanceStatus } from "@/lib/annual-report";

interface Props {
  groupId: string;
  studentCount: number;
  nextEvent: { id: string; title: string; event_date: string } | null;
  openNotesCount: number;
  openBilling: number;
  nextSignups: number;
  licensedCount: number;
}

const SHV_AMPEL_STYLES: Record<ShvMinimumPerformanceStatus, string> = {
  ok: "bg-success-soft text-success-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  critical: "bg-destructive-soft text-destructive",
};

export default function SchoolOverview({ groupId, studentCount, nextEvent, openNotesCount, openBilling, nextSignups, licensedCount }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const shvStatus = { status: shvMinimumPerformanceStatus(licensedCount), count: licensedCount };

  const kpis = [
    { icon: Users, label: t("school.activeStudents"), value: studentCount },
    { icon: ClipboardList, label: t("school.openReviews"), value: openNotesCount },
    { icon: Receipt, label: t("school.billing.openTotal"), value: openBilling.toFixed(2) },
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-primary/5 p-4 space-y-3">
        <h2 className="font-semibold">{t("journeys.schoolTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("journeys.schoolHint")}</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigate("/school/days")}>{t("school.flightDays")}</Button>
          <Button variant="outline" onClick={() => navigate("/school/students")}>{t("school.students")}</Button>
          <Button variant="outline" onClick={() => navigate("/school/teamChat")}>{t("school.teamChat.title")}</Button>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-3">
        {kpis.map(({ icon: Icon, label, value }) => (
          <Card key={label}>
            <CardContent className="p-4 flex flex-col items-center gap-1">
              <Icon className="h-5 w-5 text-primary" />
              <span className="text-2xl stat-value">{value}</span>
              <span className="text-[11px] font-semibold text-muted-foreground text-center">{label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {shvStatus && (
        <Card className={`${SHV_AMPEL_STYLES[shvStatus.status]}`}>
          <CardContent className="p-4 flex items-center gap-3">
            <Gauge className="h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-medium">{t(`school.shvAmpel.${shvStatus.status}`)}</p>
              <p className="text-xs opacity-80">{t("school.shvAmpel.count", { count: shvStatus.count })}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {nextEvent && (
        <Card className="rounded-3xl bg-hero text-hero-foreground border-0">
          <CardContent className="space-y-3 p-[18px]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-hero-muted">{t("school.nextFlightDay")}</p>
                <p className="text-xl leading-[26px] font-extrabold tracking-tight">{nextEvent.title}</p>
                <p className="text-[13px] font-medium text-hero-muted">
                  {new Date(nextEvent.event_date).toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "short" })}
                  {nextSignups !== null ? ` · ${t("school.signupsCount", { count: nextSignups })}` : ""}
                </p>
              </div>
              {nextSignups !== null && <p className="shrink-0 text-[30px] leading-9 stat-value">{nextSignups}</p>}
            </div>
            <Button className="w-full bg-white/10 text-hero-foreground hover:bg-white/15" onClick={() => navigate(`/events/${nextEvent.id}`)}>
              <Calendar className="h-4 w-4" />
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
        <Button variant="outline" disabled={!nextEvent} className="h-auto py-3 flex-col gap-1" onClick={() => nextEvent ? navigate(`/events/${nextEvent.id}`) : null}>
          <Send className="h-4 w-4" />
          <span className="text-xs">{t("school.announce")}</span>
        </Button>
      </div>
      <SchoolSetupCard groupId={groupId} />
      <SchoolInvite groupId={groupId} />
    </div>
  );
}
