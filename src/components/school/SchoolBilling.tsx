import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Check, Download, Receipt } from "lucide-react";

interface Props {
  groupId: string;
}

interface Item {
  id: string;
  user_id: string;
  event_id: string | null;
  item_type: string;
  description: string | null;
  quantity: number;
  unit_amount: number;
  amount: number;
  billing_date: string;
  paid_at: string | null;
  note: string | null;
}

const ITEM_TYPES = ["travel", "rental", "purchase", "course_fee", "other"] as const;

export default function SchoolBilling({ groupId }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [people, setPeople] = useState<{ user_id: string; name: string }[]>([]);
  const [events, setEvents] = useState<{ id: string; title: string; event_date: string }[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    user_id: "",
    item_type: "travel" as (typeof ITEM_TYPES)[number],
    description: "",
    quantity: "1",
    unit_amount: "",
    billing_date: new Date().toISOString().slice(0, 10),
    event_id: "none",
    note: "",
  });

  const load = async () => {
    if (!groupId) return;
    setLoading(true);
    const [itemsRes, membersRes, eventsRes, ratesRes] = await Promise.all([
      supabase.from("billing_items" as any).select("id, user_id, event_id, item_type, description, quantity, unit_amount, amount, billing_date, paid_at, note").eq("group_id", groupId).order("billing_date", { ascending: false }),
      supabase.from("group_members").select("user_id").eq("group_id", groupId),
      supabase.from("flight_events").select("id, title, event_date").eq("group_id", groupId).order("event_date", { ascending: false }).limit(50),
      supabase.from("school_rates").select("rate_key, amount").eq("group_id", groupId),
    ]);

    const memberIds = (membersRes.data || []).map((m: any) => m.user_id);
    let names: { user_id: string; name: string }[] = [];
    if (memberIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("user_id, pilot_name").in("user_id", memberIds);
      names = (profs || []).map((p: any) => ({ user_id: p.user_id, name: p.pilot_name || "—" })).sort((a, b) => a.name.localeCompare(b.name));
    }

    const rateMap: Record<string, number> = {};
    (ratesRes.data || []).forEach((r: any) => { rateMap[r.rate_key] = Number(r.amount) || 0; });

    setItems(((itemsRes.data as any[]) || []) as Item[]);
    setPeople(names);
    setEvents((eventsRes.data || []) as any[]);
    setRates(rateMap);
    setLoading(false);
  };

  useEffect(() => { load(); }, [groupId]);

  const nameOf = (id: string) => people.find((p) => p.user_id === id)?.name || "—";
  const openItems = useMemo(() => items.filter((i) => !i.paid_at), [items]);
  const paidItems = useMemo(() => items.filter((i) => i.paid_at), [items]);
  const openTotal = useMemo(() => openItems.reduce((s, i) => s + (Number(i.amount) || 0), 0), [openItems]);

  const perPerson = useMemo(() => {
    const map: Record<string, number> = {};
    openItems.forEach((i) => { map[i.user_id] = (map[i.user_id] || 0) + (Number(i.amount) || 0); });
    return Object.entries(map).map(([user_id, total]) => ({ user_id, total })).sort((a, b) => b.total - a.total);
  }, [openItems]);

  const defaultRate = (type: string) => {
    if (type === "travel") return rates["travel_per_km"] || 0;
    if (type === "rental") return rates["rental_per_day"] || 0;
    return 0;
  };

  const openDialog = (userId?: string) => {
    setForm({
      user_id: userId || "",
      item_type: "travel",
      description: "",
      quantity: "1",
      unit_amount: defaultRate("travel") ? String(defaultRate("travel")) : "",
      billing_date: new Date().toISOString().slice(0, 10),
      event_id: "none",
      note: "",
    });
    setOpen(true);
  };

  const amountPreview = (Number(form.quantity) || 0) * (Number(form.unit_amount) || 0);

  const save = async () => {
    if (!user || !form.user_id) return;
    setSaving(true);
    const { error } = await supabase.from("billing_items" as any).insert({
      group_id: groupId,
      user_id: form.user_id,
      event_id: form.event_id === "none" ? null : form.event_id,
      item_type: form.item_type,
      description: form.description || null,
      quantity: Number(form.quantity) || 0,
      unit_amount: Number(form.unit_amount) || 0,
      amount: Math.round(amountPreview * 100) / 100,
      billing_date: form.billing_date,
      note: form.note || null,
      created_by: user.id,
    });
    setSaving(false);
    if (error) {
      toast({ title: t("school.billing.saveFailed"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("school.billing.saved") });
    setOpen(false);
    load();
  };

  const markPaid = async (id: string) => {
    const { error } = await supabase.from("billing_items" as any).update({ paid_at: new Date().toISOString().slice(0, 10) }).eq("id", id);
    if (error) {
      toast({ title: t("school.billing.saveFailed"), description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  const remove = async (id: string) => {
    if (!confirm(t("school.billing.deleteConfirm"))) return;
    const { error } = await supabase.from("billing_items" as any).delete().eq("id", id);
    if (error) {
      toast({ title: t("school.billing.saveFailed"), description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  const exportCsv = () => {
    const header = ["Datum", "Person", "Art", "Beschreibung", "Menge", "Ansatz", "Betrag", "Bezahlt am", "Notiz"];
    const lines = items.map((i) => [
      i.billing_date,
      nameOf(i.user_id),
      t(`school.billing.types.${i.item_type}`),
      i.description || "",
      String(i.quantity),
      String(i.unit_amount),
      String(i.amount),
      i.paid_at || "",
      i.note || "",
    ]);
    const csv = [header, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `abrechnung-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ItemCard = ({ i }: { i: Item }) => (
    <Card className="border-border/60 bg-card/80 shadow-sm">
      <CardContent className="p-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{nameOf(i.user_id)}</p>
            <Badge variant="secondary" className="text-[10px]">{t(`school.billing.types.${i.item_type}`)}</Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {new Date(i.billing_date).toLocaleDateString("de-CH")}
            {i.description ? ` · ${i.description}` : ""}
            {i.paid_at ? ` · ${t("school.billing.paidOn", { date: new Date(i.paid_at).toLocaleDateString("de-CH") })}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold tabular-nums">{Number(i.amount).toFixed(2)}</span>
          {!i.paid_at && (
            <Button size="icon" variant="ghost" onClick={() => markPaid(i.id)} title={t("school.billing.markPaid")}>
              <Check className="h-4 w-4 text-primary" />
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={() => remove(i.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="space-y-3 pt-3">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-3">
      <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur-sm">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("school.billing.openTotal")}</p>
            <p className="text-2xl font-bold tabular-nums">{openTotal.toFixed(2)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{t("school.billing.openCount", { count: openItems.length })}</p>
          </div>
          <Receipt className="h-6 w-6 text-primary" />
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => openDialog()}>
          <Plus className="h-4 w-4 mr-1" />
          {t("school.billing.add")}
        </Button>
        <Button variant="outline" onClick={exportCsv} disabled={items.length === 0}>
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {perPerson.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{t("school.billing.perPerson")}</h2>
          <div className="space-y-2">
            {perPerson.map((p) => (
              <Card key={p.user_id} className="border-border/60 bg-card/80 shadow-sm">
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{nameOf(p.user_id)}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">{p.total.toFixed(2)}</span>
                    <Button size="sm" variant="outline" onClick={() => openDialog(p.user_id)}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Tabs defaultValue="open">
        <TabsList className="w-full">
          <TabsTrigger value="open" className="flex-1 text-xs">{t("school.billing.tabOpen")}</TabsTrigger>
          <TabsTrigger value="paid" className="flex-1 text-xs">{t("school.billing.tabPaid")}</TabsTrigger>
        </TabsList>
        <TabsContent value="open" className="space-y-2 pt-3">
          {openItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t("school.billing.empty")}</p>
          ) : openItems.map((i) => <ItemCard key={i.id} i={i} />)}
        </TabsContent>
        <TabsContent value="paid" className="space-y-2 pt-3">
          {paidItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t("school.billing.empty")}</p>
          ) : paidItems.map((i) => <ItemCard key={i.id} i={i} />)}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("school.billing.add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t("school.billing.person")}</Label>
              <Select value={form.user_id} onValueChange={(v) => setForm((f) => ({ ...f, user_id: v }))}>
                <SelectTrigger><SelectValue placeholder={t("school.billing.person")} /></SelectTrigger>
                <SelectContent>
                  {people.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t("school.billing.itemType")}</Label>
              <Select
                value={form.item_type}
                onValueChange={(v) => setForm((f) => ({ ...f, item_type: v as any, unit_amount: defaultRate(v) ? String(defaultRate(v)) : f.unit_amount }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map((tp) => <SelectItem key={tp} value={tp}>{t(`school.billing.types.${tp}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t("school.billing.description")}</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">{t("school.billing.quantity")}</Label>
                <Input type="number" step="0.5" min="0" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">{t("school.billing.unitAmount")}</Label>
                <Input type="number" step="0.05" value={form.unit_amount} onChange={(e) => setForm((f) => ({ ...f, unit_amount: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">{t("school.billing.amount")}</Label>
                <Input readOnly value={amountPreview.toFixed(2)} className="bg-muted/50" />
              </div>
            </div>
            <div>
              <Label className="text-xs">{t("school.billing.date")}</Label>
              <Input type="date" value={form.billing_date} onChange={(e) => setForm((f) => ({ ...f, billing_date: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">{t("school.billing.event")}</Label>
              <Select value={form.event_id} onValueChange={(v) => setForm((f) => ({ ...f, event_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("school.billing.noEvent")}</SelectItem>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {new Date(e.event_date).toLocaleDateString("de-CH")} · {e.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t("school.billing.note")}</Label>
              <Textarea rows={2} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={saving || !form.user_id}>{t("school.billing.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
