import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CloudSun, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isDeadlineOverdue, syncedEventStatus, toLocalDatetimeInputValue, type WeatherDecisionStatus } from "@/lib/weather-decision";

interface Props {
  eventId: string;
  groupId: string;
  eventTitle: string;
  canManage: boolean;
  /** Called after flight_events.status was synced, so the parent can refresh its own copy. */
  onEventStatusSynced?: (status: "confirmed" | "cancelled") => void;
}

interface Decision {
  decision_deadline: string | null;
  status: WeatherDecisionStatus;
  decided_at: string | null;
  note: string | null;
}

const STATUS_STYLES: Record<WeatherDecisionStatus, string> = {
  confirmed: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/40",
  weather_pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40",
  cancelled: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/40",
};

export default function EventWeatherDecision({ eventId, groupId, eventTitle, canManage, onEventStatusSynced }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deadlineDraft, setDeadlineDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState<WeatherDecisionStatus>("weather_pending");
  const [noteDraft, setNoteDraft] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet
      .from("event_weather_decisions" as any)
      .select("decision_deadline, status, decided_at, note")
      .eq("event_id", eventId)
      .maybeSingle();
    const row = data as Decision | null;
    setDecision(row);
    setDeadlineDraft(row?.decision_deadline ? toLocalDatetimeInputValue(row.decision_deadline) : "");
    setStatusDraft(row?.status ?? "weather_pending");
    setNoteDraft(row?.note ?? "");
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const statusChanged = statusDraft !== (decision?.status ?? "weather_pending");
    const nowIso = new Date().toISOString();
    const payload: Record<string, unknown> = {
      event_id: eventId,
      decision_deadline: deadlineDraft ? new Date(deadlineDraft).toISOString() : null,
      status: statusDraft,
      note: noteDraft.trim() || null,
    };
    if (statusChanged) {
      payload.decided_by = user.id;
      payload.decided_at = nowIso;
    }
    const { error } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet
      .from("event_weather_decisions" as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet
      .upsert(payload as any, { onConflict: "event_id" });
    if (error) {
      setSaving(false);
      toast({ title: t("events.weatherDecision.saveFailed"), description: error.message, variant: "destructive" });
      return;
    }

    const synced = syncedEventStatus(statusDraft);
    if (statusChanged && synced) {
      await supabase.from("flight_events").update({ status: synced }).eq("id", eventId);
      onEventStatusSynced?.(synced);
    }

    if (statusChanged) {
      const message = `${t(`events.weatherDecision.status.${statusDraft}`)}${noteDraft.trim() ? ` – ${noteDraft.trim()}` : ""}`;
      const { error: notifyError } = await supabase.functions.invoke("notify-event-participants", {
        body: { event_id: eventId, title: eventTitle, message, audience: "participants" },
      });
      if (notifyError) {
        toast({ title: t("events.weatherDecision.notifyFailed"), variant: "destructive" });
      }
    }

    setSaving(false);
    setEditing(false);
    toast({ title: t("events.weatherDecision.saved") });
    void load();
  };

  if (loading) return null;
  if (!canManage && !decision) return null;

  const overdue = isDeadlineOverdue(decision?.decision_deadline ?? null, decision?.decided_at ?? null, new Date());
  const status = decision?.status ?? "weather_pending";

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <CloudSun className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex-1">
            {t("events.weatherDecision.title")}
          </span>
          <Badge variant="outline" className={`text-[10px] ${STATUS_STYLES[status]}`}>
            {t(`events.weatherDecision.status.${status}`)}
          </Badge>
        </div>

        {decision?.decision_deadline && (
          <p className="text-xs text-muted-foreground">
            {t("events.weatherDecision.deadline", { date: new Date(decision.decision_deadline).toLocaleString("de-CH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) })}
          </p>
        )}
        {overdue && (
          <p className="text-xs text-destructive flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {t("events.weatherDecision.overdue")}
          </p>
        )}
        {decision?.note && !editing && <p className="text-xs whitespace-pre-wrap">{decision.note}</p>}

        {canManage && !editing && (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            {t("events.weatherDecision.edit")}
          </Button>
        )}

        {canManage && editing && (
          <div className="space-y-2 pt-1">
            <div>
              <Label htmlFor="weather-decision-deadline" className="text-xs">{t("events.weatherDecision.deadlineLabel")}</Label>
              <Input id="weather-decision-deadline" type="datetime-local" value={deadlineDraft} onChange={(e) => setDeadlineDraft(e.target.value)} disabled={saving} />
            </div>
            <div>
              <Label htmlFor="weather-decision-status" className="text-xs">{t("events.weatherDecision.statusLabel")}</Label>
              <Select value={statusDraft} onValueChange={(v) => setStatusDraft(v as WeatherDecisionStatus)}>
                <SelectTrigger id="weather-decision-status" disabled={saving}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">{t("events.weatherDecision.status.confirmed")}</SelectItem>
                  <SelectItem value="weather_pending">{t("events.weatherDecision.status.weather_pending")}</SelectItem>
                  <SelectItem value="cancelled">{t("events.weatherDecision.status.cancelled")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="weather-decision-note" className="text-xs">{t("events.weatherDecision.noteLabel")}</Label>
              <Textarea id="weather-decision-note" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={2} disabled={saving} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={saving}>{t("common.save")}</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>{t("common.cancel")}</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
