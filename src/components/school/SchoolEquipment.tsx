import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/layout/EmptyState";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Plus, ArchiveX, Pencil, Search, Undo2, HandHelping } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const EQUIPMENT_TYPES = ["glider", "harness", "reserve", "helmet", "radio", "vario", "other"] as const;
const STATUSES = ["in_stock", "assigned", "maintenance", "retired"] as const;
const RATE_KEYS = ["travel_per_km", "rental_per_day", "rental_per_week", "launch_leader_per_day"] as const;

// Vorschlagswerte für den Start (können jederzeit angepasst werden)
const SUGGESTED_RATES = [
  { key: "travel_per_km", amount: 0.7, unit: "CHF" },
  { key: "rental_per_day", amount: 30, unit: "CHF" },
  { key: "rental_per_week", amount: 120, unit: "CHF" },
  { key: "launch_leader_per_day", amount: 50, unit: "CHF" },
];

interface Equipment {
  id: string;
  name: string;
  equipment_type: string;
  inventory_number: string | null;
  size: string | null;
  condition: string | null;
  status: string;
  purchase_date: string | null;
  retired_at: string | null;
  next_check_date: string | null;
  notes: string | null;
  shv_type_approved?: boolean;
}

interface Assignment {
  id: string;
  equipment_id: string;
  user_id: string;
  assigned_on: string;
  due_on: string | null;
  returned_on: string | null;
  note: string | null;
}

interface Member {
  userId: string;
  name: string;
}

interface Rate {
  id: string;
  rate_key: string;
  label: string;
  amount: number;
  unit: string;
  valid_from: string;
}

interface Props {
  groupId: string;
}

const emptyForm = {
  name: "",
  equipment_type: "glider",
  inventory_number: "",
  size: "",
  condition: "",
  purchase_date: "",
  next_check_date: "",
  notes: "",
  shv_type_approved: false,
};

export default function SchoolEquipment({ groupId }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [quantity, setQuantity] = useState("1");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");

  const [editing, setEditing] = useState<Equipment | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [assignTarget, setAssignTarget] = useState<Equipment | null>(null);
  const [assignUser, setAssignUser] = useState("");
  const [assignFrom, setAssignFrom] = useState(new Date().toISOString().slice(0, 10));
  const [assignDue, setAssignDue] = useState("");
  const [assignNote, setAssignNote] = useState("");

  const load = async () => {
    setLoading(true);
    const [eqRes, asRes, memRes, rateRes] = await Promise.all([
      supabase.from("school_equipment" as any).select("*").eq("group_id", groupId).order("name"),
      supabase.from("equipment_assignments" as any).select("*").eq("group_id", groupId).order("assigned_on", { ascending: false }),
      supabase.from("group_members").select("user_id").eq("group_id", groupId),
      supabase.from("school_rates" as any).select("*").eq("group_id", groupId).order("valid_from", { ascending: false }),
    ]);
    setEquipment(((eqRes.data as any[]) || []) as Equipment[]);
    setAssignments(((asRes.data as any[]) || []) as Assignment[]);
    setRates(((rateRes.data as any[]) || []) as Rate[]);

    const ids = (memRes.data || []).map((m) => m.user_id);
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("user_id, pilot_name").in("user_id", ids);
      setMembers(
        (profs || [])
          .map((p: any) => ({ userId: p.user_id, name: p.pilot_name || "—" }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } else {
      setMembers([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (groupId) load();
  }, [groupId]);

  const memberName = (userId: string) => members.find((m) => m.userId === userId)?.name || "—";

  const openAssignments = useMemo(() => assignments.filter((a) => !a.returned_on), [assignments]);

  const filteredEquipment = useMemo(() => {
    const q = search.trim().toLowerCase();
    return equipment.filter((e) => {
      if (statusFilter === "active" && e.status === "retired") return false;
      if (statusFilter !== "active" && statusFilter !== "all" && e.status !== statusFilter) return false;
      if (q && !`${e.name} ${e.inventory_number || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [equipment, search, statusFilter]);

  const counts = useMemo(() => {
    return {
      total: equipment.filter((e) => e.status !== "retired").length,
      in_stock: equipment.filter((e) => e.status === "in_stock").length,
      assigned: equipment.filter((e) => e.status === "assigned").length,
      retired: equipment.filter((e) => e.status === "retired").length,
    };
  }, [equipment]);

  const openForm = (item?: Equipment) => {
    if (item) {
      setEditing(item);
      setForm({
        name: item.name,
        equipment_type: item.equipment_type,
        inventory_number: item.inventory_number || "",
        size: item.size || "",
        condition: item.condition || "",
        purchase_date: item.purchase_date || "",
        next_check_date: item.next_check_date || "",
        notes: item.notes || "",
        shv_type_approved: !!item.shv_type_approved,
      });
    } else {
      setEditing(null);
      setForm({ ...emptyForm });
    }
    setQuantity("1");
    setFormOpen(true);
  };

  const saveEquipment = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload: any = {
      group_id: groupId,
      name: form.name.trim(),
      equipment_type: form.equipment_type,
      inventory_number: form.inventory_number.trim() || null,
      size: form.size.trim() || null,
      condition: form.condition.trim() || null,
      purchase_date: form.purchase_date || null,
      next_check_date: form.next_check_date || null,
      notes: form.notes.trim() || null,
      shv_type_approved: form.shv_type_approved,
    };
    const count = Math.max(1, Math.min(50, parseInt(quantity, 10) || 1));
    const rows =
      count > 1
        ? Array.from({ length: count }, (_, i) => ({
            ...payload,
            name: `${payload.name} ${i + 1}`,
            inventory_number: payload.inventory_number ? `${payload.inventory_number}-${i + 1}` : null,
          }))
        : [payload];
    const { error } = editing
      ? await supabase.from("school_equipment" as any).update(payload).eq("id", editing.id)
      : await supabase.from("school_equipment" as any).insert(rows as any);
    setSaving(false);
    if (error) {
      toast({ title: t("school.equipment.saveFailed"), description: error.message, variant: "destructive" });
      return;
    }
    setFormOpen(false);
    toast({ title: t("school.equipment.saved") });
    load();
  };

  const retire = async (item: Equipment) => {
    if (!confirm(t("school.equipment.retireConfirm"))) return;
    const { error } = await supabase
      .from("school_equipment" as any)
      .update({ status: "retired", retired_at: new Date().toISOString().slice(0, 10) })
      .eq("id", item.id);
    if (error) {
      toast({ title: t("school.equipment.saveFailed"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("school.equipment.retired") });
    load();
  };

  const reactivate = async (item: Equipment) => {
    const { error } = await supabase
      .from("school_equipment" as any)
      .update({ status: "in_stock", retired_at: null })
      .eq("id", item.id);
    if (error) {
      toast({ title: t("school.equipment.saveFailed"), description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  const openAssign = (item: Equipment) => {
    setAssignTarget(item);
    setAssignUser("");
    setAssignFrom(new Date().toISOString().slice(0, 10));
    setAssignDue("");
    setAssignNote("");
  };

  const saveAssignment = async () => {
    if (!assignTarget || !assignUser) return;
    setSaving(true);
    const { error } = await supabase.from("equipment_assignments" as any).insert({
      equipment_id: assignTarget.id,
      group_id: groupId,
      user_id: assignUser,
      assigned_on: assignFrom,
      due_on: assignDue || null,
      note: assignNote.trim() || null,
    } as any);
    if (!error) {
      await supabase.from("school_equipment" as any).update({ status: "assigned" }).eq("id", assignTarget.id);
    }
    setSaving(false);
    if (error) {
      toast({ title: t("school.equipment.saveFailed"), description: error.message, variant: "destructive" });
      return;
    }
    setAssignTarget(null);
    toast({ title: t("school.equipment.assigned") });
    load();
  };

  const returnAssignment = async (a: Assignment) => {
    const { error } = await supabase
      .from("equipment_assignments" as any)
      .update({ returned_on: new Date().toISOString().slice(0, 10) })
      .eq("id", a.id);
    if (!error) {
      await supabase.from("school_equipment" as any).update({ status: "in_stock" }).eq("id", a.equipment_id);
    }
    if (error) {
      toast({ title: t("school.equipment.saveFailed"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("school.equipment.returned") });
    load();
  };

  const applySuggestedRates = async () => {
    setSaving(true);
    const { error } = await supabase.from("school_rates" as any).insert(
      SUGGESTED_RATES.map((r) => ({
        group_id: groupId,
        rate_key: r.key,
        label: t(`school.equipment.rates.${r.key}`),
        amount: r.amount,
        unit: r.unit,
      })) as any
    );
    setSaving(false);
    if (error) {
      toast({ title: t("school.equipment.saveFailed"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("school.equipment.saved") });
    load();
  };

  const saveRate = async (key: string, amount: string, unit: string) => {
    const value = parseFloat(amount.replace(",", "."));
    if (Number.isNaN(value)) return;
    const existing = rates.find((r) => r.rate_key === key);
    const payload: any = {
      group_id: groupId,
      rate_key: key,
      label: t(`school.equipment.rates.${key}`),
      amount: value,
      unit,
    };
    const { error } = existing
      ? await supabase.from("school_rates" as any).update({ amount: value, unit }).eq("id", existing.id)
      : await supabase.from("school_rates" as any).insert(payload);
    if (error) {
      toast({ title: t("school.equipment.saveFailed"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("school.equipment.saved") });
    load();
  };

  if (loading) {
    return (
      <div className="space-y-3 pt-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      <Tabs defaultValue="stock">
        <TabsList className="w-full">
          <TabsTrigger value="stock" className="flex-1 text-xs">{t("school.equipment.stock")}</TabsTrigger>
          <TabsTrigger value="loans" className="flex-1 text-xs">{t("school.equipment.loans")}</TabsTrigger>
          <TabsTrigger value="rates" className="flex-1 text-xs">{t("school.equipment.ratesTitle")}</TabsTrigger>
        </TabsList>

        {/* Lager */}
        <TabsContent value="stock" className="space-y-3 pt-3">
          <div className="grid grid-cols-3 gap-2">
            {(["in_stock", "assigned", "retired"] as const).map((k) => (
              <Card key={k} className="border-border/60 bg-card/80">
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold">{counts[k]}</p>
                  <p className="text-[11px] text-muted-foreground">{t(`school.equipment.status.${k}`)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("school.equipment.searchPlaceholder")} className="pl-8" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t("school.equipment.filterActive")}</SelectItem>
                <SelectItem value="all">{t("school.equipment.filterAll")}</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{t(`school.equipment.status.${s}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => openForm()} className="w-full">
            <Plus className="h-4 w-4 mr-2" />{t("school.equipment.add")}
          </Button>

          {filteredEquipment.length === 0 ? (
            <EmptyState icon={Package} title={t("school.equipment.empty")} description={t("school.equipment.emptyHint")} actionLabel={t("school.equipment.add")} onAction={() => openForm()} />
          ) : (
            <div className="space-y-2">
              {filteredEquipment.map((item) => {
                const open = openAssignments.find((a) => a.equipment_id === item.id);
                return (
                  <Card key={item.id} className="border-border/60 bg-card/80">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <Package className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {t(`school.equipment.types.${item.equipment_type}`, { defaultValue: item.equipment_type })}
                            {item.size ? ` · ${item.size}` : ""}
                            {item.inventory_number ? ` · #${item.inventory_number}` : ""}
                          </p>
                          {open && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {t("school.equipment.lentTo", { name: memberName(open.user_id) })}
                              {open.due_on ? ` · ${t("school.equipment.due")} ${open.due_on}` : ""}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant={item.status === "retired" ? "outline" : item.status === "assigned" ? "secondary" : "default"} className="text-[10px]">
                            {t(`school.equipment.status.${item.status}`)}
                          </Badge>
                          {item.shv_type_approved && (
                            <Badge variant="outline" className="text-[10px]">{t("school.equipment.shvApprovedShort")}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {item.status !== "retired" && !open && (
                          <Button size="sm" variant="secondary" onClick={() => openAssign(item)}>
                            <HandHelping className="h-3.5 w-3.5 mr-1" />{t("school.equipment.lend")}
                          </Button>
                        )}
                        {open && (
                          <Button size="sm" variant="secondary" onClick={() => returnAssignment(open)}>
                            <Undo2 className="h-3.5 w-3.5 mr-1" />{t("school.equipment.takeBack")}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openForm(item)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />{t("school.equipment.edit")}
                        </Button>
                        {item.status === "retired" ? (
                          <Button size="sm" variant="ghost" onClick={() => reactivate(item)}>{t("school.equipment.reactivate")}</Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => retire(item)}>
                            <ArchiveX className="h-3.5 w-3.5 mr-1" />{t("school.equipment.retire")}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Ausgaben */}
        <TabsContent value="loans" className="space-y-3 pt-3">
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t("school.equipment.noLoans")}</p>
          ) : (
            assignments.map((a) => {
              const item = equipment.find((e) => e.id === a.equipment_id);
              return (
                <Card key={a.id} className="border-border/60 bg-card/80">
                  <CardContent className="p-3 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{memberName(a.user_id)}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item?.name || "—"} · {a.assigned_on}
                        {a.due_on ? ` → ${a.due_on}` : ""}
                      </p>
                      {a.note && <p className="text-xs text-muted-foreground truncate">{a.note}</p>}
                    </div>
                    {a.returned_on ? (
                      <Badge variant="outline" className="text-[10px]">{t("school.equipment.returnedOn")} {a.returned_on}</Badge>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => returnAssignment(a)}>
                        <Undo2 className="h-3.5 w-3.5 mr-1" />{t("school.equipment.takeBack")}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* Ansätze */}
        <TabsContent value="rates" className="space-y-3 pt-3">
          <p className="text-xs text-muted-foreground">{t("school.equipment.ratesHint")}</p>
          {rates.length === 0 && (
            <Card className="border-border/60 bg-card/80 shadow-sm">
              <CardContent className="p-3 space-y-2">
                <p className="text-xs text-muted-foreground">{t("school.equipment.ratesSuggestHint")}</p>
                <Button size="sm" className="w-full" onClick={applySuggestedRates} disabled={saving}>
                  {t("school.equipment.ratesSuggestApply")}
                </Button>
              </CardContent>
            </Card>
          )}
          {RATE_KEYS.map((key) => {
            const existing = rates.find((r) => r.rate_key === key);
            return <RateRow key={key} rateKey={key} existing={existing} onSave={saveRate} />;
          })}
        </TabsContent>
      </Tabs>

      {/* Material Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t("school.equipment.edit") : t("school.equipment.add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("school.equipment.name")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("school.equipment.namePlaceholder")} />
            </div>
            {!editing && (
              <div>
                <Label>{t("school.equipment.quantity")}</Label>
                <Input type="number" min={1} max={50} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                <p className="text-[11px] text-muted-foreground mt-1">{t("school.equipment.quantityHint")}</p>
              </div>
            )}
            <div className="hidden">
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{t("school.equipment.type")}</Label>
                <Select value={form.equipment_type} onValueChange={(v) => setForm({ ...form, equipment_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EQUIPMENT_TYPES.map((ty) => (
                      <SelectItem key={ty} value={ty}>{t(`school.equipment.types.${ty}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("school.equipment.size")}</Label>
                <Input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{t("school.equipment.inventoryNumber")}</Label>
                <Input value={form.inventory_number} onChange={(e) => setForm({ ...form, inventory_number: e.target.value })} />
              </div>
              <div>
                <Label>{t("school.equipment.condition")}</Label>
                <Input value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{t("school.equipment.purchaseDate")}</Label>
                <Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
              </div>
              <div>
                <Label>{t("school.equipment.nextCheck")}</Label>
                <Input type="date" value={form.next_check_date} onChange={(e) => setForm({ ...form, next_check_date: e.target.value })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={form.shv_type_approved}
                onChange={(e) => setForm({ ...form, shv_type_approved: e.target.checked })}
              />
              {t("school.equipment.shvApproved")}
            </label>
            <div>
              <Label>{t("school.equipment.notes")}</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveEquipment} disabled={saving || !form.name.trim()}>{t("school.equipment.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ausgabe Dialog */}
      <Dialog open={!!assignTarget} onOpenChange={(o) => !o && setAssignTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("school.equipment.lendTitle", { name: assignTarget?.name || "" })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("school.equipment.person")}</Label>
              <Select value={assignUser} onValueChange={setAssignUser}>
                <SelectTrigger><SelectValue placeholder={t("school.equipment.choosePerson")} /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{t("school.equipment.from")}</Label>
                <Input type="date" value={assignFrom} onChange={(e) => setAssignFrom(e.target.value)} />
              </div>
              <div>
                <Label>{t("school.equipment.until")}</Label>
                <Input type="date" value={assignDue} onChange={(e) => setAssignDue(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>{t("school.equipment.notes")}</Label>
              <Input value={assignNote} onChange={(e) => setAssignNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveAssignment} disabled={saving || !assignUser}>{t("school.equipment.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RateRow({
  rateKey,
  existing,
  onSave,
}: {
  rateKey: string;
  existing?: Rate;
  onSave: (key: string, amount: string, unit: string) => void;
}) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [unit, setUnit] = useState(existing?.unit || "CHF");

  useEffect(() => {
    setAmount(existing ? String(existing.amount) : "");
    setUnit(existing?.unit || "CHF");
  }, [existing?.id, existing?.amount, existing?.unit]);

  const dirty = amount !== (existing ? String(existing.amount) : "") || unit !== (existing?.unit || "CHF");

  return (
    <Card className="border-border/60 bg-card/80">
      <CardContent className="p-3 space-y-2">
        <p className="text-sm font-medium">{t(`school.equipment.rates.${rateKey}`)}</p>
        <div className="flex gap-2">
          <Input type="number" step="0.05" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="flex-1" />
          <Input value={unit} onChange={(e) => setUnit(e.target.value)} className="w-20" />
          <Button size="sm" disabled={!dirty || amount === ""} onClick={() => onSave(rateKey, amount, unit)}>
            {t("school.equipment.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
