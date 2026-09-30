import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HardDrive } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import LoadingState from "@/components/layout/LoadingState";
import EmptyState from "@/components/layout/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BACKUP_STALE_HOURS, backupStatus } from "@/lib/ops-overview";

type Run = Tables<"ops_backup_runs">;

/** Reported backup runs (npm run backup, migration 0082), newest first. */
export default function AdminBackups() {
  const { t, i18n } = useTranslation();
  const [runs, setRuns] = useState<Run[] | null>(null);

  useEffect(() => {
    void supabase.from("ops_backup_runs").select("*").order("finished_at", { ascending: false }).limit(30)
      .then(({ data, error }) => {
        if (error) toast.error(t("common.error"));
        setRuns(data ?? []);
      });
  }, [t]);

  const when = (iso: string) => new Date(iso).toLocaleString(i18n.language, { dateStyle: "short", timeStyle: "short" });
  const status = runs && backupStatus({
    backup_last_at: runs[0]?.finished_at ?? null,
    backup_last_ok: runs[0]?.ok ?? null,
    backup_last_success_at: runs.find((r) => r.ok)?.finished_at ?? null,
  });

  return (
    <PageContainer className="space-y-4">
      <PageHeader title={t("ops.nav.backups")} subtitle={t("ops.backups.subtitle")} back="/admin" />
      {status && status !== "none" && (
        <p className={status === "ok" ? "text-sm" : "text-sm font-medium text-destructive"}>
          {t(`ops.backups.status.${status}`, { hours: BACKUP_STALE_HOURS })}
        </p>
      )}
      {runs === null ? <LoadingState header={false} /> : runs.length === 0 ? (
        <EmptyState icon={HardDrive} title={t("ops.backups.empty")} description={t("ops.backups.emptyHint")} />
      ) : runs.map((run) => (
        <Card key={run.id} className="border-0 shadow-sm">
          <CardContent className="space-y-1 p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={run.ok ? "secondary" : "destructive"}>{t(run.ok ? "ops.backups.ok" : "ops.backups.failed")}</Badge>
              <span className="font-medium">{when(run.finished_at)}</span>
              {run.host && <span className="text-xs text-muted-foreground">{run.host}</span>}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("ops.backups.stats", {
                tables: run.tables ?? 0, rows: (run.rows_total ?? 0).toLocaleString(i18n.language),
                files: run.files_total ?? 0, failed: run.files_failed ?? 0,
              })}
              {run.snapshot ? ` · ${run.snapshot}` : ""}{run.git_commit ? ` · ${run.git_commit.slice(0, 7)}` : ""}
            </p>
            {run.message && <p className="break-words text-xs text-destructive">{run.message}</p>}
          </CardContent>
        </Card>
      ))}
    </PageContainer>
  );
}
