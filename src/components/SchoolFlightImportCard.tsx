import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { linksPayload, setLink, suggestLinks, type ImportDay, type ImportLinks } from "@/lib/school-flight-match";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration 0057 not in generated types.ts yet
const db = supabase as any;
const NEW = "__new__";

/** "The school recorded 3 flights on 25 Sep – take them over?" (Flugtag-Cockpit 6.1, decision E3).
 *  Shown on the home screen, in Flights and in the new-flight form until taken over or dismissed. */
export default function SchoolFlightImportCard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [days, setDays] = useState<ImportDay[]>([]);
  const [open, setOpen] = useState<{ day: ImportDay; links: ImportLinks } | null>(null);
  const [busy, setBusy] = useState(false);
  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await db.rpc("my_school_flight_imports");
    setDays(Array.isArray(data) ? (data as ImportDay[]) : []);
  }, [user]);
  useEffect(() => { void load(); }, [load]);

  const importDay = async (day: ImportDay, links: ImportLinks) => {
    setBusy(true);
    const { data, error } = await db.rpc("import_school_flights", { _event_id: day.eventId, _links: linksPayload(links) });
    setBusy(false);
    if (error) { toast({ title: t("schoolImport.failed"), variant: "destructive" }); return; }
    toast({ title: t("schoolImport.done", data as Record<string, number>) });
    setOpen(null);
    await load();
    void queryClient.invalidateQueries();
  };

  const dismiss = async (day: ImportDay) => {
    await db.rpc("dismiss_school_flight_import", { _event_id: day.eventId });
    await load();
  };

  const takeOver = (day: ImportDay) => {
    const links = suggestLinks(day);
    // Nothing of their own to link: take everything over in one tap.
    if (day.candidates.length === 0) void importDay(day, links);
    else setOpen({ day, links });
  };

  const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
  const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "");

  if (days.length === 0) return null;

  return (
    <>
      {days.map((day) => (
        <Card key={day.eventId} className="border-primary/40 shadow-sm">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-start gap-2">
              <GraduationCap className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{t("schoolImport.title", { count: day.flights.length, date: dateLabel(day.date) })}</p>
                <p className="text-xs text-muted-foreground truncate">{day.title}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" disabled={busy} onClick={() => takeOver(day)}>{t("schoolImport.takeOver")}</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void dismiss(day)}>{t("schoolImport.dismiss")}</Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!open} onOpenChange={(o) => { if (!o) setOpen(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{open && t("schoolImport.dialogTitle", { date: dateLabel(open.day.date) })}</DialogTitle>
            <DialogDescription>{t("schoolImport.dialogHint")}</DialogDescription>
          </DialogHeader>
          {open && (
            <div className="space-y-3">
              {open.day.flights.map((f) => (
                <div key={f.id} className="space-y-1">
                  <p className="text-sm font-medium">
                    {t("flightDay.board.flightN", { number: f.number })}
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      {[f.startedAt && f.landedAt ? `${time(f.startedAt)}–${time(f.landedAt)}` : time(f.landedAt), f.takeoff].filter(Boolean).join(" · ")}
                    </span>
                  </p>
                  <Select value={open.links[f.id] ?? NEW}
                    onValueChange={(v) => setOpen((o) => (o ? { ...o, links: setLink(o.links, f.id, v === NEW ? null : v) } : o))}>
                    <SelectTrigger aria-label={t("flightDay.board.flightN", { number: f.number })}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NEW}>{t("schoolImport.createNew")}</SelectItem>
                      {open.day.candidates.map((c, i) => (
                        <SelectItem key={c.id} value={c.id}>
                          {t("schoolImport.linkOwn", { number: i + 1 })}{c.takeoff ? ` · ${c.takeoff}` : ""}{c.durationMinutes ? ` · ${c.durationMinutes} min` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button disabled={busy || !open} onClick={() => open && void importDay(open.day, open.links)}>{t("schoolImport.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
