import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Props {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Vorausgewählter Termin, z. B. beim Schnellzugriff aus der Terminansicht. */
  presetEventId?: string;
  /** Wird nach erfolgreichem Speichern aufgerufen (z. B. um eine Liste neu zu laden). */
  onSaved?: () => void;
}

const emptyForm = (presetEventId?: string) => ({
  occurred_at: new Date().toISOString().slice(0, 16),
  event_id: presetEventId || "",
  involved_persons: "",
  description: "",
  measures: "",
});

/** Formular zur Unfall-/Vorfallmeldung (Abschnitt 4.1), wiederverwendbar als eigenständiger Dialog. */
export default function IncidentReportDialog({ groupId, open, onOpenChange, presetEventId, onSaved }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<{ id: string; title: string; event_date: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm(presetEventId));

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm(presetEventId));
    let cancelled = false;
    supabase
      .from("flight_events")
      .select("id, title, event_date")
      .eq("group_id", groupId)
      .order("event_date", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!cancelled) setEvents(data || []);
      });
    return () => { cancelled = true; };
  }, [open, groupId, presetEventId]);

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
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
  );
}
