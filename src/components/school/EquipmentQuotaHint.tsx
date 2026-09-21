import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calculateEquipmentQuota, type QuotaSignup } from "@/lib/equipment-quota";

interface Props {
  groupId: string;
  eventDate: string;
  signups: QuotaSignup[];
}

/** Advisory stock check for students in their first three recorded basic-course days. */
export default function EquipmentQuotaHint({ groupId, eventDate, signups }: Props) {
  const { t } = useTranslation();
  const [hint, setHint] = useState<ReturnType<typeof calculateEquipmentQuota> | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setHint(null);
    setError(false);
    const load = async () => {
      try {
        const [members, functions, attendance, equipment, assignments] = await Promise.all([
          supabase.from("group_members").select("user_id, role", { count: "exact" }).eq("group_id", groupId),
          supabase.from("group_member_functions").select("user_id, function", { count: "exact" }).eq("group_id", groupId),
          supabase.from("event_signups")
            .select("user_id, flight_events!inner(event_date)", { count: "exact" })
            .eq("attended", true).eq("flight_events.group_id", groupId)
            .eq("flight_events.event_category", "basic_course")
            .neq("flight_events.status", "cancelled")
            .lt("flight_events.event_date", eventDate.slice(0, 10)),
          supabase.from("school_equipment")
            .select("id, equipment_type, status, shv_type_approved", { count: "exact" })
            .eq("group_id", groupId).eq("equipment_type", "glider").eq("shv_type_approved", true)
            .in("status", ["in_stock", "assigned"]),
          supabase.from("equipment_assignments")
            .select("equipment_id, user_id, assigned_on, returned_on", { count: "exact" })
            .eq("group_id", groupId).lte("assigned_on", eventDate.slice(0, 10))
            .or(`returned_on.is.null,returned_on.gte.${eventDate.slice(0, 10)}`),
        ]);
        // Never present a failed or truncated query as sufficient material.
        if ([members, functions, attendance, equipment, assignments].some((result) =>
          result.error || result.data === null || (result.count != null && result.count > result.data.length))) {
          throw new Error("Incomplete quota data");
        }
        const quota = calculateEquipmentQuota({
          members: members.data!, functions: functions.data!, equipment: equipment.data!, assignments: assignments.data!,
          attendance: attendance.data!.map((row) => ({ user_id: row.user_id, event_date: row.flight_events.event_date })),
          signups, eventDate,
        });
        if (!cancelled) setHint(quota);
      } catch {
        if (!cancelled) setError(true);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [groupId, eventDate, signups, retry]);

  if (error) return (
    <div role="alert" className="space-y-1">
      <p className="text-xs text-amber-600 dark:text-amber-400">{t("school.quota.loadFailed")}</p>
      <Button size="sm" variant="outline" onClick={() => setRetry((value) => value + 1)}>{t("school.quota.retry")}</Button>
    </div>
  );
  if (!hint) return <p role="status" className="text-xs text-muted-foreground">{t("school.quota.loading")}</p>;
  if (!hint.students || hint.available >= hint.needed) return null;

  return (
    <div role="status" className="space-y-1">
      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        {t("school.quota.warning", { needed: hint.needed, available: hint.available })}
      </p>
      <p className="text-xs text-muted-foreground">{t("school.quota.explanation", { count: hint.students })}</p>
    </div>
  );
}
