import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { X, Target, Trophy } from "lucide-react";
import type { PilotGoal } from "@/hooks/use-pilot-goals";

interface GoalCardProps {
  goal: PilotGoal;
  onDelete?: (id: string) => void;
}

export default function GoalCard({ goal, onDelete }: GoalCardProps) {
  const isComplete = goal.progress >= 100;

  return (
    <div className={`rounded-2xl border px-3.5 py-3 ${isComplete ? "bg-success-soft border-success/30" : "bg-card"}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {isComplete ? (
            <Trophy className="h-4 w-4 text-success-soft-foreground shrink-0" />
          ) : (
            <Target className="h-4 w-4 text-primary shrink-0" />
          )}
          <span className="text-sm font-bold truncate">{goal.title}</span>
        </div>
        {onDelete && (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" onClick={() => onDelete(goal.id)}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Progress value={goal.progress} className="h-2 mb-1.5" />
      <div className="flex justify-between text-[13px] font-medium text-muted-foreground">
        <span>
          {goal.currentValue}{goal.unit ? ` ${goal.unit}` : ""} / {goal.target_value}{goal.unit ? ` ${goal.unit}` : ""}
        </span>
        <span className={isComplete ? "text-success-soft-foreground font-bold" : ""}>
          {isComplete ? "✓ Erreicht!" : `${goal.progress}%`}
        </span>
      </div>
    </div>
  );
}
