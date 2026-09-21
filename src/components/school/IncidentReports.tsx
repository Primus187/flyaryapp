import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EmptyState from "@/components/layout/EmptyState";
import { AlertTriangle, Plus, Printer, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  groupId: string;
  /** Wenn gesetzt, ist der Termin beim Erfassen vorausgewählt. */
  presetEventId?: string;
}

interface Incident {
  id: string;
  event_id: string | null;
  occurred_at: string;
  involved_persons: string | null;
  description: string;
  measures: string | null;
  status: string;
  submitted_at: string | null;
  shv_deadline: string | null;
}

const emptyForm = () => ({
  occurred_at: new Date().toISOString().slice(0, 16),
  event_id: "",
  involved_persons: "",
  description: "",
  measures: "",
});

export default function IncidentReports({ groupId, presetEventId }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [events, setEvents] = useState<{ id: string; title: string; event_date: string }[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const load = async () => {
    setLoading(true);
    const [incRes, evRes] = await Promise.all([
      supabase
        .from("incident_reports")
        .select("id, event_id, occurred_at, involved_persons, description, measures, status, submitted_at, shv_deadline")
        .eq("group_id", groupId)
        .order("occurred_at", { ascending: false }),
      supabase
        .from("flight_events")
        .select("id, title, event_date")
        .eq("group_id", groupId)
        .order("event_date", { ascending: false })
        .limit(50),
    ]);
    setIncidents((incRes.data || []) as Incident[]);
    setEvents(evRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (groupId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const openForm = () => {
    setForm({ ...emptyForm(), event_id: presetEventId || "" });
    setFormOpen(true);
  };

  const save = async () => {
    if (!user || !form.description.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("incident_reports").insert({
      group_id: groupId,
      event_id: form.event_id || null,
      reported_by: user.id,
      occurred_at: new Date(form.occurred_at).toISOString(),
      involved_persons: form.involved_persons.trim() || null,
      description: form.description.trim(),
      measures: form.measures.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: t("school.safety.saveFailed"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("school.safety.saved") });
    setFormOpen(false);
    load();
  };

  const markSubmitted = async (inc: Incident) => {
    const submitted = !inc.submitted_at;
    await supabase
      .from("incident_reports")
      .update({
        submitted_at: submitted ? new Date().toISOString() : null,
        status: submitted ? "submitted" : "open",
      })
      .eq("id", inc.id);
    setIncidents((prev) =>
      prev.map((i) =>
        i.id === inc.id
          ? { ...i, submitted_at: submitted ? new Date().toISOString() : null, status: submitted ? "submitted" : "open" }
          : i,
      ),
    );
  };

  const printIncident = (inc: Incident) => {
    const ev = events.find((e) => e.id === inc.event_id);
    const win = window.open("", "_blank");
    if (!win) return;
    const rows: [string, string][] = [
      [t("school.safety.occurredAt"), new Date(inc.occurred_at).toLocaleString("de-CH")],
      [t("school.safety.event"), ev?.title || "—"],
      [t("school.safety.involved"), inc.involved_persons || "—"],
      [t("school.safety.description"), inc.description],
      [t("school.safety.measures"), inc.measures || "—"],
      [t("school.safety.deadline"), inc.shv_deadline || "—"],
    ];
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${t("school.safety.pdfTitle")}</title>
      <style>body{font-family:Helvetica,Arial,sans-serif;margin:32px;color:#111}
      h1{font-size:18px;margin:0 0 4px}h2{font-size:12px;font-weight:400;color:#555;margin:0 0 24px}
      table{width:100%;border-collapse:collapse}th{text-align:left;width:32%;vertical-align:top;padding:8px 8px 8px 0;font-size:12px;color:#555}
      td{padding:8px 0;font-size:13px;border-bottom:1px solid #eee;white-space:pre-wrap}</style></head><body>
      <h1>${t("school.safety.pdfTitle")}</h1><h2>${t("school.safety.pdfSubtitle")}</h2>
      <table>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${String(v).replace(/</g, "&lt;")}</td></tr>`).join("")}</table>
      </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const daysLeft = (inc: Incident) => {
    if (!inc.shv_deadline) return null;
    const diff = Math.ceil((new Date(inc.shv_deadline).getTime() - Date.now()) / 86400000);
    return diff;
  };

  const openCount = useMemo(() => incidents.filter((i) => !i.submitted_at).length, [incidents]);

  if (loading) return <Skeleton className="h-40 w-full rounded-2xl" />;

  return (
    <div className="space-y-3 pt-3">
      <Button onClick={openForm} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        {t("school.safety.report")}
      </Button>

      {openCount > 0 && (
        <p className="text-xs text-amber-500 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          {t("school.safety.openCount", { count: openCount })}
        </p>
      )}

      {incidents.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title={t("school.safety.empty")}
          description={t("school.safety.emptyHint")}
          actionLabel={t("school.safety.report")}
          onAction={openForm}
        />
      ) : (
        incidents.map((inc) => {
          const left = daysLeft(inc);
          return (
            <Card key={inc.id} className="border-border/60 bg-card/80">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{new Date(inc.occurred_at).toLocaleString("de-CH")}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{inc.description}</p>
                  </div>
                  <Badge variant={inc.submitted_at ? "outline" : "secondary"} className="text-[10px] shrink-0">
                    {t(`school.safety.status.${inc.submitted_at ? "submitted" : "open"}`)}
                  </Badge>
                </div>
                {!inc.submitted_at && left !== null && (
                  <p className={`text-xs ${left <= 3 ? "text-destructive" : "text-muted-foreground"}`}>
                    {left >= 0
                      ? t("school.safety.countdown", { days: left })
                      : t("school.safety.overdue", { days: Math.abs(left) })}
                  </p>
                )}
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="secondary" onClick={() => printIncident(inc)}>
                    <Printer className="h-3.5 w-3.5 mr-1" />
                    {t("school.safety.print")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => markSubmitted(inc)}>
                    <Check className="h-3.5 w-3.5 mr-1" />
                    {inc.submitted_at ? t("school.safety.markOpen") : t("school.safety.markSubmitted")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("school.safety.report")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("school.safety.occurredAt")}</Label>
              <Input
                type="datetime-local"
                value={form.occurred_at}
                onChange={(e) => setForm({ ...form, occurred_at: e.target.value })}
              />
            </div>
            <div>
              <Label>{t("school.safety.event")}</Label>
              <Select value={form.event_id || "none"} onValueChange={(v) => setForm({ ...form, event_id: v === "none" ? "" : v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("school.safety.noEvent")}</SelectItem>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {new Date(e.event_date).toLocaleDateString("de-CH")} · {e.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("school.safety.involved")}</Label>
              <Input
                value={form.involved_persons}
                onChange={(e) => setForm({ ...form, involved_persons: e.target.value })}
                placeholder={t("school.safety.involvedPlaceholder")}
              />
            </div>
            <div>
              <Label>{t("school.safety.description")}</Label>
              <Textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t("school.safety.descriptionPlaceholder")}
              />
            </div>
            <div>
              <Label>{t("school.safety.measures")}</Label>
              <Textarea rows={2} value={form.measures} onChange={(e) => setForm({ ...form, measures: e.target.value })} />
            </div>
            <p className="text-[11px] text-muted-foreground">{t("school.safety.deadlineHint")}</p>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={saving || !form.description.trim()}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
