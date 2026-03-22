import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Target, ChevronRight } from "lucide-react";

export interface FeedChallenge {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  created_at: string;
  group_id: string;
  group_name: string;
  total_goals: number;
  completed_goals: number;
  participant_count: number;
}

interface FeedChallengeCardProps {
  challenge: FeedChallenge;
}

export default function FeedChallengeCard({ challenge }: FeedChallengeCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const progress = challenge.total_goals > 0
    ? Math.round((challenge.completed_goals / challenge.total_goals) * 100)
    : 0;

  const isCompleted = challenge.total_goals > 0 && challenge.completed_goals >= challenge.total_goals;
  const isNew = new Date(challenge.start_date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      {/* Trophy gradient header */}
      <div className="relative px-4 py-5 bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-2xl bg-amber-500/20 flex items-center justify-center shrink-0">
            {isCompleted ? (
              <Trophy className="h-5 w-5 text-amber-400" />
            ) : (
              <Target className="h-5 w-5 text-amber-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{challenge.group_name}</p>
              {isNew && <Badge className="bg-primary/20 text-primary border-0 text-[10px]">{t("groups.new")}</Badge>}
              {isCompleted && <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-[10px]">🏆</Badge>}
            </div>
            <h3 className="text-base font-bold truncate mt-0.5">{challenge.title}</h3>
          </div>
        </div>
      </div>

      <CardContent className="p-3 space-y-3">
        {challenge.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{challenge.description}</p>
        )}

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {challenge.completed_goals}/{challenge.total_goals} {t("challenges.goals")}
            </span>
            <span className="font-semibold">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {challenge.participant_count} {t("feed.participants")}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs px-2 gap-1"
            onClick={() => navigate(`/challenges/${challenge.id}`)}
          >
            {t("feed.viewDetails")}
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
