import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ChevronDown, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  FEEDBACK_SNIPPETS, MANEUVER_RATINGS, appendSnippet, ratingsPayload, schoolFlightErrorKey, toggleRating,
  type ManeuverRating,
} from "@/lib/school-flights";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration 0052 not in generated types.ts yet
const db = supabase as any;

export type SheetMode =
  | { kind: "land"; flightId: string; number: number }
  | { kind: "add"; number: number }
  | { kind: "edit"; flightId: string; number: number };

export interface FlightDraft {
  feedback: string;
  internal: string;
  ratings: Record<string, ManeuverRating>;
}

interface Props {
  eventId: string;
  studentId: string;
  studentName: string;
  mode: SheetMode | null;
  initial: FlightDraft;
  maneuvers: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

/** Bottom sheet at the landing field: rate the day's maneuvers, feedback for the student and an
 *  internal note. Landing, feedback and ratings are saved in one call (Flugtag-Cockpit 4.3). */
export default function RecordFlightSheet({ eventId, studentId, studentName, mode, initial, maneuvers, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [draft, setDraft] = useState<FlightDraft>(initial);
  const [saving, setSaving] = useState(false);

  // A new sheet starts from the flight's stored values.
  useEffect(() => { if (mode) setDraft(initial); }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps -- reset per opened sheet only

  const dirty = draft.feedback !== initial.feedback || draft.internal !== initial.internal
    || JSON.stringify(draft.ratings) !== JSON.stringify(initial.ratings);

  const close = () => {
    if (dirty && !confirm(t("flightDay.sheet.discardConfirm"))) return;
    onClose();
  };

  const fail = (message?: string) => toast({ title: t(`flightDay.errors.${schoolFlightErrorKey(message)}`), variant: "destructive" });

  const save = async () => {
    if (!mode) return;
    setSaving(true);
    const notes = { feedback: draft.feedback, internal_note: draft.internal };
    const items = ratingsPayload(draft.ratings);
    let error: { message?: string } | null = null;
    if (mode.kind === "land") {
      ({ error } = await db.rpc("school_flight_land", { _flight_id: mode.flightId, _notes: notes, _items: items }));
    } else if (mode.kind === "add") {
      ({ error } = await db.rpc("school_flight_add", { _event_id: eventId, _student_id: studentId, _notes: notes, _items: items }));
    } else {
      ({ error } = await db.rpc("school_flight_set_notes", { _flight_id: mode.flightId, _patch: notes }));
      if (!error) ({ error } = await db.rpc("school_flight_set_items", { _flight_id: mode.flightId, _items: items }));
    }
    setSaving(false);
    if (error) { fail(error.message); return; }
    toast({ title: t("flightDay.sheet.saved") });
    onClose();
    await onSaved();
  };

  const remove = async () => {
    if (mode?.kind !== "edit" || !confirm(t("flightDay.sheet.deleteConfirm"))) return;
    setSaving(true);
    const { error } = await db.rpc("school_flight_delete", { _flight_id: mode.flightId });
    setSaving(false);
    if (error) { fail(error.message); return; }
    toast({ title: t("flightDay.board.deleted") });
    onClose();
    await onSaved();
  };

  const title = !mode ? "" : mode.kind === "land"
    ? t("flightDay.sheet.titleLand", { name: studentName, number: mode.number })
    : mode.kind === "add" ? t("flightDay.sheet.titleAdd", { name: studentName, number: mode.number })
    : t("flightDay.sheet.titleEdit", { name: studentName, number: mode.number });

  return (
    <Sheet open={!!mode} onOpenChange={(open) => { if (!open) close(); }}>
      <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-2xl px-4 pb-6">
        <SheetHeader className="text-left">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{t("flightDay.sheet.feedbackHint")}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("flightDay.sheet.maneuvers")}</h3>
            {maneuvers.length === 0 && <p className="text-xs text-muted-foreground">{t("flightDay.sheet.noManeuvers")}</p>}
            {maneuvers.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <span className="flex-1 min-w-0 text-sm truncate">{m.name}</span>
                <div className="flex gap-1" role="group" aria-label={m.name}>
                  {MANEUVER_RATINGS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={draft.ratings[m.id] === r}
                      onClick={() => setDraft((d) => ({ ...d, ratings: toggleRating(d.ratings, m.id, r) }))}
                      className={cn(
                        "h-10 min-w-[4.25rem] rounded-md border px-2 text-xs font-medium transition-colors",
                        draft.ratings[m.id] === r
                          ? r === 1 ? "border-red-500 bg-red-500 text-white" : r === 2 ? "border-amber-500 bg-amber-500 text-white" : "border-green-600 bg-green-600 text-white"
                          : "bg-background text-muted-foreground",
                      )}
                    >
                      {t(`flightDay.sheet.ratings.${r}`)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-2">
            <label htmlFor="flight-feedback" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("flightDay.sheet.feedback")}</label>
            <div className="flex flex-wrap gap-1.5">
              {FEEDBACK_SNIPPETS.map((key) => (
                <button key={key} type="button" className="rounded-full border px-3 py-1.5 text-xs"
                  onClick={() => setDraft((d) => ({ ...d, feedback: appendSnippet(d.feedback, t(`flightDay.snippets.${key}`)) }))}>
                  {t(`flightDay.snippets.${key}`)}
                </button>
              ))}
            </div>
            <Textarea id="flight-feedback" value={draft.feedback} className="min-h-20"
              onChange={(e) => setDraft((d) => ({ ...d, feedback: e.target.value }))} />
          </section>

          <Collapsible defaultOpen={!!initial.internal}>
            <CollapsibleTrigger className="group flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("flightDay.sheet.internal")}
              <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <Textarea value={draft.internal} aria-label={t("flightDay.sheet.internal")} className="min-h-16"
                onChange={(e) => setDraft((d) => ({ ...d, internal: e.target.value }))} />
            </CollapsibleContent>
          </Collapsible>

          <div className="flex gap-2 pt-1">
            {mode?.kind === "edit" && (
              <Button variant="outline" size="lg" className="text-destructive" onClick={remove} disabled={saving} aria-label={t("flightDay.sheet.delete")}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button size="lg" className="flex-1" onClick={save} disabled={saving}>{t("flightDay.sheet.save")}</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
