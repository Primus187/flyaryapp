import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Keeps a flying day view live: reloads on changes to the day's school flights and pauses
 * (Realtime, RLS applies), whenever the Realtime channel (re)connects, when the device is back
 * online and when the app returns to the foreground, so a dead spot never leaves a stale list.
 * A new `reload` (e.g. after the day's settings changed) reloads as well.
 * Returns the current time, ticking every 30 s for "in the air" times.
 */
export function useFlightDayLive(eventId: string, reload: () => void | Promise<void>, channelName: string): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const run = () => { setNow(new Date()); void reload(); };
    run();
    const channel = supabase.channel(`${channelName}-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_school_flights", filter: `event_id=eq.${eventId}` }, run)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_day_pauses", filter: `event_id=eq.${eventId}` }, run);
    // The first SUBSCRIBED duplicates the initial load; later ones follow a reconnect.
    let subscribedOnce = false;
    channel.subscribe((status: string) => {
      if (status !== "SUBSCRIBED") return;
      if (subscribedOnce) run();
      subscribedOnce = true;
    });
    const onVisible = () => { if (document.visibilityState === "visible") run(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", run);
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", run);
      void supabase.removeChannel(channel);
    };
  }, [eventId, channelName, reload]);

  return now;
}
