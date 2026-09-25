import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MapPin, MoreVertical, PauseCircle, Plane } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFlightDayLive } from "@/hooks/use-flight-day-live";
import { cn } from "@/lib/utils";
import { dayParticipants, type DayPause, type DaySignup } from "@/lib/flight-day";
import {
  airborneMinutes, flightCountByStudent, latestFlight, schoolFlightErrorKey, takeoffAction,
  type LandingHintMinutes, type SchoolFlight,
} from "@/lib/school-flights";
import InAirBar from "./InAirBar";

interface TakeoffFlight extends SchoolFlight { start_note: string | null }

interface Props {
  eventId: string;
  signups: DaySignup[];
  profiles: Record<string, string>;
  /** Bumped when the day's settings (sites, landing hint) change. */
  settingsVersion?: number;
}

/** Take-off view for launch helpers (and instructors working the take-off): "Start" per student,
 *  aborted launches with a reason and a start note; no feedback, no dossier. Flugtag-Cockpit 4.4. */
export default function TakeoffBoard({ eventId, signups, profiles, settingsVersion = 0 }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [flights, setFlights] = useState<TakeoffFlight[]>([]);
  const [pauses, setPauses] = useState<DayPause[]>([]);
  const [site, setSite] = useState<string | null>(null);
  const [hint, setHint] = useState<LandingHintMinutes>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ kind: "abort" | "note"; flight: TakeoffFlight; text: string } | null>(null);

  const load = useCallback(async () => {
    const [flightsRes, pausesRes, eventRes] = await Promise.all([
      supabase.from("event_school_flights").select("id, student_user_id, seq, status, started_at, landed_at, start_note").eq("event_id", eventId),
      supabase.from("event_day_pauses").select("student_user_id, reason, note").eq("event_id", eventId),
      supabase.from("flight_events").select("default_takeoff_location_id, landing_hint_minutes").eq("id", eventId).maybeSingle(),
    ]);
    setFlights((flightsRes.data || []) as TakeoffFlight[]);
    setPauses((pausesRes.data || []) as DayPause[]);
    const day = eventRes.data;
    setHint((day?.landing_hint_minutes ?? null) as LandingHintMinutes);
    const siteId = day?.default_takeoff_location_id;
    if (siteId) {
      const { data } = await supabase.from("locations").select("name").eq("id", siteId).maybeSingle();
      setSite(data?.name || null);
    } else setSite(null);
  }, [eventId, settingsVersion]); // eslint-disable-line react-hooks/exhaustive-deps -- settingsVersion forces a reload
  const now = useFlightDayLive(eventId, load, "flight-day-takeoff");

  const participants = useMemo(
    () => dayParticipants(signups, profiles, pauses).filter((p) => p.presence !== "absent"),
    [signups, profiles, pauses],
  );
  const counts = useMemo(() => flightCountByStudent(flights), [flights]);
  const fail = (message?: string) => toast({ title: t(`flightDay.errors.${schoolFlightErrorKey(message)}`), variant: "destructive" });

  const start = async (studentId: string, name: string, paused: boolean) => {
    if (paused && !confirm(t("flightDay.takeoff.pausedConfirm", { name }))) return;
    setBusy(studentId);
    const { error } = await supabase.rpc("school_flight_start", { _event_id: eventId, _student_id: studentId });
    setBusy(null);
    if (error) { fail(error.message); return; }
    toast({ title: t("flightDay.takeoff.started", { name }) });
    await load();
  };

  const saveDialog = async () => {
    if (!dialog) return;
    setBusy(dialog.flight.id);
    const { error } = dialog.kind === "abort"
      ? await supabase.rpc("school_flight_abort", { _flight_id: dialog.flight.id, _note: dialog.text })
      : await supabase.rpc("school_flight_update", { _flight_id: dialog.flight.id, _patch: { start_note: dialog.text } });
    setBusy(null);
    if (error) { fail(error.message); return; }
    setDialog(null);
    await load();
  };

  const nameOf = (id: string) => profiles[id] || t("events.pilot");

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("flightDay.takeoff.title")}</h2>
        <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
          <MapPin className="h-3 w-3 shrink-0" />{site || t("flightDay.sites.notSet")}
        </span>
      </div>
      <InAirBar flights={flights} names={profiles} now={now} hintMinutes={hint} />
      {participants.map((p) => {
        const own = flights.filter((f) => f.student_user_id === p.userId);
        const action = takeoffAction(own);
        const current = own.find((f) => f.status === "in_air");
        const last = latestFlight(own);
        const name = p.name || t("events.pilot");
        return (
          <div key={p.userId} className={cn("flex items-center gap-2 rounded-lg border bg-card pl-3 pr-1.5 py-1.5", p.pause && "opacity-70")}>
            <div className="flex-1 min-w-0 py-1">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
                <span className="flex items-center gap-0.5"><Plane className="h-3 w-3" />{counts[p.userId] || 0}</span>
                {current && <span className="text-sky-600 dark:text-sky-400">{t("flightDay.board.inAir", { minutes: airborneMinutes(current, now) ?? 0 })}</span>}
                {!current && p.pause && <span className="flex items-center gap-0.5 text-amber-600"><PauseCircle className="h-3 w-3" />{t(`flightDay.reasons.${p.pause.reason}`)}</span>}
                {!current && !p.pause && last?.start_note && <span className="truncate">{last.start_note}</span>}
              </p>
            </div>
            {action === "start" ? (
              <Button className="h-12 min-w-[5.5rem]" disabled={busy === p.userId} onClick={() => void start(p.userId, name, !!p.pause)}>
                {t("flightDay.takeoff.start")}
              </Button>
            ) : (
              <Button variant="outline" className="h-12 min-w-[5.5rem]" disabled={busy === current!.id}
                onClick={() => setDialog({ kind: "abort", flight: current!, text: current!.start_note || "" })}>
                {t("flightDay.takeoff.abort")}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex h-12 w-10 items-center justify-center text-muted-foreground" disabled={!last}
                  aria-label={t("flightDay.moreFor", { name })}>
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {last && <DropdownMenuItem onClick={() => setDialog({ kind: "note", flight: last, text: last.start_note || "" })}>{t("flightDay.takeoff.startNote")}</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}

      <Dialog open={!!dialog} onOpenChange={(open) => { if (!open) setDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {dialog?.kind === "abort"
                ? t("flightDay.takeoff.abortTitle", { name: dialog ? nameOf(dialog.flight.student_user_id) : "" })
                : t("flightDay.takeoff.noteTitle", { name: dialog ? nameOf(dialog.flight.student_user_id) : "" })}
            </DialogTitle>
          </DialogHeader>
          <Textarea value={dialog?.text || ""} className="min-h-20" aria-label={t("flightDay.takeoff.noteLabel")} placeholder={t("flightDay.takeoff.noteLabel")}
            onChange={(e) => setDialog((d) => (d ? { ...d, text: e.target.value } : d))} />
          <DialogFooter>
            <Button onClick={saveDialog} disabled={busy !== null}>
              {dialog?.kind === "abort" ? t("flightDay.takeoff.abortSave") : t("flightDay.takeoff.noteSave")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
