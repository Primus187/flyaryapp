import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EmptyState from "@/components/layout/EmptyState";
import { Wrench, Plus, Check, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { maintenanceStatus } from "@/lib/equipment-maintenance";

const MAINTENANCE_TYPES = ["reserve_repack", "harness_check", "glider_check", "other"] as const;

interface Props {
  groupId: string;
}

interface Row {
  id: string;
  equipment_id: string;
  maintenance_type: string;
  due_at: string;
  completed_at: string | null;
  note: string | null;
}

export default function EquipmentMaintenance({ groupId }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [equipment, setEquipment] = useState<{ id: string; name: string }[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ equipment_id: "", maintenance_type: "reserve_repack", due_at: "", note: "" });

  const load = async () => {
    setLoading(true);
    const [mRes, eRes] = await Promise.all([
      supabase
        .from("equipment_maintenance")
        .select("id, equipment_id, maintenance_type, due_at, completed_at, note")
        .eq("group_id", groupId)
        .order("due_at", { ascending: true }),
      supabase.from("school_equipment").select("id, name").eq("group_id", groupId).order("name"),
    ]);
    setRows((mRes.data || []) as Row[]);
    setLoadError(!!mRes.error || !!eRes.error);
    setEquipment(eRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (groupId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const equipmentName = (id: string) => equipment.find((e) => e.id === id)?.name || "—";

  const open = useMemo(() => rows.filter((r) => !r.completed_at), [rows]);
  const dueSoon = useMemo(() => {
    return open.filter((r) => maintenanceStatus(r.due_at, r.completed_at) === "dueSoon");
  }, [open]);
  const overdueRows = open.filter((r) => maintenanceStatus(r.due_at, r.completed_at) === "overdue");
  const visibleRows = filter === "dueSoon" ? dueSoon : filter === "overdue" ? overdueRows : rows;

  const save = async () => {
    if (!form.equipment_id || !form.due_at) return;
    setSaving(true);
    const { error } = await supabase.from("equipment_maintenance").insert({
      group_id: groupId,
      equipment_id: form.equipment_id,
      maintenance_type: form.maintenance_type,
      due_at: form.due_at,
      note: form.note.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: t("school.maintenance.saveFailed"), description: error.message, variant: "destructive" });
      return;
    }
    setFormOpen(false);
    setForm({ equipment_id: "", maintenance_type: "reserve_repack", due_at: "", note: "" });
    toast({ title: t("school.maintenance.saved") });
    load();
  };

  const complete = async (row: Row) => {
    if (!user || completing) return;
    setCompleting(row.id);
    const today = format(new Date(), "yyyy-MM-dd");
    const { error } = await supabase
      .from("equipment_maintenance")
      .update({ completed_at: today, completed_by: user?.id ?? null })
      .eq("id", row.id)
      .eq("group_id", groupId)
      .select("id").single();
    setCompleting(null);
    if (error) {
      toast({ title: t("school.maintenance.saveFailed"), description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, completed_at: today } : r)));
  };

  if (loading) return <Skeleton className="h-40 w-full rounded-2xl" />;
  if (loadError) return <div role="alert" className="space-y-2 pt-3"><p>{t("school.maintenance.loadFailed")}</p><Button onClick={() => void load()}>{t("school.maintenance.retry")}</Button></div>;

  return (
    <div className="space-y-3 pt-3">
      <Button className="w-full" onClick={() => setFormOpen(true)} disabled={equipment.length === 0}>
        <Plus className="h-4 w-4 mr-2" />
        {t("school.maintenance.add")}
      </Button>

      {dueSoon.length > 0 && (
        <p className="text-xs text-amber-500 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          {t("school.maintenance.dueSoonCount", { count: dueSoon.length })}
        </p>
      )}

      <Select value={filter} onValueChange={setFilter}>
        <SelectTrigger aria-label={t("school.maintenance.filter")}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("school.maintenance.all")}</SelectItem>
          <SelectItem value="dueSoon">{t("school.maintenance.dueSoon")}</SelectItem>
          <SelectItem value="overdue">{t("school.maintenance.overdue")} ({overdueRows.length})</SelectItem>
        </SelectContent>
      </Select>
      {visibleRows.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title={t(filter === "all" ? "school.maintenance.empty" : "school.maintenance.noMatches")}
          description={filter === "all" ? t("school.maintenance.emptyHint") : undefined}
          actionLabel={filter === "all" && equipment.length > 0 ? t("school.maintenance.add") : undefined}
          onAction={filter === "all" && equipment.length > 0 ? () => setFormOpen(true) : undefined}
        />
      ) : (
        visibleRows.map((r) => {
          const overdue = maintenanceStatus(r.due_at, r.completed_at) === "overdue";
          return (
            <Card key={r.id} className="border-border/60 bg-card/80">
              <CardContent className="p-3 flex items-center gap-2">
                <Wrench className={`h-4 w-4 shrink-0 ${overdue ? "text-destructive" : "text-primary"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{equipmentName(r.equipment_id)}</p>
                  {overdue && <p className="text-xs text-destructive">{t("school.maintenance.overdue")}</p>}
                  <p className="text-xs text-muted-foreground truncate">
                    {t(`school.maintenance.types.${r.maintenance_type}`, { defaultValue: r.maintenance_type })} · {r.due_at}
                  </p>
                </div>
                {r.completed_at ? (
                  <Badge variant="outline" className="text-[10px]">
                    {t("school.maintenance.done")} {r.completed_at}
                  </Badge>
                ) : (
                  <Button size="sm" variant="secondary" disabled={!!completing} onClick={() => complete(r)}>
                    <Check className="h-3.5 w-3.5 mr-1" />
                    {t("school.maintenance.markDone")}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("school.maintenance.add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("school.maintenance.equipment")}</Label>
              <Select value={form.equipment_id} onValueChange={(v) => setForm({ ...form, equipment_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t("school.maintenance.equipment")} />
                </SelectTrigger>
                <SelectContent>
                  {equipment.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("school.maintenance.type")}</Label>
              <Select value={form.maintenance_type} onValueChange={(v) => setForm({ ...form, maintenance_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MAINTENANCE_TYPES.map((ty) => (
                    <SelectItem key={ty} value={ty}>
                      {t(`school.maintenance.types.${ty}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("school.maintenance.dueAt")}</Label>
              <Input type="date" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} />
            </div>
            <div>
              <Label>{t("school.maintenance.note")}</Label>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={saving || !form.equipment_id || !form.due_at}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
