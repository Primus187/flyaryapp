import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { pilotStatus, type HeldLicence, type PilotStatus } from "@/lib/pilot-status";

export interface OwnPilotStatus {
  status: PilotStatus | null;
  /** Student of a flight school: the school sets the stage (migration 0080). */
  schoolStudent: boolean;
  loading: boolean;
  refetch: () => Promise<void>;
}

/** The own Ausbildungsstand: student or pilot, stage, licences and the licence worked towards. */
export function usePilotStatus(): OwnPilotStatus {
  const { user } = useAuth();
  const [status, setStatus] = useState<PilotStatus | null>(null);
  const [schoolStudent, setSchoolStudent] = useState(false);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) return;
    const [profile, licences, bySchool] = await Promise.all([
      supabase.from("profiles").select("training_level, licence_goal").eq("user_id", user.id).maybeSingle(),
      supabase.from("pilot_licences").select("discipline, level, issued_at").eq("user_id", user.id).order("issued_at"),
      supabase.rpc("my_level_set_by_school"),
    ]);
    setLoading(false);
    if (profile.error) return;
    const isSchoolStudent = bySchool.data === true;
    setSchoolStudent(isSchoolStudent);
    setStatus(pilotStatus({
      trainingLevel: profile.data?.training_level,
      goal: profile.data?.licence_goal,
      licences: (licences.data ?? []) as HeldLicence[],
      schoolStudent: isSchoolStudent,
    }));
  }, [user]);

  useEffect(() => { void refetch(); }, [refetch]);

  return { status, schoolStudent, loading, refetch };
}

/**
 * The Ausbildungsstand of any person the viewer may see: oneself, or a student for the school staff
 * (licences are readable for both, migration 0075). Without a level the person counts as a student.
 */
export function usePersonPilotStatus(userId: string | undefined) {
  return useQuery({
    queryKey: ["pilot-status", userId],
    enabled: !!userId,
    // Like the dossier: not kept after leaving the page.
    staleTime: 0, gcTime: 0,
    queryFn: async () => {
      const [profile, licences] = await Promise.all([
        supabase.from("profiles").select("training_level, licence_goal").eq("user_id", userId!).maybeSingle(),
        supabase.from("pilot_licences").select("discipline, level, issued_at").eq("user_id", userId!).order("issued_at"),
      ]);
      if (profile.error) throw profile.error;
      return pilotStatus({ trainingLevel: profile.data?.training_level, goal: profile.data?.licence_goal, licences: (licences.data ?? []) as HeldLicence[], schoolStudent: true });
    },
  });
}
