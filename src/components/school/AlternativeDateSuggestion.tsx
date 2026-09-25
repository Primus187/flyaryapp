import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock } from "lucide-react";
import { parseIsoDateLocal, suggestAlternativeDates } from "@/lib/instructor-availability";

const TEAM_FUNCTIONS = ["school_lead", "instructor", "launch_helper"] as const;

interface Props {
  eventId: string;
  groupId: string;
  /** Original event date (yyyy-mm-dd or ISO); suggestions start the day after. */
  eventDate: string;
}

/** Abschnitt 7.2: Ersatztermin-Vorschlag bei Absage, basierend auf Team-Verfügbarkeit (6.1). */
export default function AlternativeDateSuggestion({ eventId, groupId, eventDate }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dates, setDates] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDates(null);
    const load = async () => {
      const day = eventDate.slice(0, 10);
      const [funcRes, availRes] = await Promise.all([
        supabase.from("group_member_functions").select("user_id, function").eq("group_id", groupId),
        supabase
          .from("instructor_availability")
          .select("user_id, date")
          .eq("group_id", groupId)
          .eq("status", "available")
          .gt("date", day),
      ]);
      if (cancelled) return;
      if (funcRes.error || availRes.error) { setDates([]); return; }

      const teamIds = new Set(
        (funcRes.data || []).filter((f) => (TEAM_FUNCTIONS as readonly string[]).includes(f.function)).map((f) => f.user_id),
      );
      const byDate: Record<string, string[]> = {};
      type AvailRow = { user_id: string; date: string };
      ((availRes.data as unknown as AvailRow[]) || []).forEach((row) => {
        if (!teamIds.has(row.user_id)) return;
        (byDate[row.date] ??= []).push(row.user_id);
      });
      setDates(suggestAlternativeDates(day, byDate));
    };
    void load();
    return () => { cancelled = true; };
  }, [eventId, groupId, eventDate]);

  if (dates === null) return null;

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardContent className="p-3 space-y-2">
        <p className="text-xs font-semibold flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" />
          {t("events.alternativeDate.title")}
        </p>
        {dates.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("events.alternativeDate.none")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {dates.map((date) => (
              <Button
                key={date}
                size="sm"
                variant="secondary"
                onClick={() => navigate(`/events/new?duplicate=${eventId}&date=${date}`)}
              >
                {parseIsoDateLocal(date).toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "short" })}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
