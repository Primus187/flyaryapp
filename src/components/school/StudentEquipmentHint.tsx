import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { missingEquipmentItems } from "@/lib/student-equipment";

export default function StudentEquipmentHint({ groupId, studentUserId }: { groupId: string; studentUserId: string }) {
  const { t } = useTranslation();
  const [result, setResult] = useState<{ missing: string[]; error: boolean } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setResult(null);
    const load = async () => {
      const { data, error } = await supabase.from("equipment_checks")
        .select("item, present").eq("group_id", groupId).eq("student_user_id", studentUserId);
      if (!cancelled) setResult({ missing: missingEquipmentItems(data || []), error: !!error });
    };
    void load();
    return () => { cancelled = true; };
  }, [groupId, studentUserId]);

  if (!result) return <p className="text-xs text-muted-foreground" role="status">{t("school.gear.loading")}</p>;
  if (!result.error && result.missing.length === 0) return null;
  return (
    <p role="status" className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>{result.error ? t("school.gear.loadFailed") : t("school.gear.signupWarning", {
        items: result.missing.map((item) => t(`school.gear.items.${item}`)).join(", "),
      })}</span>
    </p>
  );
}
