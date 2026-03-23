import { useEffect, useState, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Trophy, Target, Check, Trash2, Plus, Pencil, Save } from "lucide-react";
import ChallengeGoalForm from "@/components/ChallengeGoalForm";

const ChallengeMap = lazy(() => import("@/components/ChallengeMap"));

interface Goal {
  id: string;
  label: string | null;
  location_id: string | null;
  points: number;
  sort_order: number;
  location_name?: string;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  goal_type: string;
}

interface Participant {
  user_id: string;
  pilot_name: string;
  avatar_url: string | null;
  avatar_signed?: string;
  completed: number;
  total_points: number;
}

interface LocationOption { id: string; name: string; type: string; latitude?: number; longitude?: number; }

export default function ChallengeDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [challenge, setChallenge] = useState<any>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [myProgress, setMyProgress] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    loadData();
    supabase.from("locations").select("id, name, type, latitude, longitude").eq("user_id", user.id).order("name").then(({ data }) => {
      if (data) setLocations(data);
    });
  }, [user, id]);

  const loadData = async () => {
    setLoading(true);
    const { data: c } = await supabase.from("challenges" as any).select("*").eq("id", id).single();
    if (!c) { navigate(-1); return; }
    setChallenge(c);

    const { data: adminCheck } = await supabase.rpc("is_group_admin", { _user_id: user!.id, _group_id: (c as any).group_id });
    setIsAdmin(!!adminCheck);

    const { data: goalsData } = await supabase.from("challenge_goals" as any).select("*").eq("challenge_id", id).order("sort_order" as any);
    const goalsList = (goalsData as any[] || []) as Goal[];

    const locationIds = goalsList.filter(g => g.location_id).map(g => g.location_id!);
    if (locationIds.length) {
      const { data: locs } = await supabase.from("locations").select("id, name").in("id", locationIds);
      const locMap = new Map((locs || []).map(l => [l.id, l.name]));
      goalsList.forEach(g => { if (g.location_id) g.location_name = locMap.get(g.location_id); });
    }
    setGoals(goalsList);

    const { data: progressData } = await supabase.from("challenge_progress" as any).select("user_id, goal_id").eq("challenge_id", id);
    const progressList = (progressData as any[] || []);
    const myGoalIds = new Set(progressList.filter(p => p.user_id === user!.id).map(p => p.goal_id));
    setMyProgress(myGoalIds);

    const { data: members } = await supabase.from("group_members").select("user_id").eq("group_id", (c as any).group_id);
    const memberIds = (members || []).map(m => m.user_id);
    const { data: profiles } = await supabase.from("profiles").select("user_id, pilot_name, avatar_url").in("user_id", memberIds);

    const participantMap = new Map<string, Participant>();
    (profiles || []).forEach(p => {
      const userProgress = progressList.filter(pr => pr.user_id === p.user_id);
      const completedGoals = userProgress.length;
      const totalPoints = goalsList
        .filter(g => userProgress.some(pr => pr.goal_id === g.id))
        .reduce((sum, g) => sum + g.points, 0);

      if (completedGoals > 0 || p.user_id === user!.id) {
        participantMap.set(p.user_id, {
          user_id: p.user_id,
          pilot_name: p.pilot_name || "Pilot",
          avatar_url: p.avatar_url,
          completed: completedGoals,
          total_points: totalPoints,
        });
      }
    });

    const sortedParticipants = [...participantMap.values()].sort((a, b) => b.total_points - a.total_points);
    for (const p of sortedParticipants) {
      if (p.avatar_url && !p.avatar_url.startsWith("http")) {
        const { data } = await supabase.storage.from("flight-photos").createSignedUrl(p.avatar_url, 3600);
        if (data?.signedUrl) p.avatar_signed = data.signedUrl;
      } else if (p.avatar_url) {
        p.avatar_signed = p.avatar_url;
      }
    }
    setParticipants(sortedParticipants);
    setLoading(false);
  };

  const handleToggleGoal = async (goalId: string) => {
    if (!user || !id) return;
    if (myProgress.has(goalId)) {
      await supabase.from("challenge_progress" as any).delete().eq("challenge_id", id).eq("user_id", user.id).eq("goal_id", goalId);
      setMyProgress(prev => { const n = new Set(prev); n.delete(goalId); return n; });
    } else {
      await supabase.from("challenge_progress" as any).insert({ challenge_id: id, user_id: user.id, goal_id: goalId } as any);
      setMyProgress(prev => new Set(prev).add(goalId));
    }
    loadData();
  };

  const handleAddGoal = async (goal: { label: string; points: number; goal_type: string; latitude: number | null; longitude: number | null; radius_meters: number; location_id: string | null }) => {
    if (!id) return;
    await supabase.from("challenge_goals" as any).insert({
      challenge_id: id,
      label: goal.label,
      points: goal.points,
      sort_order: goals.length,
      goal_type: goal.goal_type,
      latitude: goal.latitude,
      longitude: goal.longitude,
      radius_meters: goal.radius_meters,
      location_id: goal.location_id,
    } as any);
    setShowAddGoal(false);
    loadData();
    toast({ title: t("challenges.goalAdded") });
  };

  const handleDeleteGoal = async (goalId: string) => {
    await supabase.from("challenge_goals" as any).delete().eq("id", goalId);
    loadData();
    toast({ title: t("challenges.goalRemoved") });
  };

  const handleDeleteChallenge = async () => {
    if (!confirm(t("challenges.deleteConfirm"))) return;
    await supabase.from("challenges" as any).delete().eq("id", id);
    navigate(-1);
    toast({ title: t("challenges.challengeDeleted") });
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">{t("common.loading")}</div>;
  if (!challenge) return null;

  const totalGoals = goals.length;
  const myCompleted = myProgress.size;
  const progress = totalGoals > 0 ? (myCompleted / totalGoals) * 100 : 0;
  const isComplete = totalGoals > 0 && myCompleted >= totalGoals;
  const hasMapGoals = goals.some(g => g.latitude && g.longitude);

  const goalTypeLabels: Record<string, string> = {
    start: t("challenges.start"),
    turnpoint: t("challenges.turnpoint"),
    waypoint: t("challenges.waypoint"),
    goal: t("challenges.goal"),
  };

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-1"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="text-xl font-bold tracking-tight flex-1 truncate">{challenge.title}</h1>
        {isAdmin && (
          <button onClick={handleDeleteChallenge} className="p-1.5 text-destructive">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {challenge.description && (
        <p className="text-sm text-muted-foreground">{challenge.description}</p>
      )}

      {/* Map */}
      {hasMapGoals && (
        <Suspense fallback={<div className="h-[200px] rounded-xl bg-muted animate-pulse" />}>
          <ChallengeMap goals={goals} completedGoalIds={myProgress} />
        </Suspense>
      )}

      {/* Progress overview */}
      <div className={`p-4 rounded-xl border ${isComplete ? "bg-amber-500/5 border-amber-500/20" : "bg-card border-border/30"}`}>
        <div className="flex items-center gap-3 mb-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isComplete ? "bg-amber-500/10" : "bg-primary/10"}`}>
            {isComplete ? <Trophy className="h-5 w-5 text-amber-500" /> : <Target className="h-5 w-5 text-primary" />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {isComplete ? t("challenges.completed") : t("challenges.inProgress")}
            </p>
            <p className="text-xs text-muted-foreground">
              {myCompleted}/{totalGoals} {t("challenges.goals")} • {Math.round(progress)}%
            </p>
          </div>
        </div>
        <Progress value={progress} className="h-2.5" />
      </div>

      {/* Goals checklist */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{t("challenges.goalsList")}</p>
          {isAdmin && (
            <Button variant="ghost" size="sm" onClick={() => setShowAddGoal(true)}>
              <Plus className="h-4 w-4 mr-1" /> {t("common.add")}
            </Button>
          )}
        </div>

        {goals.map(goal => {
          const done = myProgress.has(goal.id);
          return (
            <button
              key={goal.id}
              onClick={() => handleToggleGoal(goal.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all active:scale-[0.98] ${
                done ? "bg-primary/5 border-primary/20" : "bg-card border-border/30 hover:bg-muted/30"
              }`}
            >
              <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                done ? "bg-primary border-primary" : "border-muted-foreground/30"
              }`}>
                {done && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className={`text-sm ${done ? "line-through text-muted-foreground" : "font-medium"}`}>
                  {goal.label || goal.location_name || t("challenges.unknownGoal")}
                </p>
                {goal.goal_type !== "waypoint" && (
                  <p className="text-[10px] text-muted-foreground">{goalTypeLabels[goal.goal_type] || goal.goal_type}</p>
                )}
              </div>
              <Badge variant="secondary" className="text-[10px] shrink-0 tabular-nums">
                {goal.points} pts
              </Badge>
              {isAdmin && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteGoal(goal.id); }}
                  className="p-1 text-destructive/50 hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </button>
          );
        })}

        {showAddGoal && (
          <ChallengeGoalForm
            locations={locations}
            onSave={handleAddGoal}
            onCancel={() => setShowAddGoal(false)}
          />
        )}

        {goals.length === 0 && !showAddGoal && (
          <p className="text-sm text-muted-foreground text-center py-4">{t("challenges.noGoals")}</p>
        )}
      </div>

      {/* Participant ranking */}
      {participants.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">{t("challenges.ranking")}</p>
          {participants.map((p, idx) => {
            const rank = idx + 1;
            const initials = p.pilot_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
            const pProgress = totalGoals > 0 ? (p.completed / totalGoals) * 100 : 0;
            const isMe = p.user_id === user?.id;

            return (
              <div
                key={p.user_id}
                className={`flex items-center gap-3 p-3 rounded-xl ${
                  isMe ? "bg-primary/5 border border-primary/20" : "bg-card border border-border/30"
                }`}
              >
                <span className={`w-5 text-center text-xs font-bold ${
                  rank === 1 ? "text-amber-400" : rank === 2 ? "text-zinc-400" : rank === 3 ? "text-orange-400" : "text-muted-foreground"
                }`}>
                  {rank <= 3 ? <Trophy className={`h-3.5 w-3.5 mx-auto ${
                    rank === 1 ? "text-amber-400" : rank === 2 ? "text-zinc-400" : "text-orange-400"
                  }`} /> : rank}
                </span>

                <Avatar className="h-8 w-8">
                  <AvatarImage src={p.avatar_signed} />
                  <AvatarFallback className="text-[10px] bg-muted">{initials}</AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.pilot_name}</p>
                  <Progress value={pProgress} className="h-1 mt-1" />
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-bold tabular-nums">{p.total_points}</p>
                  <p className="text-[10px] text-muted-foreground">{p.completed}/{totalGoals}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
