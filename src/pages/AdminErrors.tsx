import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import LoadingState from "@/components/layout/LoadingState";
import EmptyState from "@/components/layout/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ErrorRow = Tables<"client_errors">;

/** Error log for Flyary admins: what the app caught on users' devices (client_errors, migration 0049). */
export default function AdminErrors() {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState<ErrorRow[] | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    let query = supabase.from("client_errors").select("*").order("last_seen_at", { ascending: false }).limit(200);
    if (!showResolved) query = query.is("resolved_at", null);
    const { data, error } = await query;
    if (error) { toast.error(t("common.error")); setRows([]); return; }
    setRows(data ?? []);
  }, [showResolved, t]);

  useEffect(() => { void load(); }, [load]);

  const resolve = async (row: ErrorRow) => {
    const { error } = await supabase.from("client_errors").update({ resolved_at: new Date().toISOString() }).eq("id", row.id);
    if (error) { toast.error(t("common.error")); return; }
    toast.success(t("adminErrors.resolved"));
    void load();
  };

  const when = (iso: string) => new Date(iso).toLocaleString(i18n.language, { dateStyle: "short", timeStyle: "short" });

  return (
    <PageContainer className="space-y-4">
      <PageHeader
        title={t("adminErrors.title")}
        subtitle={t("adminErrors.subtitle")}
        back="/more"
        action={
          <Button size="sm" variant="outline" onClick={() => setShowResolved((v) => !v)}>
            {showResolved ? t("adminErrors.onlyOpen") : t("adminErrors.showResolved")}
          </Button>
        }
      />
      {rows === null ? <LoadingState header={false} /> : rows.length === 0 ? (
        <EmptyState icon={CheckCircle2} title={t("adminErrors.empty")} description={t("adminErrors.emptyHint")} />
      ) : rows.map((row) => (
        <Card key={row.id} className="border-0 shadow-sm">
          <CardContent className="space-y-2 p-4">
            <button type="button" className="w-full space-y-1 text-left" onClick={() => setOpen(open === row.id ? null : row.id)}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={row.kind === "chunk" ? "secondary" : "destructive"}>{t(`adminErrors.kind.${row.kind}`)}</Badge>
                <span className="text-xs text-muted-foreground">
                  {t("adminErrors.stats", { count: row.occurrences, users: row.user_ids.length })} · {when(row.last_seen_at)}
                </span>
                {row.resolved_at && <Badge variant="outline">{t("adminErrors.done")}</Badge>}
              </div>
              <p className="break-words text-sm font-medium">{row.message}</p>
              <p className="text-xs text-muted-foreground">{row.path ?? "–"} · {row.app_version ?? "–"}</p>
            </button>
            {open === row.id && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{t("adminErrors.firstSeen")} {when(row.created_at)} · {row.user_agent ?? "–"}</p>
                {row.stack && <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-2 text-[11px]">{row.stack}</pre>}
              </div>
            )}
            {!row.resolved_at && (
              <Button size="sm" variant="outline" onClick={() => resolve(row)}>
                <Check className="mr-2 h-4 w-4" />{t("adminErrors.markResolved")}
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </PageContainer>
  );
}
