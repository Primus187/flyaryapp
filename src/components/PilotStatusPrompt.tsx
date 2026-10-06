import { useTranslation } from "react-i18next";
import { GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePilotStatus } from "@/hooks/use-pilot-status";
import type { TrainingLevel } from "@/lib/pilot-status";

/** Asked once on Start while the Ausbildungsstand is not set (migration 0089): student or pilot? */
export default function PilotStatusPrompt() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { status, refetch } = usePilotStatus();

  if (status?.kind !== "unknown") return null;

  const answer = async (level: TrainingLevel) => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ training_level: level }).eq("user_id", user.id);
    if (error) { toast({ title: t("common.error"), description: error.message, variant: "destructive" }); return; }
    await refetch();
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="flex items-center gap-2 text-sm font-bold"><GraduationCap className="h-5 w-5 shrink-0 text-primary" />{t("pilotStatus.question")}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => void answer("ground")}>{t("pilotStatus.student")}</Button>
          <Button variant="outline" onClick={() => void answer("licensed")}>{t("pilotStatus.pilot")}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
