import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  getPendingFlights,
  removeOfflineFlight,
  updateOfflineFlightStatus,
  type OfflineFlight,
} from "@/lib/offline-queue";

// Module-level lock: the mount effect, the "online" event and the manual button can fire
// together, and a state flag read from a stale closure let them upload the same flight twice.
let syncInFlight = false;

export function useOfflineSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      const flights = await getPendingFlights();
      setPendingCount(flights.length);
    } catch {
      setPendingCount(0);
    }
  }, []);

  const syncAll = useCallback(async () => {
    if (!user || syncInFlight) return;
    syncInFlight = true;
    let synced = 0;
    try {
    const pending = await getPendingFlights();
    if (pending.length === 0) return;

    setSyncing(true);

    for (const flight of pending) {
      try {
        await updateOfflineFlightStatus(flight.id, "syncing");

        // Insert flight with the queue id as primary key, so a retry after a lost response
        // (insert committed, reply never arrived) cannot create a duplicate flight.
        const { error } = await supabase
          .from("flights")
          .insert({ ...flight.flightData, id: flight.id } as any);
        if (error?.code === "23505") {
          await removeOfflineFlight(flight.id);
          synced++;
          continue;
        }
        if (error) throw error;

        const flightId = flight.id;

        // Insert YouTube videos
        if (flight.youtubeUrls.length > 0) {
          await supabase.from("flight_videos").insert(
            flight.youtubeUrls.map((url) => ({ flight_id: flightId, youtube_url: url }))
          );
        }

        // Insert training items
        if (flight.selectedTrainingIds.length > 0) {
          await supabase.from("flight_training_items" as any).insert(
            flight.selectedTrainingIds.map((item_id) => ({
              flight_id: flightId,
              item_id,
            })) as any
          );
        }

        await removeOfflineFlight(flight.id);
        synced++;
      } catch (err: any) {
        console.error("Offline sync failed for flight:", flight.id, err);
        await updateOfflineFlightStatus(flight.id, "failed", err.message);
      }
    }

    } finally {
      syncInFlight = false;
      setSyncing(false);
      if (synced > 0) void queryClient.invalidateQueries({ queryKey: ["dashboard", user.id] });
      await refreshCount();
    }
    return synced;
  }, [user, refreshCount, queryClient]);

  // Auto-sync when coming online
  useEffect(() => {
    refreshCount();

    const handleOnline = () => {
      if (user) syncAll();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [user, syncAll, refreshCount]);

  // Also try sync on mount if online (keyed on the user id, not the user object, which
  // changes on every token refresh)
  const userId = user?.id;
  useEffect(() => {
    if (navigator.onLine && userId) {
      syncAll();
    }
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps -- run once per signed-in user

  return { pendingCount, syncing, syncAll, refreshCount };
}
