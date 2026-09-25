import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRightCircle, Check, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { coachNoteAutosave } from "@/lib/note-autosave";

export interface DaySummary {
  id: string;
  note: string;
  is_next_step: boolean;
}

interface Props {
  eventId: string;
  studentId: string;
  summary: DaySummary | null;
  /** The last next step of earlier days, offered as a template (never prefilled). */
  lastNextStep: string | null;
}

/** Day summary and next step of a student in the flying day cockpit (4.5). Saved automatically;
 *  the student sees it once the day is released (E8, migration 0054). */
export default function DaySummaryEditor({ eventId, studentId, summary, lastNextStep }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [, refresh] = useState(0);
  const key = `${user?.id}:${eventId}:${studentId}:summary`;
  useEffect(() => coachNoteAutosave.subscribe(() => refresh((n) => n + 1)), []);
  useEffect(() => () => { void coachNoteAutosave.flush(key); }, [key]);

  const draft = coachNoteAutosave.get(key);
  const value = draft?.value ?? { id: summary?.id || "", note: summary?.note || "", visible_to_student: true, is_next_step: summary?.is_next_step ?? false };
  const dirty = !!draft && draft.revision !== draft.savedRevision;

  const edit = (patch: { note?: string; is_next_step?: boolean }) => {
    if (!user) return;
    const next = { ...value, id: value.id || crypto.randomUUID(), visible_to_student: true, ...patch };
    coachNoteAutosave.edit(key, next, async (snapshot) => {
      const { error } = await supabase.from("student_day_notes").upsert({
        id: snapshot.id, note: snapshot.note, visible_to_student: true, is_next_step: snapshot.is_next_step ?? false,
        event_id: eventId, student_user_id: studentId, flight_number: null, instructor_id: user.id,
      });
      if (error) throw error;
    });
  };

  return (
    <div className="space-y-1.5 border-t pt-2">
      <div className="flex items-center gap-1.5">
        <FileText className="h-3.5 w-3.5 text-primary" />
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("flightDay.summary.title")}</span>
        {draft?.saving && <span className="text-[10px] text-muted-foreground animate-pulse">{t("common.saving")}…</span>}
        {draft && !draft.saving && !dirty && <span className="flex items-center gap-0.5 text-[10px] text-primary"><Check className="h-3 w-3" />{t("common.saved")}</span>}
      </div>
      <Textarea value={value.note} className="min-h-16 text-sm" aria-label={t("flightDay.summary.title")} placeholder={t("flightDay.summary.placeholder")}
        onChange={(e) => edit({ note: e.target.value })} onBlur={() => void coachNoteAutosave.flush(key)} />
      {draft?.error && (
        <div role="alert" className="flex items-center gap-2 text-xs text-destructive">
          <span className="flex-1">{t("journeys.noteFailed")}</span>
          <Button size="sm" variant="outline" onClick={() => void coachNoteAutosave.flush(key)}>{t("performance.retry")}</Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={!!value.is_next_step} onClick={() => edit({ is_next_step: !value.is_next_step })}
          className={cn("flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs", value.is_next_step ? "border-primary text-primary font-medium" : "text-muted-foreground")}>
          <ArrowRightCircle className="h-3.5 w-3.5" />{t("flightDay.summary.nextStep")}
        </button>
        {lastNextStep && !value.note.trim() && (
          <button type="button" className="text-xs text-primary underline-offset-2 hover:underline" onClick={() => edit({ note: lastNextStep })}>
            {t("flightDay.summary.useAsTemplate")}
          </button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">{t("flightDay.summary.hint")}</p>
    </div>
  );
}
