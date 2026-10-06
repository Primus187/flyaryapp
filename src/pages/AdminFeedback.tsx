import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mail, MessageSquare, Save } from "lucide-react";
import { toast } from "sonner";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import LoadingState from "@/components/layout/LoadingState";
import EmptyState from "@/components/layout/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  FEEDBACK_KINDS, fetchFeedbackList, filterFeedback, replyMailto, screenshotUrls, setFeedback,
  type FeedbackKind, type FeedbackRow, type FeedbackStatus,
} from "@/lib/feedback";
import { cn } from "@/lib/utils";

const STATUS_FILTERS = ["open", "new", "in_progress", "done", "all"] as const;
const STATUSES: FeedbackStatus[] = ["new", "in_progress", "done"];

/** Betriebsbereich "Feedback" (plan §7, migration 0086): tester feedback with screenshots, status and note. */
export default function AdminFeedback() {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("open");
  const [kind, setKind] = useState<FeedbackKind | "all">("all");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [zoom, setZoom] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await fetchFeedbackList();
      setRows(list);
      setUrls(await screenshotUrls(list.flatMap((r) => r.screenshot_paths)));
    } catch {
      toast.error(t("common.error"));
      setRows([]);
    }
  }, [t]);
  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => filterFeedback(rows ?? [], status, kind), [rows, status, kind]);
  const when = (iso: string) => new Date(iso).toLocaleString(i18n.language, { dateStyle: "short", timeStyle: "short" });

  const save = async (row: FeedbackRow, next: FeedbackStatus) => {
    try {
      await setFeedback(row.id, next, notes[row.id] ?? row.admin_note ?? "");
      toast.success(t("adminFeedback.saved"));
      setNotes((cur) => { const copy = { ...cur }; delete copy[row.id]; return copy; });
      await load();
    } catch {
      toast.error(t("common.error"));
    }
  };

  const chip = (active: boolean) => cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
    active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground");

  return (
    <PageContainer className="space-y-4">
      <PageHeader title={t("ops.nav.feedback")} subtitle={t("adminFeedback.subtitle")} back="/admin" />
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => <button key={s} type="button" className={chip(status === s)} onClick={() => setStatus(s)}>{t(`adminFeedback.filter.${s}`)}</button>)}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={chip(kind === "all")} onClick={() => setKind("all")}>{t("adminFeedback.filter.all")}</button>
        {FEEDBACK_KINDS.map((k) => <button key={k} type="button" className={chip(kind === k)} onClick={() => setKind(k)}>{t(`feedback.kind.${k}`)}</button>)}
      </div>

      {rows === null ? <LoadingState header={false} /> : visible.length === 0 ? (
        <EmptyState icon={MessageSquare} title={t("adminFeedback.empty")} description={t("adminFeedback.emptyHint")} />
      ) : visible.map((row) => {
        const reply = replyMailto(row, i18n.language);
        const note = notes[row.id] ?? row.admin_note ?? "";
        return (
          <Card key={row.id}>
            <CardContent className="space-y-2 p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={row.kind === "problem" ? "destructive" : "secondary"} className="text-[10px]">{t(`feedback.kind.${row.kind}`)}</Badge>
                <Badge variant="outline" className="text-[10px]">{t(`adminFeedback.status.${row.status}`)}</Badge>
                <span className="text-xs text-muted-foreground">{when(row.created_at)} · {row.name ?? "–"}</span>
              </div>
              <p className="whitespace-pre-wrap break-words">{row.message}</p>
              {row.screenshot_paths.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {row.screenshot_paths.map((p) => urls[p] ? (
                    <button key={p} type="button" onClick={() => setZoom(urls[p])} className="h-24 w-16 overflow-hidden rounded-md border">
                      <img src={urls[p]} alt="" className="h-full w-full object-cover object-top" loading="lazy" />
                    </button>
                  ) : <span key={p} className="text-[11px] text-muted-foreground">{t("adminFeedback.screenshotGone")}</span>)}
                </div>
              )}
              <p className="break-all text-[11px] text-muted-foreground">{row.path ?? "–"} · {row.app_version ?? "–"} · {row.user_agent ?? "–"}</p>
              <Textarea value={note} maxLength={1000} rows={2} placeholder={t("adminFeedback.notePlaceholder")}
                onChange={(e) => setNotes((cur) => ({ ...cur, [row.id]: e.target.value }))} />
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <Button key={s} size="sm" variant={row.status === s ? "default" : "outline"} className="h-7 gap-1" onClick={() => void save(row, s)}>
                    {row.status === s && notes[row.id] !== undefined ? <Save className="h-3.5 w-3.5" /> : null}{t(`adminFeedback.status.${s}`)}
                  </Button>
                ))}
                {reply && <Button size="sm" variant="ghost" className="h-7 gap-1" asChild><a href={reply}><Mail className="h-3.5 w-3.5" />{t("adminFeedback.reply")}</a></Button>}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!zoom} onOpenChange={(open) => { if (!open) setZoom(null); }}>
        <DialogContent className="max-h-[95vh] max-w-3xl overflow-auto p-2">
          <DialogTitle className="sr-only">{t("adminFeedback.screenshot")}</DialogTitle>
          {zoom && <img src={zoom} alt="" className="mx-auto h-auto max-w-full" />}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
