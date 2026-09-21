import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";

interface Props {
  eventId: string;
  groupId: string;
}

/** SHV-Materialquote: mindestens 2 typengeprüfte Systeme pro 3 Schüler. Hinweis, kein Blocker. */
export default function EquipmentQuotaHint({ eventId, groupId }: Props) {
  const { t } = useTranslation();
  const [hint, setHint] = useState<{ needed: number; available: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [signupRes, equipRes] = await Promise.all([
        supabase.from("event_signups").select("user_id").eq("event_id", eventId).eq("signed_up", true),
        supabase
          .from("school_equipment")
          .select("id")
          .eq("group_id", groupId)
          .eq("shv_type_approved", true)
          .in("status", ["in_stock", "assigned"]),
      ]);
      const students = (signupRes.data || []).length;
      const available = (equipRes.data || []).length;
      const needed = Math.ceil((students / 3) * 2);
      if (cancelled) return;
      setHint(students > 0 && available < needed ? { needed, available } : null);
    };
    load();
    return () => { cancelled = true; };
  }, [eventId, groupId]);

  if (!hint) return null;

  return (
    <p className="text-xs text-amber-500 flex items-start gap-1.5">
      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      {t("school.quota.warning", { needed: hint.needed, available: hint.available })}
    </p>
  );
}
