import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

interface SlotNote { student_user_id: string; flight_number: number; note: string }

/** Read-only view of the former coaching sheet (slots F1–F6) of older flying days. The slots were
 *  never real flights, so they are not converted into school flights (decision E5). */
export default function LegacyCoachNotes({ eventId, profiles }: { eventId: string; profiles: Record<string, string> }) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<SlotNote[]>([]);

  useEffect(() => {
    void supabase.from("student_day_notes").select("student_user_id, flight_number, note")
      .eq("event_id", eventId).gte("flight_number", 1).lte("flight_number", 6).order("flight_number")
      .then(({ data }) => setNotes(((data || []) as SlotNote[]).filter((n) => n.note.trim())));
  }, [eventId]);

  if (notes.length === 0) return null;
  const students = [...new Set(notes.map((n) => n.student_user_id))]
    .sort((a, b) => (profiles[a] || "").localeCompare(profiles[b] || ""));

  return (
    <Collapsible className="rounded-lg border bg-card">
      <CollapsibleTrigger className="group flex w-full items-center justify-between px-3 py-2.5 text-left">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("flightDay.legacy.title")}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 px-3 pb-3">
        <p className="text-[11px] text-muted-foreground">{t("flightDay.legacy.hint")}</p>
        {students.map((id) => (
          <div key={id}>
            <p className="text-sm font-medium">{profiles[id] || t("events.pilot")}</p>
            {notes.filter((n) => n.student_user_id === id).map((n) => (
              <p key={n.flight_number} className="text-xs"><span className="font-medium text-muted-foreground">F{n.flight_number}:</span> {n.note}</p>
            ))}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
