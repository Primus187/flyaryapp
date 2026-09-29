import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface OpenRequest { flightId: string; date: string; durationMinutes: number | null; pilotName: string | null; takeoff: string | null; landing: string | null }

/** Tandem flights where the user was named as passenger and has not confirmed yet (migration 0076). */
export default function PassengerRequestsCard({ locale }: { locale: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["passenger-requests", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_open_passenger_confirmations" as never);
      if (error) throw error;
      return Array.isArray(data) ? (data as unknown as OpenRequest[]) : [];
    },
  });
  const requests = query.data ?? [];
  if (requests.length === 0) return null;

  const confirm = async (flightId: string) => {
    const { error } = await supabase.rpc("confirm_passenger_flight" as never, { _flight_id: flightId } as never);
    if (error) { toast({ title: t("common.error"), description: error.message, variant: "destructive" }); return; }
    toast({ title: t("tandem.publicThanks") });
    await queryClient.invalidateQueries({ queryKey: ["passenger-requests", user?.id] });
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-3 space-y-2">
        <p className="text-sm font-medium flex items-center gap-2"><UserCheck className="h-4 w-4 text-primary" />{t("tandem.requestsTitle")}</p>
        {requests.map((r) => (
          <div key={r.flightId} className="flex items-center justify-between gap-2 text-xs">
            <span>{new Date(`${r.date}T00:00:00`).toLocaleDateString(locale)} · {r.pilotName || "—"} · {r.takeoff || "—"} → {r.landing || "—"}</span>
            <Button size="sm" className="h-7" onClick={() => void confirm(r.flightId)}>{t("tandem.confirmShort")}</Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
