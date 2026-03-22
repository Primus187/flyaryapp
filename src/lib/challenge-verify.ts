import type { IGCPoint } from "./igc-parser";

export interface ChallengeGoalWithCoords {
  id: string;
  challenge_id: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  goal_type: string;
}

/**
 * Haversine distance in meters between two lat/lng points
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check which challenge goals are reached by the IGC track.
 * Returns array of goal IDs that the track passes through.
 */
export function verifyChallengeGoals(
  igcPoints: IGCPoint[],
  goals: ChallengeGoalWithCoords[]
): string[] {
  const reachedGoalIds: string[] = [];

  for (const goal of goals) {
    if (!goal.latitude || !goal.longitude) continue;

    for (const point of igcPoints) {
      const dist = haversineDistance(point.lat, point.lng, goal.latitude, goal.longitude);
      if (dist <= goal.radius_meters) {
        reachedGoalIds.push(goal.id);
        break;
      }
    }
  }

  return reachedGoalIds;
}
