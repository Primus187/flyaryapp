import { supabase } from "@/integrations/supabase/client";
import type { IGCData } from "@/lib/igc-parser";

const MAX_TRACK_POINTS = 2000;

function buildTrackData(igcData: IGCData | null) {
  if (!igcData) return null;

  const sampleStep = Math.max(1, Math.floor(igcData.points.length / MAX_TRACK_POINTS));
  const points = igcData.points
    .filter((_, index) => index % sampleStep === 0)
    .map((point) => ({
      lat: point.lat,
      lng: point.lng,
      altitude: point.altitude || 0,
      time: point.time || "",
    }));

  return {
    points,
    stats: {
      maxAltitude: igcData.maxAltitude,
      minAltitude: igcData.minAltitude,
      maxClimbRate: igcData.maxClimbRate,
      maxSinkRate: igcData.maxSinkRate,
      avgSpeedKmh: igcData.avgSpeedKmh,
      totalDistanceKm: igcData.totalDistanceKm,
      startTime: igcData.startTime,
      endTime: igcData.endTime,
      durationMinutes: igcData.durationMinutes,
    },
  };
}

export async function uploadIgcTrack({
  flightId,
  fileName,
  fileContent,
  igcData,
}: {
  flightId: string;
  fileName: string;
  fileContent: string;
  igcData: IGCData | null;
}) {
  const { data, error } = await supabase.functions.invoke("upload-igc-track", {
    body: {
      flightId,
      fileName,
      content: fileContent,
      trackData: buildTrackData(igcData),
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data as { track?: any; storagePath?: string };
}