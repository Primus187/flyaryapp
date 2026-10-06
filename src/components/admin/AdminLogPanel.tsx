import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollText } from "lucide-react";
import { toast } from "sonner";
import LoadingState from "@/components/layout/LoadingState";
import EmptyState from "@/components/layout/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { fetchLogEntries, type LogEntry } from "@/lib/ops-access";

/** Log tab of "Zugänge": who granted, paused, restored or invited whom (ops_admin_log, migration 0084). */
export default function AdminLogPanel() {
  const { t, i18n } = useTranslation();
  const [entries, setEntries] = useState<LogEntry[] | null>(null);

  useEffect(() => {
    fetchLogEntries(200).then(setEntries).catch(() => { toast.error(t("common.error")); setEntries([]); });
  }, [t]);

  const when = (iso: string) => new Date(iso).toLocaleString(i18n.language, { dateStyle: "short", timeStyle: "short" });

  if (entries === null) return <LoadingState header={false} />;
  if (entries.length === 0) return <EmptyState icon={ScrollText} title={t("adminAccess.logEmpty")} />;
  return (
    <Card>
      <CardContent className="divide-y p-0">
        {entries.map((e) => {
          const reason = e.detail.reason ?? null;
          return (
            <div key={e.id} className="space-y-0.5 px-4 py-3 text-sm">
              <p><span className="font-medium">{t(`adminAccess.log.${e.action}`, { target: e.target_name ?? "–", group: e.group_name ?? "" })}</span></p>
              <p className="text-xs text-muted-foreground">{when(e.created_at)} · {e.actor_name ?? "–"}</p>
              {reason && <p className="text-xs">{reason}</p>}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
