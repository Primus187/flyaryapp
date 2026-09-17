import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/layout/EmptyState";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Wallet } from "lucide-react";

interface Props {
  groupId: string;
}

interface CreditRow {
  id: string;
  user_id: string;
  event_id: string | null;
  entry_type: string;
  booking_date: string;
  days: number;
  amount: number;
  note: string | null;
}

const ENTRY_TYPES = ["earned", "payout", "adjustment"] as const;

export default function SchoolCredits({ groupId }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CreditRow[]>([]);
  const [people, setPeople] = useState<{ user_id: string; name: string }[]>([]);
  const [events, setEvents] = useState<{ id: string; title: string; event_date: string }[]>([]);
  const [ratePerDay, setRatePerDay] = useState(0);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    user_id: "",
    entry_type: "earned" as (typeof ENTRY_TYPES)[number],
    booking_date: new Date().toISOString().slice(0, 10),
    days: "1",
    amount: "",
    event_id: "none",
    note: "",
  });

  const load = async () => {
    if (!groupId) return;
    setLoading(true);
    const [creditsRes, membersRes, eventsRes, ratesRes] = await Promise.all([
      supabase.from("launch_leader_credits" as any).select("id, user_id, event_id, entry_type, booking_date, days, amount, note").eq("group_id", groupId).order("booking_date", { ascending: false }),
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

    setRows(((creditsRes.data as any[]) || []) as CreditRow[]);
    setPeople(names);
    setEvents((eventsRes.data || []) as any[]);
    setRatePerDay(Number((ratesRes.data || []).find((r: any) => r.rate_key === "launch_leader_per_day")?.amount || 0));
    setLoading(false);
  };

  useEffect(() => { load(); }, [groupId]);

  const nameOf = (id: string) => people.find((p) => p.user_id === id)?.name || "—";

  const balances = useMemo(() => {
    const map: Record<string, { days: number; balance: number }> = {};
    rows.forEach((r) => {
      if (!map[r.user_id]) map[r.user_id] = { days: 0, balance: 0 };
      const sign = r.entry_type === "payout" ? -1 : 1;
      if (r.entry_type === "earned") map[r.user_id].days += Number(r.days) || 0;
      map[r.user_id].balance += sign * (Number(r.amount) || 0);
    });
    return Object.entries(map)
      .map(([user_id, v]) => ({ user_id, ...v }))
      .sort((a, b) => b.balance - a.balance);
  }, [rows]);

  const totalOpen = useMemo(() => balances.reduce((s, b) => s + b.balance, 0), [balances]);

  const openDialog = (userId?: string) => {
    setForm({
      user_id: userId || "",
      entry_type: "earned",
      booking_date: new Date().toISOString().slice(0, 10),
      days: "1",
      amount: ratePerDay ? String(ratePerDay) : "",
      event_id: "none",
      note: "",
    });
    setOpen(true);
  };

  const onDaysChange = (value: string) => {
    const days = Number(value) || 0;
    setForm((f) => ({ ...f, days: value, amount: f.entry_type === "earned" && ratePerDay ? String(Math.round(days * ratePerDay * 100) / 100) : f.amount }));
  };

  const save = async () => {
    if (!user || !form.user_id) return;
    setSaving(true);
    const { error } = await supabase.from("launch_leader_credits" as any).insert({
      group_id: groupId,
      user_id: form.user_id,
      event_id: form.event_id === "none" ? null : form.event_id,
      entry_type: form.entry_type,
      booking_date: form.booking_date,
      days: form.entry_type === "earned" ? Number(form.days) || 0 : 0,
      amount: Number(form.amount) || 0,
      note: form.note || null,
      created_by: user.id,
    });
    setSaving(false);
    if (error) {
      toast({ title: t("school.credits.saveFailed"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("school.credits.saved") });
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm(t("school.credits.deleteConfirm"))) return;
    const { error } = await supabase.from("launch_leader_credits" as any).delete().eq("id", id);
    if (error) {
      toast({ title: t("school.credits.saveFailed"), description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

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
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("school.credits.totalOpen")}</p>
            <p className="text-2xl font-bold tabular-nums">{totalOpen.toFixed(2)}</p>
            {ratePerDay > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">{t("school.credits.ratePerDay", { amount: ratePerDay })}</p>
            )}
          </div>
          <Wallet className="h-6 w-6 text-primary" />
        </CardContent>
      </Card>

      <Button className="w-full" onClick={() => openDialog()}>
        <Plus className="h-4 w-4 mr-1" />
        {t("school.credits.add")}
      </Button>

      <div>
        <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{t("school.credits.balances")}</h2>
        {balances.length === 0 ? (
          <EmptyState icon={Wallet} title={t("school.credits.empty")} description={t("school.credits.emptyHint")} actionLabel={t("school.credits.add")} onAction={() => openDialog()} />
        ) : (
          <div className="space-y-2">
            {balances.map((b) => (
              <Card key={b.user_id} className="border-border/60 bg-card/80 shadow-sm">
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{nameOf(b.user_id)}</p>
                    <p className="text-xs text-muted-foreground">{t("school.credits.daysCount", { count: b.days })}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">{b.balance.toFixed(2)}</span>
                    <Button size="sm" variant="outline" onClick={() => openDialog(b.user_id)}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{t("school.credits.bookings")}</h2>
        <div className="space-y-2">
          {rows.slice(0, 30).map((r) => (
            <Card key={r.id} className="border-border/60 bg-card/80 shadow-sm">
              <CardContent className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{nameOf(r.user_id)}</p>
                    <Badge variant="secondary" className="text-[10px]">{t(`school.credits.types.${r.entry_type}`)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.booking_date).toLocaleDateString("de-CH")}
                    {r.note ? ` · ${r.note}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm tabular-nums">{r.entry_type === "payout" ? "−" : ""}{Number(r.amount).toFixed(2)}</span>
                  <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("school.credits.add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t("school.credits.person")}</Label>
              <Select value={form.user_id} onValueChange={(v) => setForm((f) => ({ ...f, user_id: v }))}>
                <SelectTrigger><SelectValue placeholder={t("school.credits.person")} /></SelectTrigger>
                <SelectContent>
                  {people.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t("school.credits.entryType")}</Label>
              <Select value={form.entry_type} onValueChange={(v) => setForm((f) => ({ ...f, entry_type: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENTRY_TYPES.map((tp) => <SelectItem key={tp} value={tp}>{t(`school.credits.types.${tp}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">{t("school.credits.date")}</Label>
                <Input type="date" value={form.booking_date} onChange={(e) => setForm((f) => ({ ...f, booking_date: e.target.value }))} />
              </div>
              {form.entry_type === "earned" && (
                <div>
                  <Label className="text-xs">{t("school.credits.days")}</Label>
                  <Input type="number" step="0.5" min="0" value={form.days} onChange={(e) => onDaysChange(e.target.value)} />
                </div>
              )}
              <div>
                <Label className="text-xs">{t("school.credits.amount")}</Label>
                <Input type="number" step="0.05" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">{t("school.credits.event")}</Label>
              <Select value={form.event_id} onValueChange={(v) => setForm((f) => ({ ...f, event_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("school.credits.noEvent")}</SelectItem>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {new Date(e.event_date).toLocaleDateString("de-CH")} · {e.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t("school.credits.note")}</Label>
              <Textarea rows={2} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={saving || !form.user_id}>{t("school.credits.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
