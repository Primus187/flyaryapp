import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import LocationCombobox from "@/components/LocationCombobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LANDING_HINT_OPTIONS, schoolFlightErrorKey, type LandingHintMinutes } from "@/lib/school-flights";

interface Site { id: string; name: string; type: string }

/** Default take-off and landing site of the flying day (new flights take them over, 4.3) and the
 *  optional landing hint (4.4). */
export default function DaySitesCard({ eventId, onChanged }: { eventId: string; onChanged?: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [own, setOwn] = useState<Site[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [takeoff, setTakeoff] = useState("");
  const [landing, setLanding] = useState("");
  const [hint, setHint] = useState<LandingHintMinutes>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadOwn = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("locations").select("id, name, type").eq("user_id", user.id).order("name");
    setOwn((data || []) as Site[]);
  }, [user]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("flight_events")
      .select("default_takeoff_location_id, default_landing_location_id, landing_hint_minutes").eq("id", eventId).maybeSingle();
    const ev = data;
    setHint((ev?.landing_hint_minutes ?? null) as LandingHintMinutes);
    const ids = [ev?.default_takeoff_location_id, ev?.default_landing_location_id].filter(Boolean) as string[];
    setTakeoff(ev?.default_takeoff_location_id || "");
    setLanding(ev?.default_landing_location_id || "");
    // The day's sites may belong to another instructor; migration 0052 makes them readable for the team.
    if (ids.length > 0) {
      const { data } = await supabase.from("locations").select("id, name").in("id", ids);
      setNames(Object.fromEntries((data || []).map((l) => [l.id, l.name])));
    }
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (editing) void loadOwn(); }, [editing, loadOwn]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("set_flight_day_locations", {
      _event_id: eventId, _takeoff_location_id: takeoff || null, _landing_location_id: landing || null,
    });
    const hintRes = error ? null : await supabase.rpc("set_flight_day_landing_hint", { _event_id: eventId, _minutes: hint });
    setSaving(false);
    const failed = error || hintRes?.error;
    if (failed) { toast({ title: t(`flightDay.errors.${schoolFlightErrorKey(failed.message)}`), variant: "destructive" }); return; }
    setEditing(false);
    await load();
    onChanged?.();
  };

  // Sites chosen earlier stay selectable even if they belong to someone else.
  const options = [...own, ...[takeoff, landing].filter((id) => id && !own.some((o) => o.id === id)).map((id) => ({ id, name: names[id] || "?", type: "both" }))];
  const label = (id: string) => (id ? names[id] || own.find((o) => o.id === id)?.name || "?" : t("flightDay.sites.notSet"));

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 text-xs">
            <p><span className="text-muted-foreground">{t("flightDay.sites.takeoff")}:</span> {label(takeoff)}</p>
            <p><span className="text-muted-foreground">{t("flightDay.sites.landing")}:</span> {label(landing)}</p>
            <p className="flex items-center gap-1"><Bell className="h-3 w-3 text-muted-foreground" /><span className="text-muted-foreground">{t("flightDay.sites.hintLabel")}:</span> {hint ? t("flightDay.sites.hintAfter", { minutes: hint }) : t("flightDay.sites.hintOff")}</p>
          </div>
          {!editing && <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditing(true)}>{t("flightDay.sites.change")}</Button>}
        </div>
        {editing && (
          <div className="space-y-2">
            <LocationCombobox locations={options} value={takeoff} onChange={setTakeoff} filterType="takeoff"
              placeholder={t("flightDay.sites.takeoff")} onLocationCreated={() => void loadOwn()} />
            <LocationCombobox locations={options} value={landing} onChange={setLanding} filterType="landing"
              placeholder={t("flightDay.sites.landing")} onLocationCreated={() => void loadOwn()} />
            <p className="text-[11px] text-muted-foreground">{t("flightDay.sites.hint")}</p>
            <Select value={hint === null ? "off" : String(hint)} onValueChange={(v) => setHint((v === "off" ? null : Number(v)) as LandingHintMinutes)}>
              <SelectTrigger aria-label={t("flightDay.sites.hintLabel")}><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANDING_HINT_OPTIONS.map((m) => (
                  <SelectItem key={m ?? "off"} value={m === null ? "off" : String(m)}>
                    {t("flightDay.sites.hintLabel")}: {m === null ? t("flightDay.sites.hintOff") : t("flightDay.sites.hintAfter", { minutes: m })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">{t("flightDay.sites.hintExplain")}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => { setEditing(false); void load(); }}>{t("common.cancel")}</Button>
              <Button size="sm" className="flex-1" onClick={save} disabled={saving}>{t("flightDay.sites.save")}</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
