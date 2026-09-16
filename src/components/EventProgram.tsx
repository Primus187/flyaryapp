import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarDays, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProgramItem {
  id: string;
  item_date: string;
  item_time: string | null;
  title: string;
  location: string | null;
  sort_order: number;
}

interface Props {
  eventId: string;
  eventDate: string;
  endDate: string | null;
  canManage: boolean;
}

export default function EventProgram({ eventId, eventDate, endDate, canManage }: Props) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";
  const [items, setItems] = useState<ProgramItem[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ date: eventDate.slice(0, 10), time: "", title: "", location: "" });

  const load = async () => {
    const { data } = await supabase
      .from("event_program_items" as any)
      .select("*")
      .eq("event_id", eventId)
      .order("item_date")
      .order("item_time", { nullsFirst: true })
      .order("sort_order");
    setItems((data as any[]) || []);
  };

  useEffect(() => { load(); }, [eventId]);

  const addItem = async () => {
    if (!form.title.trim() || !form.date) return;
    const { error } = await supabase.from("event_program_items" as any).insert({
      event_id: eventId,
      item_date: form.date,
      item_time: form.time || null,
      title: form.title.trim(),
      location: form.location.trim() || null,
      sort_order: items.length,
    } as any);
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    } else {
      setForm({ date: eventDate.slice(0, 10), time: "", title: "", location: "" });
      setShowAdd(false);
      await load();
    }
  };

  const removeItem = async (id: string) => {
    await supabase.from("event_program_items" as any).delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const byDate = useMemo(() => {
    const map: Record<string, ProgramItem[]> = {};
    items.forEach((i) => {
      if (!map[i.item_date]) map[i.item_date] = [];
      map[i.item_date].push(i);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  if (items.length === 0 && !canManage) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" /> {t("events.program.title")}
        </h2>
        {canManage && (
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-3.5 w-3.5" /> {t("events.program.add")}
          </Button>
        )}
      </div>

      {items.length === 0 && !showAdd && (
        <p className="text-sm text-muted-foreground">{t("events.program.empty")}</p>
      )}

      {byDate.map(([date, dayItems]) => (
        <div key={date}>
          {byDate.length > 1 && (
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 mt-2">
              {new Date(date + "T00:00:00").toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
            </p>
          )}
          <div className="space-y-1">
            {dayItems.map((item) => (
              <Card key={item.id} className="border-0 shadow-sm">
                <CardContent className="p-2.5 flex items-center gap-2.5">
                  <span className="text-xs font-mono text-primary w-11 shrink-0">
                    {item.item_time ? item.item_time.slice(0, 5) : "–"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    {item.location && <p className="text-[10px] text-muted-foreground truncate">{item.location}</p>}
                  </div>
                  {canManage && (
                    <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {canManage && showAdd && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date" value={form.date}
                min={eventDate.slice(0, 10)}
                max={endDate || undefined}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="h-8 text-xs"
              />
              <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="h-8 text-xs" />
            </div>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={t("events.program.titlePlaceholder")}
              className="h-8 text-xs"
            />
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder={t("events.program.locationPlaceholder")}
              className="h-8 text-xs"
            />
            <Button size="sm" className="w-full h-8" onClick={addItem} disabled={!form.title.trim()}>
              {t("events.program.add")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
