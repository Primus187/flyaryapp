import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Undo2, Ban, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import EmptyState from "@/components/layout/EmptyState";
import { useToast } from "@/hooks/use-toast";
import { confirmableIds, groupByStudent, isBulkConfirmable, skippedSummary, type BatchResult, type SchoolConfirmationRow } from "@/lib/flight-confirmation";

type Tab = "submitted" | "confirmed";
type ReasonAction = { kind: "return" | "revoke"; row: SchoolConfirmationRow } | null;

/**
 * Instructors confirm submitted training flights (migration 0074). Several can be selected at once;
 * the database stores one confirmation per flight and checks the instructor's certificate for the
 * flight's discipline. The stamped printout stays the legal proof.
 */
export default function SchoolConfirmations({ groupId }: { groupId: string }) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";
  const [tab, setTab] = useState<Tab>("submitted");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [reasonAction, setReasonAction] = useState<ReasonAction>(null);
  const [reason, setReason] = useState("");
  // Flights without a flight kind can be marked as altitude flights while confirming (logged).
  const [setKindAltitude, setSetKindAltitude] = useState(false);
  const [soloRow, setSoloRow] = useState<SchoolConfirmationRow | null>(null);
  const [checklist, setChecklist] = useState({ briefing: false, contact: false, readiness: false, note: "" });

  const query = useQuery({
    queryKey: ["school-confirmations", groupId, tab],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("school_flight_confirmations" as never, { _group_id: groupId, _status: tab } as never);
      if (error) throw error;
      return (data ?? []) as unknown as SchoolConfirmationRow[];
    },
  });
  const rows = useMemo(() => query.data ?? [], [query.data]);
  const groups = useMemo(() => groupByStudent(rows, t("common.unknown")), [rows, t]);
  const toConfirm = confirmableIds(rows, selected);
  const anyQualified = rows.some((r) => r.canConfirm);

  const refresh = async () => {
    setSelected(new Set());
    await queryClient.invalidateQueries({ queryKey: ["school-confirmations", groupId] });
  };
  const toggle = (ids: string[], on: boolean) => setSelected((prev) => {
    const next = new Set(prev);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    return next;
  });

  const confirmSelected = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("confirm_flights" as never, { _flight_ids: toConfirm, _group_id: groupId, _set_kind: setKindAltitude ? "altitude" : null } as never);
      if (error) throw error;
      const result = data as unknown as BatchResult;
      const skipped = skippedSummary(result.skipped).map(([r, n]) => `${n}× ${t(`confirmations.skip.${r}`, { defaultValue: r })}`).join(", ");
      toast({ title: t("confirmations.confirmedMany", { count: result.confirmed ?? 0 }), description: skipped || undefined });
      await refresh();
    } catch (err) {
      toast({ title: t("common.error"), description: (err as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const confirmSolo = async () => {
    if (!soloRow) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("confirm_solo_flight" as never, {
        _flight_id: soloRow.flightId, _group_id: groupId, _briefing: checklist.briefing, _contact: checklist.contact,
        _readiness: checklist.readiness, _note: checklist.note.trim() || null,
      } as never);
      if (error) throw error;
      toast({ title: t("confirmations.soloConfirmed") });
      setSoloRow(null);
      setChecklist({ briefing: false, contact: false, readiness: false, note: "" });
      await refresh();
    } catch (err) {
      toast({ title: t("common.error"), description: (err as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const runReasonAction = async () => {
    if (!reasonAction || !reason.trim()) return;
    setBusy(true);
    try {
      const fn = reasonAction.kind === "return" ? "return_flight_for_correction" : "revoke_flight_confirmation";
      const { error } = await supabase.rpc(fn as never, { _flight_id: reasonAction.row.flightId, _reason: reason.trim() } as never);
      if (error) throw error;
      toast({ title: t(reasonAction.kind === "return" ? "confirmations.returnedDone" : "confirmations.revokedDone") });
      setReasonAction(null);
      setReason("");
      await refresh();
    } catch (err) {
      toast({ title: t("common.error"), description: (err as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const date = (iso: string | null | undefined) => iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString(locale) : "";
  const kindLabel = (row: SchoolConfirmationRow) => [
    row.flight?.discipline === "hangglider" ? t("flightProof.discipline.hangglider") : null,
    row.flight?.isTandem ? t("flightProof.tandem") : null,
    row.flight?.flightKind ? t(`flightProof.kind.${row.flight.flightKind}`) : null,
    row.flight?.isSoloShv ? t("flights.soloShv") : null,
    row.flight?.source === "flightbook" ? t("flightProof.fromFlightbook") : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{t("confirmations.schoolHint")}</p>
      <Tabs value={tab} onValueChange={(v) => { setTab(v as Tab); setSelected(new Set()); }}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="submitted">{t("confirmations.tabOpen")}</TabsTrigger>
          <TabsTrigger value="confirmed">{t("confirmations.tabConfirmed")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {query.isPending ? <Skeleton className="h-40 w-full rounded-2xl" />
        : query.isError ? (
          <div role="alert" className="space-y-2"><p className="text-sm">{t("performance.loadFailed")}</p>
            <Button size="sm" onClick={() => void query.refetch()}>{t("performance.retry")}</Button></div>
        ) : rows.length === 0 ? (
          <EmptyState icon={BadgeCheck} title={t(tab === "submitted" ? "confirmations.emptyOpen" : "confirmations.emptyConfirmed")} />
        ) : (
          <>
            {tab === "submitted" && !anyQualified && (
              <p className="text-xs text-warning-soft-foreground flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />{t("confirmations.noCertificate")}</p>
            )}
            {groups.map((g) => {
              const ids = g.rows.filter(isBulkConfirmable).map((r) => r.flightId);
              const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
              return (
                <Card key={g.studentId}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{g.studentName} <span className="font-normal text-muted-foreground">· {g.rows.length}</span></p>
                      {tab === "submitted" && ids.length > 0 && (
                        <label className="flex items-center gap-1.5 text-xs"><Checkbox checked={allOn} onCheckedChange={(v) => toggle(ids, !!v)} />{t("confirmations.selectStudent")}</label>
                      )}
                    </div>
                    <div className="divide-y">
                      {g.rows.map((r) => (
                        <div key={r.flightId} className="py-2 flex items-start gap-2 text-xs">
                          {tab === "submitted" && (
                            <Checkbox className="mt-0.5" disabled={!isBulkConfirmable(r)} checked={selected.has(r.flightId)}
                              onCheckedChange={(v) => toggle([r.flightId], !!v)} aria-label={t("confirmations.select")} />
                          )}
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <p className="font-medium">
                              {t("flightProof.number", { no: r.flight?.flightNo })} · {date(r.flight?.date)} · {r.flight?.takeoff?.name || "—"} → {r.flight?.landing?.name || "—"}
                            </p>
                            <p className="text-muted-foreground">
                              {[r.flight?.durationMinutes != null ? `${r.flight.durationMinutes} min` : null, r.flight?.glider, kindLabel(r)].filter(Boolean).join(" · ")}
                            </p>
                            {tab === "confirmed" && (
                              <p className="text-muted-foreground">{t("confirmations.confirmedByShort", { name: r.instructorName || "—", date: date(r.decidedAt) })}</p>
                            )}
                            <div className="flex flex-wrap gap-1">
                              {r.changedAfterConfirmation && <Badge variant="outline" className="text-[10px]">{t("confirmations.changedAfter")}</Badge>}
                              {r.cancelled && <Badge variant="destructive" className="text-[10px]">{t("confirmations.cancelled")}</Badge>}
                              {tab === "submitted" && !r.canConfirm && <Badge variant="outline" className="text-[10px]">{t("confirmations.notQualifiedShort")}</Badge>}
                              {tab === "submitted" && r.canConfirm && !r.cancelled && r.flight?.isSoloShv && (
                                <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => setSoloRow(r)}>{t("confirmations.confirmSolo")}</Button>
                              )}
                            </div>
                          </div>
                          {tab === "submitted" && (
                            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setReasonAction({ kind: "return", row: r })} aria-label={t("confirmations.return")}>
                              <Undo2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {tab === "confirmed" && r.canConfirm && (
                            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setReasonAction({ kind: "revoke", row: r })} aria-label={t("confirmations.revoke")}>
                              <Ban className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </>
        )}

      {tab === "submitted" && rows.some((r) => isBulkConfirmable(r) && !r.flight?.flightKind) && (
        <label className="flex items-center gap-2 text-xs"><Checkbox checked={setKindAltitude} onCheckedChange={(v) => setSetKindAltitude(!!v)} />{t("confirmations.setKindAltitude")}</label>
      )}
      {tab === "submitted" && toConfirm.length > 0 && (
        <div className="sticky bottom-20 z-10">
          <Button className="w-full shadow-lg gap-2" disabled={busy} onClick={() => void confirmSelected()}>
            <BadgeCheck className="h-4 w-4" />{t("confirmations.confirmCount", { count: toConfirm.length })}
          </Button>
        </div>
      )}

      <Dialog open={!!soloRow} onOpenChange={(o) => { if (!o) setSoloRow(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("confirmations.soloTitle")}</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">{t("confirmations.soloHint")}</p>
          <div className="space-y-2">
            {(["briefing", "contact", "readiness"] as const).map((key) => (
              <label key={key} className="flex items-start gap-2 text-sm"><Checkbox className="mt-0.5" checked={checklist[key]} onCheckedChange={(v) => setChecklist({ ...checklist, [key]: !!v })} />{t(`confirmations.solo.${key}`)}</label>
            ))}
            <Textarea value={checklist.note} onChange={(e) => setChecklist({ ...checklist, note: e.target.value })} placeholder={t("confirmations.soloNote")} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSoloRow(null)}>{t("common.cancel")}</Button>
            <Button disabled={busy || !checklist.briefing || !checklist.contact || !checklist.readiness} onClick={() => void confirmSolo()}>{t("confirmations.confirmSolo")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reasonAction} onOpenChange={(o) => { if (!o) { setReasonAction(null); setReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t(reasonAction?.kind === "revoke" ? "confirmations.revokeTitle" : "confirmations.returnTitle")}</DialogTitle>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("confirmations.reasonPlaceholder")} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonAction(null)}>{t("common.cancel")}</Button>
            <Button variant={reasonAction?.kind === "revoke" ? "destructive" : "default"} disabled={busy || !reason.trim()} onClick={() => void runReasonAction()}>
              {t(reasonAction?.kind === "revoke" ? "confirmations.revoke" : "confirmations.return")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
