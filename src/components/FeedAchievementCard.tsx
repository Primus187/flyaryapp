import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy, Target, MessageCircle, ChevronRight, Bookmark } from "lucide-react";
import MentionCommentInput from "@/components/MentionCommentInput";
import { cn } from "@/lib/utils";
import DoubleTapHeart from "@/components/DoubleTapHeart";
import ReactionPicker, { ReactionBadges, type ReactionType } from "@/components/ReactionPicker";

export interface FeedAchievement {
  id: string;
  user_id: string;
  challenge_id: string;
  goal_id: string | null;
  achievement_type: string;
  created_at: string;
  pilot_name: string;
  avatar_url: string;
  challenge_title: string;
  goal_label: string | null;
  group_name: string;
  total_goals: number;
  completed_goals: number;
  likes: { user_id: string; reaction_type: string }[];
  comments: { id: string; user_id: string; message: string; created_at: string; pilot_name: string }[];
  isBookmarked?: boolean;
}

interface Props {
  achievement: FeedAchievement;
  onReact: (id: string, reactionType: ReactionType) => void;
  onComment: (id: string, message: string) => void;
  onBookmarkToggle?: (id: string) => void;
  onCommentLike?: (commentId: string) => void;
  groupMembers?: { user_id: string; pilot_name: string }[];
}

function relativeTime(dateStr: string, t: (key: string, opts?: any) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("feed.justNow");
  if (mins < 60) return t("feed.minutesAgo", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("feed.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  return t("feed.daysAgo", { count: days });
}

export default function FeedAchievementCard({ achievement, onReact, onComment, onBookmarkToggle, onCommentLike, groupMembers }: Props) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showComments, setShowComments] = useState(false);

  const isComplete = achievement.achievement_type === "challenge_completed";
  const initials = achievement.pilot_name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
  const progress = achievement.total_goals > 0
    ? Math.round((achievement.completed_goals / achievement.total_goals) * 100)
    : 0;

  const handleDoubleTapLike = useCallback(() => {
    const isLiked = achievement.likes.some(l => l.user_id === user?.id);
    if (!isLiked) {
      onReact(achievement.id, "heart");
    }
  }, [achievement.likes, user?.id, onReact, achievement.id]);

  const handleSubmitComment = (msg: string) => {
    onComment(achievement.id, msg);
  };

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 p-3 pb-2">
        <div className="p-[2px] rounded-full bg-gradient-to-tr from-amber-400 via-yellow-500 to-orange-400 cursor-pointer" onClick={() => navigate(`/pilot/${achievement.user_id}`)}>
          <Avatar className="h-8 w-8 border-2 border-background">
            <AvatarImage src={achievement.avatar_url} />
            <AvatarFallback className="text-xs bg-muted">{initials}</AvatarFallback>
          </Avatar>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate cursor-pointer" onClick={() => navigate(`/pilot/${achievement.user_id}`)}>{achievement.pilot_name}</p>
          <p className="text-[11px] text-muted-foreground">
            {achievement.group_name} · {relativeTime(achievement.created_at, t)}
          </p>
        </div>
      </div>

      <DoubleTapHeart onDoubleTap={handleDoubleTapLike}>
        <div className={cn(
          "relative px-5 py-6 text-center overflow-hidden",
          isComplete
            ? "bg-gradient-to-br from-amber-500/25 via-yellow-400/15 to-orange-500/20"
            : "bg-gradient-to-br from-sky-500/15 via-primary/10 to-transparent"
        )}>
          {isComplete && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" />
          )}
          <div className="relative z-10 space-y-2">
            <div className={cn("mx-auto h-14 w-14 rounded-2xl flex items-center justify-center", isComplete ? "bg-amber-500/30" : "bg-primary/20")}>
              {isComplete ? <Trophy className="h-7 w-7 text-amber-500" /> : <Target className="h-7 w-7 text-primary" />}
            </div>
            <Badge className={cn("border-0 text-xs font-bold px-3 py-1", isComplete ? "bg-amber-500/25 text-amber-600 dark:text-amber-400" : "bg-primary/20 text-primary")}>
              {isComplete ? `🏆 ${t("feed.challengeCompleted")}` : `🎯 ${t("feed.goalReached")}`}
            </Badge>
            <h3 className="text-base font-bold">{achievement.challenge_title}</h3>
            {achievement.goal_label && !isComplete && (
              <p className="text-sm text-muted-foreground">{achievement.goal_label}</p>
            )}
            {achievement.total_goals > 0 && (
              <div className="max-w-[200px] mx-auto space-y-1 pt-1">
                <Progress value={progress} className="h-2" />
                <p className="text-[11px] text-muted-foreground">
                  {achievement.completed_goals}/{achievement.total_goals} {t("challenges.goals")}
                </p>
              </div>
            )}
          </div>
        </div>
      </DoubleTapHeart>

      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-3">
          <ReactionPicker
            reactions={achievement.likes}
            currentUserId={user?.id}
            onReact={(type) => onReact(achievement.id, type)}
          />
          <button onClick={() => setShowComments(!showComments)} className="active:scale-90 transition-transform">
            <MessageCircle className="h-6 w-6" />
          </button>
          <div className="flex-1" />
          {onBookmarkToggle && (
            <button onClick={() => onBookmarkToggle(achievement.id)} className="active:scale-90 transition-transform">
              <Bookmark className={cn("h-6 w-6", achievement.isBookmarked ? "fill-foreground text-foreground" : "text-foreground")} />
            </button>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs px-2 gap-1"
            onClick={() => navigate(`/challenges/${achievement.challenge_id}`)}>
            {t("feed.viewDetails")} <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        <ReactionBadges reactions={achievement.likes} />

        {(showComments || achievement.comments.length > 0) && (
          <div className="space-y-1.5 pt-1">
            {!showComments && achievement.comments.length > 2 && (
              <button onClick={() => setShowComments(true)} className="text-xs text-muted-foreground">
                {t("feed.viewAllComments", { count: achievement.comments.length })}
              </button>
            )}
            {(showComments ? achievement.comments : achievement.comments.slice(-2)).map(c => (
              <div key={c.id} className="flex items-start gap-1 group">
                <p className="text-sm flex-1">
                  <span className="font-semibold mr-1">{c.pilot_name}</span>{c.message}
                </p>
                {onCommentLike && (
                  <button onClick={() => onCommentLike(c.id)} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5 active:scale-90">
                    <span className="text-xs text-muted-foreground hover:text-red-500">❤️</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <MentionCommentInput onSubmit={handleSubmitComment} members={groupMembers} />
      </CardContent>
    </Card>
  );
}
