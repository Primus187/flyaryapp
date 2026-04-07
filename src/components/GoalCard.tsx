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
    <div className={`rounded-xl p-3 ${isComplete ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800" : "bg-card border border-border/30"}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {isComplete ? (
            <Trophy className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
          ) : (
            <Target className="h-4 w-4 text-primary shrink-0" />
          )}
          <span className="text-sm font-medium truncate">{goal.title}</span>
        </div>
        {onDelete && (
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => onDelete(goal.id)}>
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      <Progress value={goal.progress} className="h-2 mb-1.5" />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {goal.currentValue}{goal.unit ? ` ${goal.unit}` : ""} / {goal.target_value}{goal.unit ? ` ${goal.unit}` : ""}
        </span>
        <span className={isComplete ? "text-green-600 dark:text-green-400 font-medium" : ""}>
          {isComplete ? "✓ Erreicht!" : `${goal.progress}%`}
        </span>
      </div>
    </div>
  );
}
