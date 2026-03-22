import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trophy, Target, Calendar, Users } from "lucide-react";
import { format } from "date-fns";

interface ChallengeCardProps {
  challenge: {
    id: string;
    title: string;
    description?: string;
    challenge_type: string;
    start_date: string;
    end_date?: string;
    totalGoals: number;
    myCompleted: number;
    participantCount: number;
  };
}

export default function ChallengeCard({ challenge }: ChallengeCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const progress = challenge.totalGoals > 0
    ? (challenge.myCompleted / challenge.totalGoals) * 100
    : 0;
  const isComplete = challenge.totalGoals > 0 && challenge.myCompleted >= challenge.totalGoals;
  const isActive = !challenge.end_date || new Date(challenge.end_date) >= new Date();

  return (
    <button
      onClick={() => navigate(`/challenges/${challenge.id}`)}
      className="w-full text-left p-4 rounded-xl bg-card border border-border/30 shadow-sm hover:bg-muted/30 active:scale-[0.98] transition-all space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
            isComplete ? "bg-amber-500/10" : "bg-primary/10"
          }`}>
            {isComplete ? (
              <Trophy className="h-4.5 w-4.5 text-amber-500" />
            ) : (
              <Target className="h-4.5 w-4.5 text-primary" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{challenge.title}</p>
            {challenge.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">{challenge.description}</p>
            )}
          </div>
        </div>
        <Badge variant={isActive ? "default" : "secondary"} className="text-[10px] shrink-0">
          {isActive ? t("challenges.active") : t("challenges.ended")}
        </Badge>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {challenge.myCompleted}/{challenge.totalGoals} {t("challenges.goals")}
          </span>
          <span className="font-medium tabular-nums">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {format(new Date(challenge.start_date), "dd.MM.yy")}
          {challenge.end_date && ` – ${format(new Date(challenge.end_date), "dd.MM.yy")}`}
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {challenge.participantCount}
        </span>
      </div>
    </button>
  );
}
