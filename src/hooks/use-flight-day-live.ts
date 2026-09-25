import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Keeps a flying day view live: reloads on changes to the day's school flights and pauses
 * (Realtime, RLS applies) and when the app comes back to the foreground, so a missed message
 * never leaves a stale list. Returns the current time, ticking every 30 s for "in the air" times.
 */
export function useFlightDayLive(eventId: string, reload: () => void | Promise<void>, channelName: string): Date {
  const [now, setNow] = useState(() => new Date());
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    const run = () => { void reloadRef.current(); };
    run();
    const channel = supabase.channel(`${channelName}-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_school_flights", filter: `event_id=eq.${eventId}` }, run)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_day_pauses", filter: `event_id=eq.${eventId}` }, run)
      .subscribe();
    const onVisible = () => { if (document.visibilityState === "visible") { setNow(new Date()); run(); } };
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); void supabase.removeChannel(channel); };
  }, [eventId, channelName]);

  return now;
}
