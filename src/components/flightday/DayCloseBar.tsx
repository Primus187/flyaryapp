import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { schoolFlightErrorKey } from "@/lib/school-flights";
import CloseDayWizard from "./CloseDayWizard";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration 0055 not in generated types.ts yet
const db = supabase as any;

interface Props {
  eventId: string;
  eventDate: string;
  profiles: Record<string, string>;
  /** Called after closing or reopening, so the views reload. */
  onChanged: () => void;
}

/** "Close the day" for the day's instructors, or who closed it and "Reopen" (5.1). */
export default function DayCloseBar({ eventId, eventDate, profiles, onChanged }: Props) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [closed, setClosed] = useState<{ at: string; by: string | null } | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";

  const load = useCallback(async () => {
    const { data } = await supabase.from("flight_events").select("day_closed_at, day_closed_by").eq("id", eventId).maybeSingle();
    if (!data?.day_closed_at) { setClosed(null); return; }
    const { data: profile } = data.day_closed_by
      ? await supabase.from("profiles").select("pilot_name").eq("user_id", data.day_closed_by).maybeSingle()
      : { data: null };
    setClosed({ at: data.day_closed_at, by: profile?.pilot_name ?? null });
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  const reopen = async () => {
    if (!confirm(t("flightDay.close.reopenConfirm"))) return;
    const { error } = await db.rpc("reopen_flight_day", { _event_id: eventId });
    if (error) { toast({ title: t(`flightDay.errors.${schoolFlightErrorKey(error.message)}`), variant: "destructive" }); return; }
    await load();
    onChanged();
  };

  // Closing becomes possible once the day has begun.
  const started = new Date(eventDate).getTime() <= Date.now();

  if (closed) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-600/40 bg-green-50 px-3 py-2 text-sm dark:bg-green-950/30">
        <Lock className="h-4 w-4 shrink-0 text-green-700 dark:text-green-400" />
        <span className="flex-1">
          {t("flightDay.close.closedAt", { date: new Date(closed.at).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) })}
          {closed.by && ` · ${closed.by}`}
        </span>
        <Button size="sm" variant="ghost" className="text-xs" onClick={reopen}>{t("flightDay.close.reopen")}</Button>
      </div>
    );
  }

  if (!started) return null;
  return (
    <>
      <Button variant="outline" className="h-12 w-full gap-2" onClick={() => setWizardOpen(true)}>
        <CheckCircle2 className="h-4 w-4" />{t("flightDay.close.open")}
      </Button>
      <CloseDayWizard eventId={eventId} open={wizardOpen} profiles={profiles} onOpenChange={setWizardOpen}
        onClosed={async () => { await load(); onChanged(); }} />
    </>
  );
}
