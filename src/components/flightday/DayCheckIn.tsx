import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, PauseCircle, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  PAUSE_REASONS, dayParticipants, nextPresenceOnTap, presenceSummary,
  type DayParticipant, type DayPause, type DaySignup, type PauseReason, type Presence,
} from "@/lib/flight-day";

interface Props {
  eventId: string;
  /** Confirmed signups shown on the participants tab (inactive students already filtered). */
  signups: DaySignup[];
  profiles: Record<string, string>;
  onChanged: () => void | Promise<void>;
}

/** Check-in tiles of a flying day for instructors and launch helpers (Flugtag-Cockpit 4.2). */
export default function DayCheckIn({ eventId, signups, profiles, onChanged }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [pauses, setPauses] = useState<DayPause[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [pauseFor, setPauseFor] = useState<DayParticipant | null>(null);
  const [reason, setReason] = useState<PauseReason>("other");
  const [note, setNote] = useState("");
  // Tiles fold away once nobody is left to check in; the summary line opens them again.
  const [tilesOpen, setTilesOpen] = useState<boolean | null>(null);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;
  const refresh = useCallback(() => onChangedRef.current(), []);

  const loadPauses = useCallback(async () => {
    const { data } = await supabase.from("event_day_pauses").select("student_user_id, reason, note").eq("event_id", eventId);
    setPauses((data || []) as DayPause[]);
  }, [eventId]);

  // Check-ins and pauses from the other phone (take-off / landing) arrive live; after the app was
  // in the background everything is reloaded, so no missed message leaves a stale list.
  useEffect(() => {
    void loadPauses();
    const channel = supabase.channel(`flight-day-checkin-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_signups", filter: `event_id=eq.${eventId}` }, () => { void refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "event_day_pauses", filter: `event_id=eq.${eventId}` }, () => { void loadPauses(); })
      .subscribe();
    const onVisible = () => { if (document.visibilityState === "visible") { void loadPauses(); void refresh(); } };
    document.addEventListener("visibilitychange", onVisible);
    return () => { document.removeEventListener("visibilitychange", onVisible); void supabase.removeChannel(channel); };
  }, [eventId, loadPauses, refresh]);

  const participants = useMemo(() => dayParticipants(signups, profiles, pauses), [signups, profiles, pauses]);
  const summary = presenceSummary(participants);
  const showTiles = tilesOpen ?? summary.expected > 0;

  const fail = (error: { message?: string }) => {
    const closed = error.message?.includes("Flight day is closed");
    toast({ title: closed ? t("flightDay.closed") : t("flightDay.saveFailed"), variant: "destructive" });
  };

  const setPresence = async (p: DayParticipant, presence: Presence) => {
    setBusy(p.userId);
    const { error } = await supabase.rpc("set_signup_presence", { _event_id: eventId, _student_id: p.userId, _presence: presence });
    setBusy(null);
    if (error) { fail(error); return; }
    await onChanged();
  };

  const allPresent = async () => {
    const ids = participants.filter((p) => p.presence === "expected").map((p) => p.userId);
    if (!confirm(t("flightDay.allPresentConfirm", { count: ids.length }))) return;
    setBusy("all");
    const { data, error } = await supabase.rpc("set_signups_present", { _event_id: eventId, _student_ids: ids });
    setBusy(null);
    if (error) { fail(error); return; }
    toast({ title: t("flightDay.allPresentDone", { count: data ?? ids.length }) });
    await onChanged();
  };

  const openPause = (p: DayParticipant) => {
    setReason(p.pause?.reason || "other");
    setNote(p.pause?.note || "");
    setPauseFor(p);
  };

  const savePause = async (resume = false) => {
    if (!pauseFor) return;
    setBusy(pauseFor.userId);
    const { error } = await supabase.rpc("set_day_pause", {
      _event_id: eventId, _student_id: pauseFor.userId, _reason: resume ? null : reason, _note: resume ? null : note,
    });
    setBusy(null);
    if (error) { fail(error); return; }
    toast({ title: resume ? t("journeys.resumedToday") : t("journeys.pausedToday") });
    setPauseFor(null);
    await Promise.all([loadPauses(), onChanged()]);
  };

  if (participants.length === 0) return <p className="text-sm text-muted-foreground">{t("events.noSignups")}</p>;

  return (
    <div className="space-y-2">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3 flex items-center gap-3">
          <UserCheck className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{t("flightDay.presentOf", { present: summary.present, total: summary.total })}</p>
            <p className="text-xs text-muted-foreground">
              {[
                summary.absent > 0 && t("flightDay.absentCount", { count: summary.absent }),
                summary.expected > 0 && t("flightDay.expectedCount", { count: summary.expected }),
                summary.paused > 0 && t("flightDay.pausedCount", { count: summary.paused }),
              ].filter(Boolean).join(" · ") || t("flightDay.allCheckedIn")}
            </p>
          </div>
          {summary.expected > 0 ? (
            <Button size="sm" variant="outline" className="shrink-0" onClick={allPresent} disabled={busy !== null}>{t("flightDay.allPresent")}</Button>
          ) : (
            <Button size="sm" variant="ghost" className="shrink-0 text-xs" aria-expanded={showTiles} onClick={() => setTilesOpen(!showTiles)}>
              {showTiles ? t("flightDay.hideCheckIn") : t("flightDay.showCheckIn")}
            </Button>
          )}
        </CardContent>
      </Card>

      {showTiles && <>
      <div className="grid grid-cols-2 gap-2">
        {participants.map((p) => (
          <div
            key={p.userId}
            className={cn(
              "relative flex min-h-14 items-stretch rounded-lg border bg-card",
              p.presence === "present" && !p.pause && "border-green-600/60 bg-green-50 dark:bg-green-950/30",
              p.pause && "border-amber-500/60 bg-amber-50 dark:bg-amber-950/30",
              p.presence === "expected" && "border-dashed",
              p.presence === "absent" && "opacity-60",
            )}
          >
            <button
              type="button"
              className="flex-1 min-w-0 px-3 py-2 text-left disabled:opacity-50"
              disabled={busy === p.userId || busy === "all"}
              onClick={() => void setPresence(p, nextPresenceOnTap(p.presence))}
              aria-label={`${p.name || t("events.pilot")}: ${t(`flightDay.status.${p.presence}`)}`}
            >
              <span className="block text-sm font-medium truncate">{p.name || t("events.pilot")}</span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                {p.pause
                  ? <><PauseCircle className="h-3 w-3 text-amber-600 shrink-0" />{t(`flightDay.reasons.${p.pause.reason}`)}</>
                  : t(`flightDay.status.${p.presence}`)}
              </span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="w-9 flex items-center justify-center text-muted-foreground" aria-label={t("flightDay.moreFor", { name: p.name })}>
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {p.presence !== "absent" && <DropdownMenuItem onClick={() => void setPresence(p, "absent")}>{t("flightDay.markAbsent")}</DropdownMenuItem>}
                {p.presence !== "expected" && <DropdownMenuItem onClick={() => void setPresence(p, "expected")}>{t("flightDay.reset")}</DropdownMenuItem>}
                <DropdownMenuItem onClick={() => openPause(p)}>{p.pause ? t("flightDay.editPause") : t("journeys.pauseToday")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">{t("flightDay.tapHint")}</p>
      </>}

      <Dialog open={!!pauseFor} onOpenChange={(open) => { if (!open) setPauseFor(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("flightDay.pauseTitle", { name: pauseFor?.name || t("events.pilot") })}</DialogTitle>
            <DialogDescription>{t("flightDay.pauseHint")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {PAUSE_REASONS.map((r) => (
              <Button key={r} type="button" size="sm" variant={reason === r ? "default" : "outline"} onClick={() => setReason(r)}>
                {t(`flightDay.reasons.${r}`)}
              </Button>
            ))}
          </div>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("flightDay.pauseNote")} aria-label={t("flightDay.pauseNote")} className="min-h-16" />
          <DialogFooter className="gap-2">
            {pauseFor?.pause && <Button variant="outline" onClick={() => void savePause(true)} disabled={busy !== null}>{t("journeys.resumeToday")}</Button>}
            <Button onClick={() => void savePause()} disabled={busy !== null}>{t("journeys.pauseToday")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
