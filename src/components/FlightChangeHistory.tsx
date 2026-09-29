import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { History, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { changeActor, formatChangeValue, type FlightChange } from "@/lib/flight-proof";
import { cn } from "@/lib/utils";

/**
 * Change history of a flight (migration 0073): who changed which proof field when, old → new.
 * Visible to the pilot and the staff of the flight's school; loaded when opened.
 */
export default function FlightChangeHistory({ flightId, locale }: { flightId: string; locale: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [changes, setChanges] = useState<FlightChange[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || changes !== null) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet (migration 0073)
        .from("flight_changes" as any)
        .select("id, field, old_value, new_value, changed_by, origin, changed_at")
        .eq("flight_id", flightId)
        .order("changed_at", { ascending: false })
        .order("id", { ascending: false });
      if (cancelled) return;
      if (error) { setFailed(true); setChanges([]); return; }
      const rows = (data ?? []) as unknown as FlightChange[];
      setChanges(rows);
      const people = [...new Set(rows.map((r) => r.changed_by).filter((v): v is string => !!v))];
      if (people.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, pilot_name").in("user_id", people);
        if (!cancelled && profiles) setNames(Object.fromEntries(profiles.map((p) => [p.user_id, p.pilot_name || ""])));
      }
    })();
    return () => { cancelled = true; };
  }, [open, changes, flightId]);

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-0">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          className="w-full flex items-center justify-between gap-2 p-3 text-left">
          <span className="flex items-center gap-2 text-sm font-medium"><History className="h-4 w-4 text-muted-foreground" />{t("flightProof.history")}</span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="px-3 pb-3 space-y-2">
            {changes === null && <p className="text-xs text-muted-foreground">{t("common.loading")}</p>}
            {failed && <p className="text-xs text-destructive">{t("flightProof.historyError")}</p>}
            {changes !== null && !failed && changes.length === 0 && <p className="text-xs text-muted-foreground">{t("flightProof.historyEmpty")}</p>}
            {changes?.map((c) => (
              <div key={c.id} className="text-xs border-l-2 border-muted pl-2">
                <p className="text-muted-foreground">
                  {new Date(c.changed_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })} · {changeActor(c, names, t)}
                </p>
                <p>
                  <span className="font-medium">{t(`flightProof.field.${c.field}`, { defaultValue: c.field })}:</span>{" "}
                  <span className="text-muted-foreground line-through decoration-muted-foreground/50">{formatChangeValue(c.field, c.old_value, t, locale)}</span>
                  {" → "}
                  <span>{formatChangeValue(c.field, c.new_value, t, locale)}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
