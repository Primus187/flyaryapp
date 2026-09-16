import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Plane, Target, ArrowRight } from "lucide-react";

interface NextStepCardProps {
  hasProfileName: boolean;
  flightCount: number;
  goalCount: number;
  onAddGoal?: () => void;
}

/** Geführter Einstieg: zeigt genau eine empfohlene nächste Handlung. */
export default function NextStepCard({ hasProfileName, flightCount, goalCount, onAddGoal }: NextStepCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const steps = [
    { key: "profile", done: hasProfileName, icon: User, path: "/profile" },
    { key: "flight", done: flightCount > 0, icon: Plane, path: "/flights/new" },
    { key: "goal", done: goalCount > 0, icon: Target, path: "/stats" },
  ];

  const index = steps.findIndex((s) => !s.done);
  if (index === -1) return null;

  const step = steps[index];
  const Icon = step.icon;

  return (
    <section aria-label={t("nextStep.title")}>
      <Card className="border border-primary/25 bg-primary/5 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">
                {t("nextStep.title")} · {t("nextStep.progress", { current: index + 1, total: steps.length })}
              </p>
              <p className="text-sm font-semibold mt-0.5">{t(`nextStep.${step.key}Title`)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t(`nextStep.${step.key}Desc`)}</p>
              <Button
                size="sm"
                className="mt-3 gap-1.5"
                onClick={() => (step.key === "goal" && onAddGoal ? onAddGoal() : navigate(step.path))}
              >
                {t(`nextStep.${step.key}Cta`)} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
