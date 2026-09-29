import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DISCIPLINES } from "@/lib/flight-proof";
import { LICENCES, allMet, progress, requirementLabelKey, valueText, type TrainingStatus } from "@/lib/training-status";

/**
 * Training status against the SHV directives (migration 0075), for the pilot or the school staff.
 * Informational only: the exam admission is decided by the examiners with the stamped printout.
 */
export default function TrainingStatusCard({ userId, defaultDiscipline = "paraglider", defaultLicence = "pilot" }: {
  userId: string; defaultDiscipline?: string; defaultLicence?: string;
}) {
  const { t } = useTranslation();
  const [discipline, setDiscipline] = useState(defaultDiscipline);
  const [licence, setLicence] = useState(defaultLicence);

  const query = useQuery({
    queryKey: ["training-status", userId, discipline, licence],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("training_status" as never, { _user_id: userId, _discipline: discipline, _licence: licence } as never);
      if (error) throw error;
      return data as unknown as TrainingStatus;
    },
  });
  // Tolerate an unexpected payload instead of breaking the page.
  const status = query.data && Array.isArray(query.data.requirements) ? query.data : null;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2"><CardTitle className="text-base">{t("trainingStatus.title")}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Select value={discipline} onValueChange={(v) => { setDiscipline(v); if (!LICENCES[v].includes(licence)) setLicence("pilot"); }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{DISCIPLINES.map((d) => <SelectItem key={d} value={d}>{t(`flightProof.discipline.${d}`)}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={licence} onValueChange={setLicence}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{LICENCES[discipline].map((l) => <SelectItem key={l} value={l}>{t(`trainingStatus.licence.${l}`)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {query.isPending ? <Skeleton className="h-24 w-full" />
          : query.isError ? <p role="alert" className="text-xs text-destructive">{t("trainingStatus.loadFailed")}</p>
          : status && (
            <>
              {status.requirements.map((r, i) => (
                <div key={`${r.rule}-${i}`} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1.5">
                      {r.met ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
                      {t(requirementLabelKey(r), { threshold: r.threshold, kind: t(`trainingStatus.evidence.${r.params.kind}`, { defaultValue: r.params.kind ?? "" }) })}
                    </span>
                    <span className="tabular-nums text-xs text-muted-foreground shrink-0">
                      {r.rule === "evidence_within_years"
                        ? (r.value == null ? t("trainingStatus.noEvidence") : t("trainingStatus.yearsAgo", { count: r.value }))
                        : r.rule === "evidence_present"
                          ? (r.met ? t("trainingStatus.present") : t("trainingStatus.noEvidence"))
                          : valueText(r)}
                    </span>
                  </div>
                  {!["evidence_within_years", "evidence_present", "licence_held_years"].includes(r.rule) && <Progress value={progress(r) * 100} className="h-1.5" />}
                </div>
              ))}
              {allMet(status) && <p className="text-xs text-green-700 dark:text-green-400">{t("trainingStatus.allMet")}</p>}
              {status.confirmedWithoutKind > 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-400">{t("trainingStatus.withoutKind", { count: status.confirmedWithoutKind })}</p>
              )}
              <p className="text-[11px] text-muted-foreground flex gap-1.5"><Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                {t("trainingStatus.hint", { source: [...new Set(status.requirements.map((r) => r.source))].join("; ") })}</p>
            </>
          )}
      </CardContent>
    </Card>
  );
}
