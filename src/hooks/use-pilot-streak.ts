import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Computes the current "weeks-in-a-row flying" streak for a user.
 * A streak week is any ISO week (Mon–Sun) that contains at least one flight.
 * The streak counts back consecutively from the current or previous week.
 */
export function usePilotStreak(userId: string | undefined) {
  const [streak, setStreak] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      // Pull last ~12 months of dates only (cheap)
      const since = new Date();
      since.setFullYear(since.getFullYear() - 1);
      const { data } = await supabase
        .from("flights")
        .select("date")
        .eq("user_id", userId)
        .gte("date", since.toISOString().slice(0, 10));

      if (cancelled) return;
      const weeks = new Set<string>();
      (data || []).forEach((f: any) => weeks.add(weekKey(new Date(f.date))));

      // Count consecutive weeks back from current week (skip current week if empty,
      // start from last week instead so streak isn't broken mid-week)
      let count = 0;
      const cursor = new Date();
      const currentKey = weekKey(cursor);
      if (!weeks.has(currentKey)) {
        // start counting from previous week so a streak isn't reset on Monday
        cursor.setDate(cursor.getDate() - 7);
      }
      while (weeks.has(weekKey(cursor))) {
        count++;
        cursor.setDate(cursor.getDate() - 7);
      }
      setStreak(count);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { streak, loading };
}

function weekKey(d: Date): string {
  // ISO week key: yyyy-Www
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
