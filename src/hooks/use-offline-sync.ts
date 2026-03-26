import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  getPendingFlights,
  removeOfflineFlight,
  updateOfflineFlightStatus,
  type OfflineFlight,
} from "@/lib/offline-queue";

export function useOfflineSync() {
  const { user } = useAuth();
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
    if (!user || syncing) return;
    const pending = await getPendingFlights();
    if (pending.length === 0) return;

    setSyncing(true);
    let synced = 0;

    for (const flight of pending) {
      try {
        await updateOfflineFlightStatus(flight.id, "syncing");

        // Insert flight
        const { data, error } = await supabase
          .from("flights")
          .insert(flight.flightData as any)
          .select("id")
          .single();
        if (error) throw error;

        const flightId = data.id;

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

    setSyncing(false);
    await refreshCount();
    return synced;
  }, [user, syncing]);

  // Auto-sync when coming online
  useEffect(() => {
    refreshCount();

    const handleOnline = () => {
      if (user) syncAll();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [user, syncAll, refreshCount]);

  // Also try sync on mount if online
  useEffect(() => {
    if (navigator.onLine && user) {
      syncAll();
    }
  }, [user]);

  return { pendingCount, syncing, syncAll, refreshCount };
}
