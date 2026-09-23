import { supabase } from "@/integrations/supabase/client";

export const dossierSections = ["overview", "training", "flights", "notes", "equipment", "billing"] as const;
export type DossierSection = typeof dossierSections[number];
export interface Overview {
  name: string | null; level: string | null; shvNumber: string | null;
  theoryDate: string | null; practicalDate: string | null; gliderInfo: string | null;
  flightCount: number; lastFlight: string | null; examTotal: number; examDone: number;
  status: { status: "active" | "paused" | "cancelled"; reason: string | null; date: string | null };
  nextStep: { note: string; eventId: string; date: string } | null;
  upcoming: { id: string; title: string; event_date: string; status: string }[];
}
export interface CoachNote { id: string; note: string; author: string | null; visible: boolean; date: string }
export interface DossierFlight {
  id: string; date: string; glider: string | null; duration_minutes: number | null;
  altitude_gain: number | null; comments: string | null; takeoff: string | null; landing: string | null; notes: CoachNote[];
}
export interface DayNote {
  id: string; note: string; flight_number: number | null; visible: boolean; is_next_step: boolean;
  author: string | null; event_id: string; title: string; event_date: string;
}
export interface TrainingRow {
  id: string; name: string; category: string; training_level: string | null;
  is_exam_maneuver: boolean; rating: number; notes: string | null; updated_at: string | null;
}
export interface Equipment {
  loans: { id: string; assigned_on: string; due_on: string | null; returned_on: string | null;
    note: string | null; name: string; equipment_type: string; inventory_number: string | null; size: string | null; next_check_date: string | null }[];
  own: { id: string; manufacturer: string; model: string; size: string | null; is_default: boolean;
    last_check_date: string | null; next_check_date: string | null; reserve_repack_date: string | null }[];
}
export interface BillingRow {
  id: string; description: string | null; item_type: string; quantity: number; unit_amount: number;
  amount: number; billing_date: string; paid_at: string | null; note: string | null;
}
export interface Page<T> { rows: T[]; total: number }
export interface DossierData {
  overview: Overview;
  training: { rows: TrainingRow[] };
  flights: Page<DossierFlight>;
  notes: Page<DayNote>;
  equipment: Equipment;
  billing: Page<BillingRow> & { open: number; paid: number };
}

export async function fetchDossier<S extends DossierSection>(groupId: string, studentId: string, section: S, offset = 0, signal?: AbortSignal): Promise<DossierData[S]> {
  // POST deliberately avoids the PWA's GET response cache for internal dossiers.
  const { data, error } = await supabase.rpc("school_student_dossier" as never, {
    _group_id: groupId, _student_id: studentId, _section: section, _offset: offset,
  } as never).abortSignal(signal ?? new AbortController().signal);
  if (error) throw error;
  return data as unknown as DossierData[S];
}

export function examPercent(done: number, total: number) {
  return total > 0 ? Math.min(100, Math.round(done / total * 100)) : 0;
}
