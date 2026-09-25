import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import { ArrowRightCircle, ChevronRight, PauseCircle, Plane } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFlightDayLive } from "@/hooks/use-flight-day-live";
import { cn } from "@/lib/utils";
import { dayParticipants, type DayPause, type DaySignup } from "@/lib/flight-day";
import { latestNextStepPerStudent, type DayNoteRow } from "@/lib/handoff-notes";
import {
  airborneMinutes, boardAction, flightDurationMinutes, flightNumbers, schoolFlightErrorKey,
  type LandingHintMinutes, type ManeuverRating, type SchoolFlight,
} from "@/lib/school-flights";
import RecordFlightSheet, { type FlightDraft, type SheetMode } from "./RecordFlightSheet";
import InAirBar from "./InAirBar";
import DaySummaryEditor, { type DaySummary } from "./DaySummaryEditor";

interface BoardFlight extends SchoolFlight { start_note: string | null }
interface FlightNote { flight_id: string; feedback: string | null; internal_note: string | null }
interface FlightItem { flight_id: string; training_item_id: string; rating: ManeuverRating }

interface Props {
  eventId: string;
  eventCategory: string | null;
  signups: DaySignup[];
  profiles: Record<string, string>;
  /** Bumped when the day's settings (sites, landing hint) change. */
  settingsVersion?: number;
  /** Day summaries are written through is_group_staff (admin, instructor, school lead). */
  canWriteSummary?: boolean;
}

const emptyDraft: FlightDraft = { feedback: "", internal: "", ratings: {} };

/** Instructor view of a flying day: one row per student with the day's flights and one main
 *  action (land / + flight / +1 on the practice slope). Flugtag-Cockpit 4.3. */
export default function FlightBoard({ eventId, eventCategory, signups, profiles, settingsVersion = 0, canWriteSummary = false }: Props) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [flights, setFlights] = useState<BoardFlight[]>([]);
  const [notes, setNotes] = useState<Record<string, FlightNote>>({});
  const [items, setItems] = useState<FlightItem[]>([]);
  const [pauses, setPauses] = useState<DayPause[]>([]);
  const [maneuvers, setManeuvers] = useState<{ id: string; name: string }[]>([]);
  const [nextSteps, setNextSteps] = useState<Record<string, string>>({});
  const [summaries, setSummaries] = useState<Record<string, DaySummary>>({});
  const [selfLogged, setSelfLogged] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ studentId: string; mode: SheetMode; initial: FlightDraft } | null>(null);
  const [hint, setHint] = useState<LandingHintMinutes>(null);
  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";
  const studentIds = useMemo(() => signups.map((s) => s.user_id), [signups]);
  const studentKey = studentIds.join(",");

  const load = useCallback(async () => {
    const [flightsRes, pausesRes, maneuversRes, eventRes] = await Promise.all([
      supabase.from("event_school_flights").select("id, student_user_id, seq, status, started_at, landed_at, start_note").eq("event_id", eventId),
      supabase.from("event_day_pauses").select("student_user_id, reason, note").eq("event_id", eventId),
      supabase.from("event_maneuvers").select("training_item_id, sort_order").eq("event_id", eventId).order("sort_order"),
      supabase.from("flight_events").select("landing_hint_minutes").eq("id", eventId).maybeSingle(),
    ]);
    if (flightsRes.error) { setLoadError(true); return; }
    setLoadError(false);
    const rows = (flightsRes.data || []) as BoardFlight[];
    setFlights(rows);
    setPauses((pausesRes.data || []) as DayPause[]);
    setHint((eventRes.data?.landing_hint_minutes ?? null) as LandingHintMinutes);
    const ids = rows.map((f) => f.id);
    if (ids.length > 0) {
      const [notesRes, itemsRes] = await Promise.all([
        supabase.from("event_school_flight_notes").select("flight_id, feedback, internal_note").in("flight_id", ids),
        supabase.from("event_school_flight_items").select("flight_id, training_item_id, rating").in("flight_id", ids),
      ]);
      setNotes(Object.fromEntries(((notesRes.data || []) as FlightNote[]).map((n) => [n.flight_id, n])));
      setItems((itemsRes.data || []) as FlightItem[]);
    } else { setNotes({}); setItems([]); }
    const itemIds = (maneuversRes.data || []).map((m) => m.training_item_id);
    if (itemIds.length > 0) {
      const { data: names } = await supabase.from("training_items").select("id, name").in("id", itemIds);
      const byId = new Map((names || []).map((n) => [n.id, n.name]));
      setManeuvers(itemIds.map((id) => ({ id, name: byId.get(id) || "?" })));
    } else setManeuvers([]);
  }, [eventId, settingsVersion]); // eslint-disable-line react-hooks/exhaustive-deps -- settingsVersion forces a reload
  const now = useFlightDayLive(eventId, load, "flight-day-board");

  // Day summaries of this event, the last next step of earlier days (for reading, not prefilled)
  // and the flights students logged themselves for this event.
  useEffect(() => {
    if (studentIds.length === 0) return;
    void (async () => {
      const [summaryRes, selfRes] = await Promise.all([
        supabase.from("student_day_notes").select("id, student_user_id, note, is_next_step").eq("event_id", eventId).is("flight_number", null),
        supabase.from("flights").select("id", { count: "exact", head: true }).eq("event_id", eventId),
      ]);
      setSummaries(Object.fromEntries((summaryRes.data || []).map((n) => [n.student_user_id, { id: n.id, note: n.note, is_next_step: n.is_next_step }])));
      setSelfLogged(selfRes.count || 0);
      const { data } = await supabase.from("student_day_notes")
        .select("event_id, student_user_id, flight_number, note, is_next_step, flight_events(event_date)")
        .in("student_user_id", studentIds).eq("is_next_step", true).is("flight_number", null).neq("event_id", eventId);
      const rows = (data || []) as (DayNoteRow & { flight_events: { event_date: string } | null })[];
      const dates = Object.fromEntries(rows.filter((r) => r.flight_events).map((r) => [r.event_id, r.flight_events!.event_date]));
      setNextSteps(latestNextStepPerStudent(rows, dates));
    })();
  }, [eventId, studentKey]); // eslint-disable-line react-hooks/exhaustive-deps -- studentKey stands for studentIds

  const numbers = useMemo(() => flightNumbers(flights), [flights]);
  const participants = useMemo(
    () => dayParticipants(signups, profiles, pauses).filter((p) => p.presence !== "absent"),
    [signups, profiles, pauses],
  );
  const byStudent = useMemo(() => {
    const map: Record<string, BoardFlight[]> = {};
    [...flights].sort((a, b) => a.seq - b.seq).forEach((f) => { (map[f.student_user_id] ||= []).push(f); });
    return map;
  }, [flights]);

  const fail = (message?: string) => toast({ title: t(`flightDay.errors.${schoolFlightErrorKey(message)}`), variant: "destructive" });
  const draftOf = (flightId: string): FlightDraft => ({
    feedback: notes[flightId]?.feedback || "",
    internal: notes[flightId]?.internal_note || "",
    ratings: Object.fromEntries(items.filter((i) => i.flight_id === flightId).map((i) => [i.training_item_id, i.rating])),
  });
  const countOf = (studentId: string) => (byStudent[studentId] || []).filter((f) => f.status !== "aborted").length;

  const addCounted = async (studentId: string, name: string) => {
    const number = countOf(studentId) + 1;
    setBusy(studentId);
    const { data, error } = await supabase.rpc("school_flight_add", { _event_id: eventId, _student_id: studentId });
    setBusy(null);
    if (error) { fail(error.message); return; }
    await load();
    toast({
      title: t("flightDay.board.counted", { name, number }),
      duration: 5000,
      action: <ToastAction altText={t("common.undo")} onClick={async () => {
        const { error: undoError } = await supabase.rpc("school_flight_delete", { _flight_id: data.id });
        if (undoError) fail(undoError.message); else void load();
      }}>{t("common.undo")}</ToastAction>,
    });
  };

  // Start reported by radio when the launch helper did not tap it (plan 4.4).
  const startFlight = async (studentId: string) => {
    setBusy(studentId);
    const { error } = await supabase.rpc("school_flight_start", { _event_id: eventId, _student_id: studentId });
    setBusy(null);
    if (error) { fail(error.message); return; }
    await load();
  };

  const landFlight = (f: SchoolFlight) => setSheet({ studentId: f.student_user_id, mode: { kind: "land", flightId: f.id, number: numbers[f.id] }, initial: draftOf(f.id) });

  const mainAction = (studentId: string, name: string) => {
    const own = byStudent[studentId] || [];
    const action = boardAction(own, eventCategory);
    if (action === "land") {
      landFlight(own.find((f) => f.status === "in_air")!);
    } else if (action === "count") void addCounted(studentId, name);
    else setSheet({ studentId, mode: { kind: "add", number: countOf(studentId) + 1 }, initial: emptyDraft });
  };

  const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "");

  if (loadError) return <div role="alert" className="text-sm"><p>{t("performance.loadFailed")}</p><Button size="sm" onClick={() => void load()}>{t("performance.retry")}</Button></div>;
  if (participants.length === 0) return null;

  return (
    <section className="space-y-1.5">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("flightDay.board.title")}</h2>
      <InAirBar flights={flights} names={profiles} now={now} hintMinutes={hint} onSelect={landFlight} />
      {participants.map((p) => {
        const own = byStudent[p.userId] || [];
        const inAir = own.find((f) => f.status === "in_air");
        const action = boardAction(own, eventCategory);
        const isOpen = expanded === p.userId;
        const name = p.name || t("events.pilot");
        return (
          <div key={p.userId} className={cn("rounded-lg border bg-card", p.pause && "opacity-70")}>
            <div className="flex items-center gap-2 pl-2 pr-2 py-1.5">
              <button type="button" className="flex flex-1 min-w-0 items-center gap-2 py-1.5 text-left" aria-expanded={isOpen}
                onClick={() => setExpanded(isOpen ? null : p.userId)}>
                <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{name}</span>
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-0.5"><Plane className="h-3 w-3" />{countOf(p.userId)}</span>
                    <span className="flex gap-0.5" aria-hidden>
                      {own.filter((f) => f.status !== "aborted").map((f) => (
                        <span key={f.id} className={cn("h-1.5 w-1.5 rounded-full", notes[f.id]?.feedback ? "bg-primary" : "bg-muted-foreground/30")} />
                      ))}
                    </span>
                    {inAir && <span className="text-sky-600 dark:text-sky-400">{t("flightDay.board.inAir", { minutes: airborneMinutes(inAir, now) ?? 0 })}</span>}
                    {p.pause && <span className="flex items-center gap-0.5 text-amber-600"><PauseCircle className="h-3 w-3" />{t(`flightDay.reasons.${p.pause.reason}`)}</span>}
                  </span>
                </span>
              </button>
              {action === "add" && (
                <Button size="sm" variant="ghost" className="h-12 shrink-0 px-2 text-xs" disabled={busy === p.userId}
                  onClick={() => void startFlight(p.userId)}>
                  {t("flightDay.board.start")}
                </Button>
              )}
              <Button size="sm" className="h-12 min-w-[5.5rem] shrink-0" variant={action === "land" ? "default" : "outline"}
                disabled={busy === p.userId} onClick={() => mainAction(p.userId, name)}>
                {t(`flightDay.board.${action}`)}
              </Button>
            </div>

            {isOpen && (
              <div className="space-y-2 border-t px-3 py-2">
                {own.length === 0 && <p className="text-xs text-muted-foreground">{t("flightDay.board.noFlights")}</p>}
                {own.map((f) => {
                  const minutes = flightDurationMinutes(f);
                  const label = f.status === "aborted" ? t("flightDay.board.aborted") : t("flightDay.board.flightN", { number: numbers[f.id] });
                  const times = f.started_at && f.landed_at ? `${time(f.started_at)}–${time(f.landed_at)}` : time(f.landed_at || f.started_at);
                  return (
                    <button key={f.id} type="button" disabled={f.status === "aborted"}
                      className="block w-full rounded-md bg-muted/40 px-2 py-1.5 text-left disabled:opacity-70"
                      onClick={() => setSheet({ studentId: p.userId,
                        mode: f.status === "in_air" ? { kind: "land", flightId: f.id, number: numbers[f.id] } : { kind: "edit", flightId: f.id, number: numbers[f.id] },
                        initial: draftOf(f.id) })}>
                      <span className="flex items-center gap-2 text-xs">
                        <span className="font-medium">{label}</span>
                        <span className="text-muted-foreground">{times}{minutes !== null ? ` · ${t("flightDay.board.minutes", { count: minutes })}` : ""}</span>
                        {f.status === "in_air" && <span className="ml-auto text-sky-600 dark:text-sky-400">{t("flightDay.board.inAirShort")}</span>}
                      </span>
                      {(notes[f.id]?.feedback || f.start_note) && (
                        <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">{notes[f.id]?.feedback || f.start_note}</span>
                      )}
                    </button>
                  );
                })}
                {action === "count" && (
                  <Button size="sm" variant="ghost" className="h-8 px-2 text-xs"
                    onClick={() => setSheet({ studentId: p.userId, mode: { kind: "add", number: countOf(p.userId) + 1 }, initial: emptyDraft })}>
                    {t("flightDay.board.addWithFeedback")}
                  </Button>
                )}
                <div className="flex gap-1.5 text-xs text-muted-foreground">
                  <ArrowRightCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span><span className="font-medium">{t("flightDay.board.lastNextStep")}:</span> {nextSteps[p.userId] || t("flightDay.board.noNextStep")}</span>
                </div>
                {canWriteSummary && (
                  <DaySummaryEditor eventId={eventId} studentId={p.userId} summary={summaries[p.userId] || null} lastNextStep={nextSteps[p.userId] || null} />
                )}
              </div>
            )}
          </div>
        );
      })}

      {selfLogged > 0 && <p className="text-[11px] text-muted-foreground">{t("flightDay.board.selfLogged", { count: selfLogged })}</p>}

      <RecordFlightSheet
        eventId={eventId}
        studentId={sheet?.studentId || ""}
        studentName={sheet ? profiles[sheet.studentId] || t("events.pilot") : ""}
        mode={sheet?.mode || null}
        initial={sheet?.initial || emptyDraft}
        maneuvers={maneuvers}
        onClose={() => setSheet(null)}
        onSaved={load}
      />
    </section>
  );
}
