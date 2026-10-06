import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { fetchAllPages } from "@/lib/csv-export";
import { canSubmit, skippedSummary, type BatchResult, type ConfirmationStatus } from "@/lib/flight-confirmation";
import { fetchMySchools, type SchoolOption } from "@/lib/my-schools";

interface Candidate { id: string; flight_no: number; date: string; source: string; takeoff: { name: string | null } | null; landing: { name: string | null } | null }

/**
 * Submit several flights at once for confirmation (e.g. after importing a Flightbook logbook,
 * variant B). The instructor still confirms each flight on its own record.
 */
export default function SubmitFlightsDialog({ open, onOpenChange, locale }: { open: boolean; onOpenChange: (open: boolean) => void; locale: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setCandidates(null);
    setSelected(new Set());
    (async () => {
      try {
        const [flights, confirmations, mine] = await Promise.all([
          fetchAllPages<Candidate>((from, to) => supabase.from("flights")
            .select("id, flight_no, date, source, takeoff:locations!flights_takeoff_location_id_fkey(name:display_name), landing:locations!flights_landing_location_id_fkey(name:display_name)")
            .eq("user_id", user.id).is("cancelled_at" as never, null).order("flight_no", { ascending: true }).range(from, to) as never),
          fetchAllPages<{ flight_id: string; status: ConfirmationStatus }>((from, to) => supabase
            .from("flight_confirmations").select("flight_id, status").eq("student_id", user.id).range(from, to) as never),
          fetchMySchools(user.id),
        ]);
        const status = new Map(confirmations.map((c) => [c.flight_id, c.status]));
        setCandidates(flights.filter((f) => canSubmit(status.get(f.id))));
        setSchools(mine);
        setSchoolId((prev) => prev || mine[0]?.id || "");
      } catch (err) {
        toast({ title: t("common.error"), description: (err as Error).message, variant: "destructive" });
        onOpenChange(false);
      }
    })();
  }, [open, user, t, toast, onOpenChange]);

  const allSelected = useMemo(() => !!candidates?.length && candidates.every((c) => selected.has(c.id)), [candidates, selected]);
  const toggle = (id: string) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const submit = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("submit_flights_for_confirmation" as never, { _flight_ids: [...selected], _group_id: schoolId } as never);
      if (error) throw error;
      const result = data as unknown as BatchResult;
      const skipped = skippedSummary(result.skipped).map(([reason, n]) => `${n}× ${t(`confirmations.skip.${reason}`, { defaultValue: reason })}`).join(", ");
      toast({ title: t("confirmations.submittedMany", { count: result.submitted ?? 0 }), description: skipped || undefined });
      onOpenChange(false);
    } catch (err) {
      toast({ title: t("common.error"), description: (err as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("confirmations.submitTitle")}</DialogTitle>
          <DialogDescription>{t("confirmations.submitHint")}</DialogDescription>
        </DialogHeader>
        {candidates === null ? <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          : schools.length === 0 ? <p className="text-sm text-muted-foreground">{t("confirmations.noSchool")}</p>
          : candidates.length === 0 ? <p className="text-sm text-muted-foreground">{t("confirmations.nothingToSubmit")}</p>
          : (
            <div className="space-y-3">
              {schools.length > 1 && (
                <Select value={schoolId} onValueChange={setSchoolId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox checked={allSelected} onCheckedChange={(v) => setSelected(v ? new Set(candidates.map((c) => c.id)) : new Set())} />
                {t("confirmations.selectAll", { count: candidates.length })}
              </label>
              <div className="max-h-72 overflow-y-auto rounded border divide-y">
                {candidates.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer">
                    <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                    <span className="tabular-nums w-8 text-muted-foreground">{c.flight_no}</span>
                    <span className="tabular-nums w-20">{new Date(`${c.date}T00:00:00`).toLocaleDateString(locale)}</span>
                    <span className="truncate flex-1">{c.takeoff?.name || "—"} → {c.landing?.name || "—"}</span>
                    {c.source === "flightbook" && <span className="text-[10px] text-muted-foreground">{t("flightProof.fromFlightbook")}</span>}
                  </label>
                ))}
              </div>
            </div>
          )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button disabled={busy || selected.size === 0 || !schoolId} onClick={() => void submit()}>
            {t("confirmations.submitCount", { count: selected.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
