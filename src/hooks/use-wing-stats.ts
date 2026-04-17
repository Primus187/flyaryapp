import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface WingStat {
  id: string;
  manufacturer: string;
  model: string;
  size: string | null;
  is_default: boolean;
  next_check_date: string | null;
  reserve_repack_date: string | null;
  flightCount: number;
  totalMinutes: number;
}

/**
 * Aggregates per-glider flight count and total minutes by matching the free-text
 * `glider` column on flights with the registered "{manufacturer} {model}" of each
 * pilot_gliders entry. Case-insensitive substring match (most users type the model
 * or pick from FlightForm's prefilled list which uses the same string).
 */
export function useWingStats(userId: string | undefined) {
  const [stats, setStats] = useState<WingStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [glidersRes, flightsRes] = await Promise.all([
        supabase
          .from("pilot_gliders")
          .select("id, manufacturer, model, size, is_default, next_check_date, reserve_repack_date")
          .eq("user_id", userId)
          .order("is_default", { ascending: false }),
        supabase.from("flights").select("glider, duration_minutes").eq("user_id", userId),
      ]);
      if (cancelled) return;
      const gliders = (glidersRes.data || []) as any[];
      const flights = (flightsRes.data || []) as any[];

      const result: WingStat[] = gliders.map((g) => {
        const name = `${g.manufacturer} ${g.model}`.trim().toLowerCase();
        let count = 0;
        let minutes = 0;
        for (const f of flights) {
          const fg = (f.glider || "").toLowerCase();
          if (fg && (fg === name || fg.includes(g.model.toLowerCase()))) {
            count++;
            minutes += Number(f.duration_minutes || 0);
          }
        }
        return {
          id: g.id,
          manufacturer: g.manufacturer,
          model: g.model,
          size: g.size,
          is_default: g.is_default,
          next_check_date: g.next_check_date,
          reserve_repack_date: g.reserve_repack_date,
          flightCount: count,
          totalMinutes: minutes,
        };
      });
      setStats(result);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { stats, loading };
}
