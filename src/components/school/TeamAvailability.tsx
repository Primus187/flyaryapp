import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/layout/EmptyState";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import {
  type AvailabilityStatus,
  nextAvailabilityStatus,
  parseIsoDateLocal,
  startOfWeek,
  weekDates,
} from "@/lib/instructor-availability";

const TEAM_FUNCTIONS = ["school_lead", "instructor", "launch_helper"] as const;

interface Props {
  groupId: string;
  canManage?: boolean;
}

interface Person {
  userId: string;
  name: string;
}

interface Entry {
  id: string;
  status: AvailabilityStatus;
  note: string | null;
}

const STATUS_STYLES: Record<AvailabilityStatus, string> = {
  available: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/40",
  unsure: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40",
  unavailable: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/40",
};

export default function TeamAvailability({ groupId, canManage = true }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [people, setPeople] = useState<Person[]>([]);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const dates = weekDates(weekStart);
  const weekStartIso = dates[0];
  const weekEndIso = dates[6];
  const key = (userId: string, date: string) => `${userId}_${date}`;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [funcRes, availRes] = await Promise.all([
        supabase.from("group_member_functions").select("user_id, function").eq("group_id", groupId),
        supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet
          .from("instructor_availability" as any)
          .select("id, user_id, date, status, note")
          .eq("group_id", groupId)
          .gte("date", weekStartIso)
          .lte("date", weekEndIso),
      ]);
      if (funcRes.error || availRes.error) throw funcRes.error || availRes.error;

      const userIds = Array.from(
        new Set((funcRes.data || []).filter((f) => (TEAM_FUNCTIONS as readonly string[]).includes(f.function)).map((f) => f.user_id)),
      );
      const nameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profs, error } = await supabase.from("profiles").select("user_id, pilot_name").in("user_id", userIds);
        if (error) throw error;
        (profs || []).forEach((p) => { nameMap[p.user_id] = p.pilot_name || "—"; });
      }

      setPeople(userIds.map((id) => ({ userId: id, name: nameMap[id] || "—" })).sort((a, b) => a.name.localeCompare(b.name)));
      const map: Record<string, Entry> = {};
      type AvailabilityRow = { id: string; user_id: string; date: string; status: AvailabilityStatus; note: string | null };
      ((availRes.data as unknown as AvailabilityRow[]) || []).forEach((row) => {
        map[key(row.user_id, row.date)] = { id: row.id, status: row.status, note: row.note };
      });
      setEntries(map);
      setNoteDraft({});
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [groupId, weekStartIso, weekEndIso]);

  useEffect(() => { if (groupId) void load(); }, [groupId, load]);

  const cycle = async (userId: string, date: string) => {
    if (!user || !(canManage || userId === user.id)) return;
    const existing = entries[key(userId, date)];
    const next = nextAvailabilityStatus(existing?.status ?? null);
    if (next === null) {
      if (!existing) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet
      const { error } = await supabase.from("instructor_availability" as any).delete().eq("id", existing.id);
      if (error) return;
      setEntries((prev) => { const copy = { ...prev }; delete copy[key(userId, date)]; return copy; });
      return;
    }
    const { data, error } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet
      .from("instructor_availability" as any)
      .upsert(
        { group_id: groupId, user_id: userId, date, status: next, note: existing?.note ?? null },
        { onConflict: "group_id,user_id,date" },
      )
      .select("id, status, note")
      .single();
    if (error || !data) return;
    setEntries((prev) => ({ ...prev, [key(userId, date)]: data as unknown as Entry }));
  };

  const saveNote = async (userId: string, date: string, note: string) => {
    if (!user || !(canManage || userId === user.id)) return;
    const existing = entries[key(userId, date)];
    if (!existing) return;
    const trimmed = note.trim() || null;
    if (trimmed === existing.note) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet
    const { error } = await supabase.from("instructor_availability" as any).update({ note: trimmed }).eq("id", existing.id);
    if (error) return;
    setEntries((prev) => ({ ...prev, [key(userId, date)]: { ...existing, note: trimmed } }));
  };

  const shiftWeek = (delta: number) => {
    setWeekStart((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + delta * 7));
  };

  const weekLabel = `${parseIsoDateLocal(dates[0]).toLocaleDateString("de-CH", { day: "numeric", month: "short" })} – ${parseIsoDateLocal(dates[6]).toLocaleDateString("de-CH", { day: "numeric", month: "short", year: "numeric" })}`;

  if (loading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (loadError) {
    return (
      <div role="alert" className="space-y-2 pt-3">
        <p className="text-sm">{t("school.availability.loadFailed")}</p>
        <Button onClick={() => void load()}>{t("school.availability.retry")}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-3">
      <div className="flex items-center justify-between">
        <Button size="icon" variant="ghost" onClick={() => shiftWeek(-1)} aria-label={t("school.availability.prevWeek")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="text-sm font-medium">{weekLabel}</p>
        <Button size="icon" variant="ghost" onClick={() => shiftWeek(1)} aria-label={t("school.availability.nextWeek")}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {people.length === 0 ? (
        <EmptyState icon={CalendarClock} title={t("school.availability.noTeam")} description={t("school.availability.noTeamHint")} />
      ) : (
        dates.map((date) => (
          <Card key={date} className="border-border/60 bg-card/80">
            <CardContent className="p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {parseIsoDateLocal(date).toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "short" })}
              </p>
              <div className="space-y-1.5">
                {people.map((p) => {
                  const entry = entries[key(p.userId, date)];
                  const disabled = !(canManage || p.userId === user?.id);
                  return (
                    <div key={p.userId} className="flex items-center gap-2">
                      <span className="text-sm flex-1 truncate">{p.name}</span>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => cycle(p.userId, date)}
                        className={`text-[11px] px-2 py-1 rounded-full border shrink-0 ${
                          entry ? STATUS_STYLES[entry.status] : "border-border text-muted-foreground"
                        }`}
                      >
                        {entry ? t(`school.availability.status.${entry.status}`) : t("school.availability.status.none")}
                      </button>
                    </div>
                  );
                })}
              </div>
              {people.some((p) => entries[key(p.userId, date)]) && (
                <div className="space-y-1 pt-1">
                  {people
                    .filter((p) => entries[key(p.userId, date)])
                    .map((p) => (
                      <Input
                        key={p.userId}
                        disabled={!(canManage || p.userId === user?.id)}
                        value={noteDraft[key(p.userId, date)] ?? entries[key(p.userId, date)]?.note ?? ""}
                        onChange={(e) => setNoteDraft((prev) => ({ ...prev, [key(p.userId, date)]: e.target.value }))}
                        onBlur={(e) => saveNote(p.userId, date, e.target.value)}
                        placeholder={t("school.availability.notePlaceholder", { name: p.name })}
                        className="h-7 text-xs"
                      />
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
