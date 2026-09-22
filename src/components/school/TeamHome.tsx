import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export default function TeamHome({ groupId }: { groupId: string }) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const events = useQuery({ queryKey: ["team-events", user?.id, groupId], enabled: !!user && !!groupId, queryFn: async () => {
    const { data, error } = await supabase.from("flight_events").select("id, title, event_date, meeting_point")
      .eq("group_id", groupId).neq("status", "cancelled").gte("event_date", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      .order("event_date").limit(10);
    if (error) throw error;
    return data || [];
  } });
  return <section className="space-y-3">
    <h2 className="font-semibold">{t("journeys.teamTitle")}</h2>
    <p className="text-sm text-muted-foreground">{t("journeys.teamHint")}</p>
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => navigate("/school/availability")}>{t("school.availability.title")}</Button>
      <Button variant="outline" onClick={() => navigate("/school/teamChat")}>{t("school.teamChat.title")}</Button>
    </div>
    <h3 className="font-medium">{t("school.flightDays")}</h3>
    {events.isPending && <p role="status">{t("common.loading")}</p>}
    {events.isError && <div role="alert"><p>{t("performance.loadFailed")}</p><Button onClick={() => void events.refetch()}>{t("performance.retry")}</Button></div>}
    {events.data?.length === 0 && <p>{t("journeys.noUpcoming")}</p>}
    {events.data?.map(event => <button key={event.id} onClick={() => navigate(`/events/${event.id}`)} className="block w-full rounded-xl border p-4 text-left">
      <span className="block font-medium">{event.title}</span>
      <span className="text-sm text-muted-foreground">{new Date(event.event_date).toLocaleString(i18n.language)}{event.meeting_point ? ` · ${event.meeting_point}` : ""}</span>
    </button>)}
  </section>;
}
