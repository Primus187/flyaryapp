import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import RankedList from "@/components/stats/RankedList";
import { CalendarDays, MapPin, Users, GraduationCap } from "lucide-react";

interface Props {
  groupId: string;
}

interface EventRow {
  id: string;
  event_date: string;
  event_category: string | null;
  flight_area: string | null;
  status: string;
}

interface StaffRow {
  event_id: string;
  user_id: string;
  role: string;
}

export default function SchoolStats({ groupId }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [signups, setSignups] = useState<{ event_id: string; user_id: string }[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [year, setYear] = useState<string>("all");

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data: eventRows } = await supabase
        .from("flight_events")
        .select("id, event_date, event_category, flight_area, status")
        .eq("group_id", groupId)
        .order("event_date", { ascending: false });

      const evs = (eventRows || []) as EventRow[];
      const eventIds = evs.map((e) => e.id);

      let staffRows: StaffRow[] = [];
      let signupRows: { event_id: string; user_id: string }[] = [];
      if (eventIds.length > 0) {
        const [staffRes, signupRes] = await Promise.all([
          supabase.from("event_staff").select("event_id, user_id, role").in("event_id", eventIds),
          supabase.from("event_signups").select("event_id, user_id").in("event_id", eventIds).eq("signed_up", true),
        ]);
        staffRows = (staffRes.data || []) as StaffRow[];
        signupRows = (signupRes.data || []) as { event_id: string; user_id: string }[];
      }

      const userIds = Array.from(new Set(staffRows.map((s) => s.user_id)));
      const nameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("user_id, pilot_name").in("user_id", userIds);
        (profs || []).forEach((p: any) => { nameMap[p.user_id] = p.pilot_name || "—"; });
      }

      if (cancelled) return;
      setEvents(evs);
      setStaff(staffRows);
      setSignups(signupRows);
      setNames(nameMap);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [groupId]);

  const years = useMemo(() => {
    const set = new Set(events.map((e) => new Date(e.event_date).getFullYear().toString()));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [events]);

  const filteredEvents = useMemo(() => {
    const active = events.filter((e) => e.status !== "cancelled");
    if (year === "all") return active;
    return active.filter((e) => new Date(e.event_date).getFullYear().toString() === year);
  }, [events, year]);

  const eventIdSet = useMemo(() => new Set(filteredEvents.map((e) => e.id)), [filteredEvents]);

  const kpis = useMemo(() => {
    const heightFlights = filteredEvents.filter((e) => (e.event_category || "height_flight") === "height_flight").length;
    const areas = new Set(filteredEvents.filter((e) => e.flight_area).map((e) => e.flight_area as string));
    const participations = signups.filter((s) => eventIdSet.has(s.event_id)).length;
    return [
      { icon: CalendarDays, label: t("school.stats.events"), value: filteredEvents.length },
      { icon: GraduationCap, label: t("school.stats.heightFlightDays"), value: heightFlights },
      { icon: Users, label: t("school.stats.participations"), value: participations },
      { icon: MapPin, label: t("school.stats.areasUsed"), value: areas.size },
    ];
  }, [filteredEvents, signups, eventIdSet, t]);

  const rank = (role: string) => {
    const counts: Record<string, number> = {};
    staff
      .filter((s) => s.role === role && eventIdSet.has(s.event_id))
      .forEach((s) => {
        const key = names[s.user_id] || "—";
        counts[key] = (counts[key] || 0) + 1;
      });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  };

  const instructorDays = useMemo(() => rank("instructor"), [staff, eventIdSet, names]);
  const launchHelperDays = useMemo(() => rank("launch_helper"), [staff, eventIdSet, names]);

  const areaRanking = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredEvents.forEach((e) => {
      if (e.flight_area) counts[e.flight_area] = (counts[e.flight_area] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  }, [filteredEvents]);

  const categoryRanking = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredEvents.forEach((e) => {
      const key = e.event_category || "height_flight";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ name: t(`events.categories.${key}`, { defaultValue: key }), count }));
  }, [filteredEvents, t]);

  if (loading) {
    return (
      <div className="space-y-3 pt-3">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">{t("school.stats.empty")}</p>;
  }

  return (
    <div className="space-y-4 pt-3">
      <Select value={year} onValueChange={setYear}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("school.stats.allYears")}</SelectItem>
          {years.map((y) => (
            <SelectItem key={y} value={y}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="grid grid-cols-2 gap-3">
        {kpis.map(({ icon: Icon, label, value }) => (
          <Card key={label} className="border-border/60 bg-card/80 shadow-sm backdrop-blur-sm">
            <CardContent className="p-4 flex flex-col items-center gap-1">
              <Icon className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold tabular-nums">{value}</span>
              <span className="text-[10px] text-muted-foreground text-center">{label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <RankedList title={t("school.stats.instructorDays")} items={instructorDays} />
      <RankedList title={t("school.stats.launchHelperDays")} items={launchHelperDays} />
      <RankedList title={t("school.stats.areaRanking")} items={areaRanking} />
      <RankedList title={t("school.stats.categoryRanking")} items={categoryRanking} />
    </div>
  );
}
