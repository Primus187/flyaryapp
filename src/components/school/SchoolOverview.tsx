import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Calendar, ClipboardList, Plus, Send, Receipt, Gauge } from "lucide-react";
import SchoolSetupCard from "./SchoolSetupCard";
import SchoolInvite from "./SchoolInvite";
import { licensedCompletionsInWindow, shvMinimumPerformanceStatus, type ShvMinimumPerformanceStatus } from "@/lib/annual-report";

interface Props {
  groupId: string;
  studentCount: number;
  nextEvent: { id: string; title: string; event_date: string } | null;
  openNotesCount: number;
}

const SHV_AMPEL_STYLES: Record<ShvMinimumPerformanceStatus, string> = {
  ok: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  critical: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

export default function SchoolOverview({ groupId, studentCount, nextEvent, openNotesCount }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [openBilling, setOpenBilling] = useState(0);
  const [nextSignups, setNextSignups] = useState<number | null>(null);
  const [shvStatus, setShvStatus] = useState<{ status: ShvMinimumPerformanceStatus; count: number } | null>(null);

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("billing_items" as any)
        .select("amount, paid_at")
        .eq("group_id", groupId);
      if (cancelled) return;
      const total = ((data as any[]) || [])
        .filter((i) => !i.paid_at)
        .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
      setOpenBilling(Math.round(total * 100) / 100);
    };
    load();
    return () => { cancelled = true; };
  }, [groupId]);

  useEffect(() => {
    if (!nextEvent) { setNextSignups(null); return; }
    let cancelled = false;
    supabase
      .from("event_signups")
      .select("id", { count: "exact", head: true })
      .eq("event_id", nextEvent.id)
      .eq("signed_up", true)
      .then(({ count }) => { if (!cancelled) setNextSignups(count || 0); });
    return () => { cancelled = true; };
  }, [nextEvent?.id]);

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet
      .from("training_level_history" as any)
      .select("user_id, training_level, changed_at")
      .eq("group_id", groupId)
      .then(({ data }) => {
        if (cancelled) return;
        const history = (data as { user_id: string; training_level: string; changed_at: string }[]) || [];
        const count = licensedCompletionsInWindow(history, new Date().getFullYear());
        setShvStatus({ status: shvMinimumPerformanceStatus(count), count });
      });
    return () => { cancelled = true; };
  }, [groupId]);

  const kpis = [
    { icon: Users, label: t("school.activeStudents"), value: studentCount },
    { icon: ClipboardList, label: t("school.openReviews"), value: openNotesCount },
    { icon: Receipt, label: t("school.billing.openTotal"), value: openBilling.toFixed(2) },
  ];

  return (
    <div className="space-y-4">
      <SchoolSetupCard groupId={groupId} />
      <SchoolInvite groupId={groupId} />

      <div className="grid grid-cols-3 gap-3">
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

      {shvStatus && (
        <Card className={`border-0 shadow-sm ${SHV_AMPEL_STYLES[shvStatus.status]}`}>
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
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase font-semibold">{t("school.nextFlightDay")}</p>
            <p className="font-medium mt-1">{nextEvent.title}</p>
            <p className="text-sm text-muted-foreground">
              {new Date(nextEvent.event_date).toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "short" })}
              {nextSignups !== null ? ` · ${t("school.signupsCount", { count: nextSignups })}` : ""}
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
          <span className="text-xs">{t("school.announce")}</span>
        </Button>
      </div>
    </div>
  );
}
