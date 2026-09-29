import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Download, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import LoadingState from "@/components/layout/LoadingState";
import EmptyState from "@/components/layout/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/lib/csv-export";
import { waitlistCsv, type WaitlistRow } from "@/lib/waitlist";

/** Pilot sign-ups from the website (pilot_waitlist, migration 0078), for Flyary admins. */
export default function AdminWaitlist() {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState<WaitlistRow[] | null>(null);
  const [showHandled, setShowHandled] = useState(false);

  const load = useCallback(async () => {
    let query = supabase.from("pilot_waitlist" as never)
      .select("id, name, email, language, role, disciplines, school, comment, consent_at, created_at, updated_at, handled_at")
      .order("created_at", { ascending: false }).limit(500);
    if (!showHandled) query = query.is("handled_at", null);
    const { data, error } = await query;
    if (error) { toast.error(t("common.error")); setRows([]); return; }
    setRows((data ?? []) as unknown as WaitlistRow[]);
  }, [showHandled, t]);
  useEffect(() => { void load(); }, [load]);

  const markHandled = async (row: WaitlistRow) => {
    const { error } = await supabase.from("pilot_waitlist" as never).update({ handled_at: new Date().toISOString() } as never).eq("id", row.id);
    if (error) { toast.error(t("common.error")); return; }
    void load();
  };
  const remove = async (row: WaitlistRow) => {
    if (!confirm(t("adminWaitlist.deleteConfirm", { name: row.name }))) return;
    const { error } = await supabase.from("pilot_waitlist" as never).delete().eq("id", row.id);
    if (error) { toast.error(t("common.error")); return; }
    void load();
  };
  const exportCsv = () => {
    if (!rows?.length) return;
    downloadBlob(new Blob([waitlistCsv(rows)], { type: "text/csv;charset=utf-8" }), `flyary-testliste-${new Date().toISOString().slice(0, 10)}.csv`);
  };
  const when = (iso: string) => new Date(iso).toLocaleString(i18n.language, { dateStyle: "short", timeStyle: "short" });

  return (
    <PageContainer className="space-y-4">
      <PageHeader title={t("adminWaitlist.title")} subtitle={t("adminWaitlist.subtitle")} back="/more"
        action={<Button size="sm" variant="outline" onClick={() => setShowHandled((v) => !v)}>{showHandled ? t("adminWaitlist.onlyOpen") : t("adminWaitlist.showHandled")}</Button>} />
      {rows && rows.length > 0 && (
        <Button size="sm" variant="outline" className="gap-2" onClick={exportCsv}><Download className="h-4 w-4" />{t("adminWaitlist.export")}</Button>
      )}
      {rows === null ? <LoadingState header={false} /> : rows.length === 0 ? (
        <EmptyState icon={UserPlus} title={t("adminWaitlist.empty")} description={t("adminWaitlist.emptyHint")} />
      ) : rows.map((row) => (
        <Card key={row.id} className="border-0 shadow-sm">
          <CardContent className="space-y-1.5 p-4 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{row.name}</p>
                <a className="text-xs text-primary break-all" href={`mailto:${row.email}`}>{row.email}</a>
              </div>
              <span className="text-[11px] text-muted-foreground shrink-0">{when(row.created_at)}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary" className="text-[10px]">{t(`adminWaitlist.role.${row.role}`)}</Badge>
              {row.disciplines.map((d) => <Badge key={d} variant="outline" className="text-[10px]">{t(`flightProof.discipline.${d}`)}</Badge>)}
              <Badge variant="outline" className="text-[10px]">{row.language.toUpperCase()}</Badge>
              {row.handled_at && <Badge className="text-[10px]">{t("adminWaitlist.handled")}</Badge>}
            </div>
            {row.school && <p className="text-xs text-muted-foreground">{t("adminWaitlist.school")}: {row.school}</p>}
            {row.comment && <p className="text-xs whitespace-pre-wrap">{row.comment}</p>}
            <div className="flex gap-2 pt-1">
              {!row.handled_at && <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => void markHandled(row)}><Check className="h-3.5 w-3.5" />{t("adminWaitlist.markHandled")}</Button>}
              <Button size="sm" variant="ghost" className="h-7" onClick={() => void remove(row)} aria-label={t("common.delete")}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </PageContainer>
  );
}
