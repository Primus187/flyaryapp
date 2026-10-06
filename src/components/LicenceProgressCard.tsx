import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { usePilotStatus } from "@/hooks/use-pilot-status";
import { statusLabelKeys } from "@/lib/pilot-status";
import { requirementLabelKey, requirementSummary, valueText, type TrainingStatus } from "@/lib/training-status";

/**
 * Start: progress towards the licence the person is working on (migration 0089) — the pilot licence
 * for a student, the chosen goal for a pilot. Pilots without a goal see nothing. Opens the Training page.
 */
export default function LicenceProgressCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { status } = usePilotStatus();
  const target = status?.target ?? null;
  const discipline = status?.licences[0]?.discipline ?? "paraglider";

  const query = useQuery({
    queryKey: ["training-status", user?.id, discipline, target],
    enabled: !!user && !!target,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("training_status", { _user_id: user!.id, _discipline: discipline, _licence: target! });
      if (error) throw error;
      return data as unknown as TrainingStatus;
    },
  });
  const training = query.data && Array.isArray(query.data.requirements) ? query.data : null;
  const { met, total, next } = requirementSummary(training);
  if (!status || !target || total === 0) return null;

  const evidence = next?.rule === "evidence_within_years" || next?.rule === "evidence_present";
  return (
    <Card>
      <CardContent className="p-0">
        <button type="button" onClick={() => navigate("/training")} className="w-full space-y-3 p-[18px] text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="eyebrow">{statusLabelKeys(status).map((key) => t(key)).join(" · ")}</p>
              <p className="text-lg leading-6 font-extrabold tracking-tight">{t("pilotStatus.goalTitle", { licence: t(`trainingStatus.licence.${target}`) })}</p>
            </div>
            <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <Progress value={(met / total) * 100} />
            <p className="text-[13px] font-semibold text-muted-foreground">{t("pilotStatus.requirementsMet", { met, total })}</p>
          </div>
          {next && (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-1.5 font-semibold"><Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                {t(requirementLabelKey(next), { threshold: next.threshold, kind: t(`trainingStatus.evidence.${next.params.kind}`, { defaultValue: next.params.kind ?? "" }) })}</span>
              {!evidence && <span className="stat-value shrink-0 text-sm">{valueText(next)}</span>}
            </div>
          )}
        </button>
      </CardContent>
    </Card>
  );
}
