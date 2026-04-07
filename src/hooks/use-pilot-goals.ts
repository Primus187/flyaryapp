import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PilotGoal {
  id: string;
  title: string;
  goal_type: string;
  target_value: number;
  unit: string;
  season_year: number;
  currentValue: number;
  progress: number;
}

export function usePilotGoals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<PilotGoal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGoals = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const currentYear = new Date().getFullYear();
    const { data: rawGoals } = await supabase
      .from("pilot_goals" as any)
      .select("*")
      .eq("user_id", user.id)
      .eq("season_year", currentYear);

    if (!rawGoals || rawGoals.length === 0) {
      setGoals([]);
      setLoading(false);
      return;
    }

    // Get stats for current year
    const { data: statsData } = await supabase.rpc("get_pilot_stats", {
      _user_id: user.id,
      _year: currentYear,
    });

    const stats = statsData?.[0] || { total_flights: 0, total_minutes: 0, total_altitude: 0, total_distance: 0 };

    const mapped: PilotGoal[] = (rawGoals as any[]).map((g) => {
      let currentValue = 0;
      switch (g.goal_type) {
        case "flights":
          currentValue = Number(stats.total_flights || 0);
          break;
        case "hours":
          currentValue = Math.round(Number(stats.total_minutes || 0) / 60);
          break;
        case "altitude":
          currentValue = Number(stats.total_altitude || 0);
          break;
        case "distance":
          currentValue = Math.round(Number(stats.total_distance || 0));
          break;
        default:
          currentValue = 0;
      }

      const target = Number(g.target_value) || 1;
      const progress = Math.min(100, Math.round((currentValue / target) * 100));

      return {
        id: g.id,
        title: g.title,
        goal_type: g.goal_type,
        target_value: target,
        unit: g.unit,
        season_year: g.season_year,
        currentValue,
        progress,
      };
    });

    setGoals(mapped);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const addGoal = async (goal: { title: string; goal_type: string; target_value: number; unit: string }) => {
    if (!user) return;
    const currentYear = new Date().getFullYear();
    await supabase.from("pilot_goals" as any).insert({
      user_id: user.id,
      title: goal.title,
      goal_type: goal.goal_type,
      target_value: goal.target_value,
      unit: goal.unit,
      season_year: currentYear,
    });
    await fetchGoals();
  };

  const deleteGoal = async (goalId: string) => {
    await supabase.from("pilot_goals" as any).delete().eq("id", goalId);
    setGoals((prev) => prev.filter((g) => g.id !== goalId));
  };

  return { goals, loading, addGoal, deleteGoal, refetch: fetchGoals };
}
