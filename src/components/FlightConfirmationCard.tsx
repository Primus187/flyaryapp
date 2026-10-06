import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BadgeCheck, Clock, Undo2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { canSubmit, type BatchResult, type FlightConfirmation } from "@/lib/flight-confirmation";
import { fetchMySchools, type SchoolOption } from "@/lib/my-schools";

/**
 * Confirmation of a training flight by an instructor (migration 0074), seen by the pilot: status,
 * who confirmed it when, and submitting / withdrawing.
 */
export default function FlightConfirmationCard({ flightId, cancelled, preferredGroupId, locale }: {
  flightId: string; cancelled: boolean; preferredGroupId?: string | null; locale: string;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [confirmation, setConfirmation] = useState<FlightConfirmation | null>(null);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [conf, mine] = await Promise.all([
      supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet (migration 0074)
        .from("flight_confirmations" as any)
        .select("flight_id, status, school_name, group_id, instructor_name, reason, submitted_at, decided_at")
        .eq("flight_id", flightId).maybeSingle(),
      fetchMySchools(user.id).catch(() => [] as SchoolOption[]),
    ]);
    setConfirmation((conf.data as unknown as FlightConfirmation) ?? null);
    setSchools(mine);
    setSchoolId((prev) => prev || mine.find((s) => s.id === preferredGroupId)?.id || mine[0]?.id || "");
    setLoaded(true);
  }, [user, flightId, preferredGroupId]);

  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); await load(); }
    catch (err) { toast({ title: t("common.error"), description: (err as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const submit = () => run(async () => {
    const { data, error } = await supabase.rpc("submit_flights_for_confirmation" as never, { _flight_ids: [flightId], _group_id: schoolId } as never);
    if (error) throw error;
    const result = data as unknown as BatchResult;
    if (result.submitted) toast({ title: t("confirmations.submitted") });
    else toast({ title: t(`confirmations.skip.${result.skipped[0]?.reason}`, { defaultValue: t("confirmations.notSubmitted") }), variant: "destructive" });
  });

  const withdraw = () => run(async () => {
    const { error } = await supabase.rpc("withdraw_flight_submission" as never, { _flight_id: flightId } as never);
    if (error) throw error;
    toast({ title: t("confirmations.withdrawn") });
  });

  if (!loaded || (!confirmation && schools.length === 0)) return null;
  const status = confirmation?.status ?? null;
  const date = (iso: string | null) => iso ? new Date(iso).toLocaleDateString(locale) : "";

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t("confirmations.title")}</p>
        {status === "confirmed" && (
          <p className="text-sm flex items-start gap-2"><BadgeCheck className="h-4 w-4 text-success-soft-foreground shrink-0 mt-0.5" />
            {t("confirmations.confirmedBy", { name: confirmation!.instructor_name || "—", school: confirmation!.school_name, date: date(confirmation!.decided_at) })}</p>
        )}
        {status === "submitted" && (
          <p className="text-sm flex items-start gap-2"><Clock className="h-4 w-4 text-warning-soft-foreground shrink-0 mt-0.5" />
            {t("confirmations.submittedTo", { school: confirmation!.school_name, date: date(confirmation!.submitted_at) })}</p>
        )}
        {(status === "returned" || status === "revoked") && (
          <p className="text-sm flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            {t(`confirmations.${status}Reason`, { school: confirmation!.school_name, reason: confirmation!.reason || "—" })}</p>
        )}
        {(!status || status === "withdrawn") && <p className="text-sm text-muted-foreground">{t("confirmations.notSubmittedYet")}</p>}

        {canSubmit(status) && !cancelled && schools.length > 0 && (
          <div className="flex gap-2 items-center">
            {schools.length > 1 && (
              <Select value={schoolId} onValueChange={setSchoolId}>
                <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>{schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <Button size="sm" className="h-8" disabled={busy || !schoolId} onClick={() => void submit()}>
              {status ? t("confirmations.resubmit") : t("confirmations.submit")}
            </Button>
          </div>
        )}
        {(status === "submitted" || status === "returned") && (
          <Button size="sm" variant="outline" className="h-8 gap-1" disabled={busy} onClick={() => void withdraw()}>
            <Undo2 className="h-3.5 w-3.5" />{t("confirmations.withdraw")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
