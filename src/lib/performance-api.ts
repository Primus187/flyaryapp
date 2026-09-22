import { supabase } from "@/integrations/supabase/client";
import type { StudentStatus } from "@/lib/student-status";

// Migration 0015 RPCs, pending regeneration of the generated Supabase types.
export async function performanceRpc<T>(name: "list_flights_page" | "school_dashboard_data", args: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  // Read-only GET requests retain the existing PWA NetworkFirst offline support.
  // _viewer_id in each call keeps the cache URL specific to the signed-in account.
  let request = supabase.rpc(name as never, args as never, { get: true });
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (error) throw error;
  return data as T;
}

export interface FlightListRow {
  id: string; date: string; glider: string | null; duration_minutes: number | null;
  altitude_gain: number | null; distance_km: number | null; group_id: string | null;
  has_track: boolean; thumbnail: [number, number][];
  takeoff_location: { name: string } | null; landing_location: { name: string } | null;
}
export interface FlightListPage {
  rows: FlightListRow[]; total: number; counts: { all: number; season: number; track: number };
}
export interface SchoolDashboardData {
  isAdmin: boolean;
  studentCount?: number;
  nextEvent?: { id: string; title: string; event_date: string } | null;
  openNotesCount?: number;
  openBilling?: number;
  licensedCount?: number;
  nextSignups?: number;
  students?: {
    userId: string; pilotName: string; trainingLevel: string | null; flightCount: number;
    examProgress: number; lastSummary: string | null; nextStep: string | null;
    status: StudentStatus; statusReason: string | null; statusUpdatedAt: string | null;
  }[];
  events?: { id: string; title: string; event_date: string; status: string; participantCount: number; notesCount: number }[];
}
