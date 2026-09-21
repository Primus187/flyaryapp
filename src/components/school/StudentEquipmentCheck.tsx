import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/layout/EmptyState";
import { ShieldCheck, Users, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const CHECK_ITEMS = ["helmet", "shoes", "harness_protector", "reserve"] as const;

interface Props {
  groupId: string;
}

interface Student {
  userId: string;
  name: string;
}

export default function StudentEquipmentCheck({ groupId }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data: members } = await supabase
        .from("group_members")
        .select("user_id, role")
        .eq("group_id", groupId)
        .eq("role", "member");
      const ids = (members || []).map((m) => m.user_id);

      const nameMap: Record<string, string> = {};
      let checkMap: Record<string, boolean> = {};
      if (ids.length > 0) {
        const [profs, checkRows] = await Promise.all([
          supabase.from("profiles").select("user_id, pilot_name").in("user_id", ids),
          supabase.from("equipment_checks").select("student_user_id, item, present").eq("group_id", groupId),
        ]);
        (profs.data || []).forEach((p) => { nameMap[p.user_id] = p.pilot_name || "—"; });
        (checkRows.data || []).forEach((c) => { checkMap[`${c.student_user_id}:${c.item}`] = c.present; });
      }

      if (cancelled) return;
      setStudents(ids.map((id) => ({ userId: id, name: nameMap[id] || "—" })).sort((a, b) => a.name.localeCompare(b.name)));
      setChecks(checkMap);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [groupId]);

  const toggle = async (studentId: string, item: string) => {
    const key = `${studentId}:${item}`;
    const next = !checks[key];
    setChecks((prev) => ({ ...prev, [key]: next }));
    await supabase.from("equipment_checks").upsert(
      {
        group_id: groupId,
        student_user_id: studentId,
        item,
        present: next,
        checked_at: new Date().toISOString(),
        checked_by: user?.id,
      },
      { onConflict: "group_id,student_user_id,item" },
    );
  };

  if (loading) return <Skeleton className="h-40 w-full rounded-2xl" />;

  if (students.length === 0) {
    return <EmptyState icon={Users} title={t("school.gear.empty")} description={t("school.gear.emptyHint")} />;
  }

  return (
    <div className="space-y-3 pt-3">
      <p className="text-xs text-muted-foreground">{t("school.gear.hint")}</p>
      {students.map((s) => {
        const missing = CHECK_ITEMS.filter((i) => !checks[`${s.userId}:${i}`]).length;
        return (
          <Card key={s.userId} className="border-border/60 bg-card/80">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className={cn("h-4 w-4 shrink-0", missing === 0 ? "text-primary" : "text-amber-500")} />
                <p className="text-sm font-medium flex-1 truncate">{s.name}</p>
                <span className="text-[10px] text-muted-foreground">
                  {missing === 0 ? t("school.gear.complete") : t("school.gear.missing", { count: missing })}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CHECK_ITEMS.map((item) => {
                  const on = !!checks[`${s.userId}:${item}`];
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggle(s.userId, item)}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors",
                        on ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 text-muted-foreground border-border/60",
                      )}
                    >
                      {on && <Check className="h-3 w-3" />}
                      {t(`school.gear.items.${item}`)}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
