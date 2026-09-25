import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertTriangle, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  bookingTotals, closeChecklist, defaultSelection, summarySuggestion, toggleId,
  type ClosePreview, type CloseSelection,
} from "@/lib/flight-day-close";
import { schoolFlightErrorKey } from "@/lib/school-flights";

const STEPS = ["landed", "summaries", "equipment", "billing"] as const;

interface Props {
  eventId: string;
  open: boolean;
  profiles: Record<string, string>;
  onOpenChange: (open: boolean) => void;
  onClosed: () => void | Promise<void>;
}

/** Four-step wizard that closes a flying day (5.1): all landed and checked in, day summaries,
 *  returned equipment, bookings. Closing itself is one server call (close_flight_day). */
export default function CloseDayWizard({ eventId, open, profiles, onOpenChange, onClosed }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState<ClosePreview | null>(null);
  const [selection, setSelection] = useState<CloseSelection>({ credits: [], rentals: [], returns: [] });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const name = (id: string) => profiles[id] || t("events.pilot");
  const fail = (message?: string) => toast({ title: t(`flightDay.errors.${schoolFlightErrorKey(message)}`), variant: "destructive" });

  const load = useCallback(async (resetSelection: boolean) => {
    const { data, error } = await supabase.rpc("flight_day_close_preview", { _event_id: eventId });
    if (error) { fail(error.message); return; }
    const p = data as unknown as ClosePreview;
    setPreview(p);
    if (resetSelection) setSelection(defaultSelection(p));
    setDrafts((d) => Object.fromEntries(p.summaries.filter((s) => !s.hasSummary).map((s) => [s.studentId, d[s.studentId] ?? summarySuggestion(s.feedback)])));
  }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps -- fail/t are stable enough for a dialog

  useEffect(() => { if (open) { setStep(0); void load(true); } }, [open, load]);

  const setPresence = async (studentId: string, presence: "present" | "absent") => {
    setBusy(true);
    const { error } = await supabase.rpc("set_signup_presence", { _event_id: eventId, _student_id: studentId, _presence: presence });
    setBusy(false);
    if (error) fail(error.message); else await load(false);
  };

  const fillTakeoff = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("school_flight_fill_takeoff", { _event_id: eventId });
    setBusy(false);
    if (error) fail(error.message); else await load(false);
  };

  // Takes the (edited) suggestion over as the student's day summary.
  const saveSummary = async (studentId: string) => {
    if (!user) return;
    setBusy(true);
    const { data: existing } = await supabase.from("student_day_notes").select("id")
      .eq("event_id", eventId).eq("student_user_id", studentId).is("flight_number", null).maybeSingle();
    const { error } = await supabase.from("student_day_notes").upsert({
      id: existing?.id || crypto.randomUUID(), event_id: eventId, student_user_id: studentId, flight_number: null,
      note: drafts[studentId] || "", visible_to_student: true, is_next_step: false, instructor_id: user.id,
    });
    setBusy(false);
    if (error) { fail(error.message); return; }
    await load(false);
  };

  const close = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("close_flight_day", {
      _event_id: eventId, _credit_user_ids: selection.credits, _rental_user_ids: selection.rentals, _return_assignment_ids: selection.returns,
    });
    setBusy(false);
    if (error) { fail(error.message); return; }
    toast({ title: t("flightDay.close.done"), description: t("flightDay.close.doneDetail", data as unknown as Record<string, number>) });
    onOpenChange(false);
    await onClosed();
  };

  const checklist = preview ? closeChecklist(preview) : null;
  const totals = preview ? bookingTotals(preview, selection) : null;
  const current = STEPS[step];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl px-4 pb-6">
        <SheetHeader className="text-left">
          <SheetTitle>{t("flightDay.close.title")}</SheetTitle>
          <SheetDescription>{t("flightDay.close.stepOf", { step: step + 1, total: STEPS.length })} · {t(`flightDay.close.steps.${current}`)}</SheetDescription>
        </SheetHeader>
        <div className="mt-2 flex gap-1" aria-hidden>
          {STEPS.map((s, i) => <span key={s} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />)}
        </div>

        {!preview || !checklist || !totals ? <p className="mt-4 text-sm text-muted-foreground">{t("common.loading")}</p> : (
          <div className="mt-4 space-y-3">
            {current === "landed" && <>
              {checklist.inAir > 0 ? (
                <div role="alert" className="flex gap-2 rounded-lg border border-orange-500/50 bg-orange-50 p-3 text-sm dark:bg-orange-950/30">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-orange-600" />
                  <span>{t("flightDay.close.inAir", { names: preview.inAir.map((f) => name(f.studentId)).join(", ") })}</span>
                </div>
              ) : <p className="flex items-center gap-1.5 text-sm"><Check className="h-4 w-4 text-green-600" />{t("flightDay.close.allLanded")}</p>}
              {preview.expected.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-sm">{t("flightDay.close.expected")}</p>
                  {preview.expected.map((id) => (
                    <div key={id} className="flex items-center gap-2">
                      <span className="flex-1 truncate text-sm">{name(id)}</span>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => void setPresence(id, "present")}>{t("flightDay.status.present")}</Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => void setPresence(id, "absent")}>{t("flightDay.status.absent")}</Button>
                    </div>
                  ))}
                </div>
              )}
              {preview.missingTakeoff > 0 && (
                <div className="space-y-1.5 text-sm">
                  <p>{t("flightDay.close.missingTakeoff", { count: preview.missingTakeoff })}</p>
                  {preview.defaultTakeoff
                    ? <Button size="sm" variant="outline" disabled={busy} onClick={fillTakeoff}>{t("flightDay.close.fillTakeoff")}</Button>
                    : <p className="text-xs text-muted-foreground">{t("flightDay.close.setTakeoffFirst")}</p>}
                </div>
              )}
            </>}

            {current === "summaries" && (checklist.missingSummaries === 0
              ? <p className="flex items-center gap-1.5 text-sm"><Check className="h-4 w-4 text-green-600" />{t("flightDay.close.allSummaries")}</p>
              : <>
                <p className="text-sm text-muted-foreground">{t("flightDay.close.summariesHint")}</p>
                {preview.summaries.filter((s) => !s.hasSummary).map((s) => (
                  <div key={s.studentId} className="space-y-1.5 rounded-lg border p-2">
                    <p className="text-sm font-medium">{name(s.studentId)}</p>
                    <Textarea value={drafts[s.studentId] || ""} className="min-h-16 text-sm" aria-label={t("flightDay.summary.title")}
                      placeholder={t("flightDay.summary.placeholder")}
                      onChange={(e) => setDrafts((d) => ({ ...d, [s.studentId]: e.target.value }))} />
                    <Button size="sm" variant="outline" disabled={busy || !(drafts[s.studentId] || "").trim()} onClick={() => void saveSummary(s.studentId)}>
                      {t("flightDay.close.saveSummary")}
                    </Button>
                  </div>
                ))}
              </>)}

            {current === "equipment" && (preview.loans.length === 0
              ? <p className="text-sm text-muted-foreground">{t("flightDay.close.noLoans")}</p>
              : <>
                <div className="flex items-center justify-between">
                  <p className="text-sm">{t("flightDay.close.loansHint")}</p>
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => setSelection((s) => ({ ...s, returns: preview.loans.map((l) => l.id) }))}>
                    {t("flightDay.close.allReturned")}
                  </Button>
                </div>
                {preview.loans.map((l) => (
                  <label key={l.id} className="flex min-h-12 items-center gap-3 rounded-lg border px-3">
                    <Checkbox checked={selection.returns.includes(l.id)} onCheckedChange={() => setSelection((s) => ({ ...s, returns: toggleId(s.returns, l.id) }))} />
                    <span className="flex-1 text-sm">
                      <span className="font-medium">{l.equipment}</span>{l.inventoryNumber ? ` (${l.inventoryNumber})` : ""}
                      <span className="block text-xs text-muted-foreground">{name(l.userId)}</span>
                    </span>
                  </label>
                ))}
              </>)}

            {current === "billing" && <>
              <section className="space-y-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("flightDay.close.credits", { amount: preview.creditRate })}
                </h3>
                {preview.creditRate <= 0 && <p className="text-xs text-muted-foreground">{t("flightDay.close.noRate")}</p>}
                {preview.credits.length === 0 && <p className="text-xs text-muted-foreground">{t("flightDay.close.noHelpers")}</p>}
                {preview.credits.map((c) => (
                  <label key={c.userId} className="flex min-h-12 items-center gap-3 rounded-lg border px-3">
                    <Checkbox disabled={c.booked || preview.creditRate <= 0} checked={c.booked || selection.credits.includes(c.userId)}
                      onCheckedChange={() => setSelection((s) => ({ ...s, credits: toggleId(s.credits, c.userId) }))} />
                    <span className="flex-1 text-sm">{name(c.userId)}</span>
                    {c.booked && <span className="text-xs text-muted-foreground">{t("flightDay.close.booked")}</span>}
                  </label>
                ))}
              </section>
              <section className="space-y-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("flightDay.close.rentals", { amount: preview.rentalRate })}
                </h3>
                {preview.rentalRate <= 0 && <p className="text-xs text-muted-foreground">{t("flightDay.close.noRate")}</p>}
                {preview.rentals.map((r) => (
                  <label key={r.userId} className="flex min-h-12 items-center gap-3 rounded-lg border px-3">
                    <Checkbox disabled={r.booked || preview.rentalRate <= 0} checked={r.booked || selection.rentals.includes(r.userId)}
                      onCheckedChange={() => setSelection((s) => ({ ...s, rentals: toggleId(s.rentals, r.userId) }))} />
                    <span className="flex-1 text-sm">{name(r.userId)}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.booked ? t("flightDay.close.booked") : r.hasLoan ? t("flightDay.close.hasLoan") : t("flightDay.close.noLoan")}
                    </span>
                  </label>
                ))}
              </section>
              <p className="text-sm font-medium">
                {t("flightDay.close.totals", { credits: totals.credits, creditAmount: totals.creditAmount, rentals: totals.rentals, rentalAmount: totals.rentalAmount })}
              </p>
              <p className="text-xs text-muted-foreground">{t("flightDay.close.releaseHint")}</p>
            </>}

            <div className="flex gap-2 pt-2">
              {step > 0 && <Button variant="outline" size="lg" onClick={() => setStep(step - 1)}>{t("flightDay.close.back")}</Button>}
              {step < STEPS.length - 1
                ? <Button size="lg" className="flex-1" onClick={() => setStep(step + 1)}>{t("flightDay.close.next")}</Button>
                : <Button size="lg" className="flex-1" disabled={busy || !checklist.canClose} onClick={close}>{t("flightDay.close.confirm")}</Button>}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
