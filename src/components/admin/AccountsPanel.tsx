import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PauseCircle, PlayCircle, Search, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import LoadingState from "@/components/layout/LoadingState";
import EmptyState from "@/components/layout/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  accountStatus, cleanRevokeReason, countByStatus, fetchAccounts, filterAccounts, grantAccess, restoreAccess, revokeAccess,
  REVOKE_REASON_MAX, type AccountFilter, type AccountRow,
} from "@/lib/ops-access";
import { cn } from "@/lib/utils";

const FILTERS: AccountFilter[] = ["all", "active", "paused", "none"];

/** Accounts tab of "Zugänge" (ops_access_list, migration 0084): pause, restore or grant app access. */
export default function AccountsPanel() {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState<AccountRow[] | null>(null);
  const [filter, setFilter] = useState<AccountFilter>("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [pausing, setPausing] = useState<AccountRow | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    try { setRows(await fetchAccounts()); } catch { toast.error(t("common.error")); setRows([]); }
  }, [t]);
  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => filterAccounts(rows ?? [], filter, search), [rows, filter, search]);
  const counts = useMemo(() => countByStatus(rows ?? []), [rows]);
  const when = (iso: string | null) => iso ? new Date(iso).toLocaleDateString(i18n.language, { dateStyle: "short" }) : "–";

  const run = async (row: AccountRow, work: () => Promise<void>, done: string) => {
    setBusy(row.user_id);
    try { await work(); toast.success(t(done, { name: row.name })); await load(); } catch { toast.error(t("common.error")); }
    setBusy(null);
  };
  const confirmPause = () => {
    const row = pausing;
    const clean = cleanRevokeReason(reason);
    if (!row || !clean) return;
    setPausing(null);
    void run(row, () => revokeAccess(row.user_id, clean), "adminAccess.paused");
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("adminAccess.search")} className="pl-9" />
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === f ? "border-primary bg-accent text-accent-foreground" : "border-border bg-background text-muted-foreground")}>
            {t(`adminAccess.filter.${f}`)} · {counts[f]}
          </button>
        ))}
      </div>

      {rows === null ? <LoadingState header={false} /> : visible.length === 0 ? (
        <EmptyState icon={Users} title={t("adminAccess.empty")} />
      ) : visible.map((row) => {
        const status = accountStatus(row);
        return (
          <Card key={row.user_id}>
            <CardContent className="space-y-1.5 p-4 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{row.name}</p>
                {row.email && <a className="break-all text-xs text-primary" href={`mailto:${row.email}`}>{row.email}</a>}
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge variant={status === "paused" ? "destructive" : status === "none" ? "outline" : "secondary"} className="text-[10px]">
                  {t(`adminAccess.status.${status}`)}
                </Badge>
                {row.granted_via && status === "active" && <Badge variant="outline" className="text-[10px]">{t(`adminAccess.via.${row.granted_via}`)}</Badge>}
                {row.is_admin && <Badge className="text-[10px]">{t("adminAccess.admin")}</Badge>}
                {row.schools.map((s) => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("adminAccess.dates", { created: when(row.created_at), lastSeen: when(row.last_sign_in_at) })}
              </p>
              {status === "paused" && row.revoke_reason && (
                <p className="text-xs">{t("adminAccess.reasonLabel", { date: when(row.revoked_at), reason: row.revoke_reason })}</p>
              )}
              {!row.is_admin && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {status === "active" && (
                    <Button size="sm" variant="outline" className="h-7 gap-1" disabled={busy === row.user_id}
                      onClick={() => { setReason(""); setPausing(row); }}>
                      <PauseCircle className="h-3.5 w-3.5" />{t("adminAccess.pause")}
                    </Button>
                  )}
                  {status === "paused" && (
                    <Button size="sm" className="h-7 gap-1" disabled={busy === row.user_id}
                      onClick={() => { if (confirm(t("adminAccess.restoreConfirm", { name: row.name }))) void run(row, () => restoreAccess(row.user_id), "adminAccess.restored"); }}>
                      <PlayCircle className="h-3.5 w-3.5" />{t("adminAccess.restore")}
                    </Button>
                  )}
                  {status === "none" && (
                    <Button size="sm" className="h-7 gap-1" disabled={busy === row.user_id}
                      onClick={() => void run(row, () => grantAccess(row.user_id), "adminAccess.granted")}>
                      <ShieldCheck className="h-3.5 w-3.5" />{t("adminAccess.grant")}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!pausing} onOpenChange={(open) => { if (!open) setPausing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("adminAccess.pauseTitle", { name: pausing?.name ?? "" })}</DialogTitle>
            <DialogDescription>{t("adminAccess.pauseHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="pause-reason" className="text-xs">{t("adminAccess.reason")}</Label>
            <Textarea id="pause-reason" value={reason} maxLength={REVOKE_REASON_MAX} rows={3} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPausing(null)}>{t("common.cancel")}</Button>
            <Button variant="destructive" disabled={!cleanRevokeReason(reason)} onClick={confirmPause}>{t("adminAccess.pause")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
