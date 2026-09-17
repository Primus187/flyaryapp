import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Check, ChevronRight, Circle } from "lucide-react";

interface Props {
  groupId: string;
}

type Step = { key: string; done: boolean; path: string };

export default function SchoolSetupCard({ groupId }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [steps, setSteps] = useState<Step[] | null>(null);

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    const load = async () => {
      const [funcs, rates, equip, events, push] = await Promise.all([
        supabase
          .from("group_member_functions" as any)
          .select("id", { count: "exact", head: true })
          .eq("group_id", groupId)
          .in("function", ["school_lead", "instructor", "launch_helper"] as any),
        supabase.from("school_rates" as any).select("id", { count: "exact", head: true }).eq("group_id", groupId),
        supabase.from("school_equipment" as any).select("id", { count: "exact", head: true }).eq("group_id", groupId),
        supabase.from("flight_events").select("id", { count: "exact", head: true }).eq("group_id", groupId),
        user
          ? supabase.from("push_subscriptions" as any).select("id", { count: "exact", head: true }).eq("user_id", user.id)
          : Promise.resolve({ count: 0 } as any),
      ]);
      if (cancelled) return;
      setSteps([
        { key: "functions", done: (funcs.count || 0) > 0, path: "/school/people" },
        { key: "rates", done: (rates.count || 0) > 0, path: "/school/equipment" },
        { key: "equipment", done: (equip.count || 0) > 0, path: "/school/equipment" },
        { key: "push", done: ((push as any).count || 0) > 0, path: "/settings" },
        { key: "event", done: (events.count || 0) > 0, path: `/events/new?group=${groupId}` },
      ]);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [groupId, user]);

  if (!steps) return null;
  const open = steps.filter((s) => !s.done);
  if (open.length === 0) return null;

  return (
    <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur-sm">
      <CardContent className="p-4 space-y-3">
        <div>
          <p className="font-semibold text-sm">{t("school.setup.title")}</p>
          <p className="text-xs text-muted-foreground">
            {t("school.setup.progress", { done: steps.length - open.length, total: steps.length })}
          </p>
        </div>
        <div className="space-y-1.5">
          {steps.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => navigate(s.path)}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-muted/50 transition-colors"
            >
              {s.done ? (
                <Check className="h-4 w-4 text-primary shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className={`flex-1 text-sm ${s.done ? "text-muted-foreground line-through" : ""}`}>
                {t(`school.setup.${s.key}`)}
              </span>
              {!s.done && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
