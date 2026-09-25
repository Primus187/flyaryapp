import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Star, Plane } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface Props {
  eventId: string;
  eventDate: string;
  groupId: string;
  isAdmin: boolean;
}

interface StudentFlight {
  id: string;
  user_id: string;
  pilot_name: string;
  date: string;
  duration_minutes: number | null;
  glider: string | null;
  takeoff_name: string | null;
  landing_name: string | null;
  training_items: { item_id: string; name: string; instructor_rating: number | null; instructor_note: string | null }[];
}

export default function EventStudentFlights({ eventId, eventDate, groupId, isAdmin }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [flights, setFlights] = useState<StudentFlight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    const fetchFlights = async () => {
      // Get group members
      const { data: members } = await supabase.from("group_members").select("user_id").eq("group_id", groupId);
      if (!members || members.length === 0) { setLoading(false); return; }
      const userIds = members.map(m => m.user_id);

      // Get flights on the event date by group members
      // Local calendar day of the event (flights store a local date); toISOString() gave the UTC day.
      const dateStr = format(new Date(eventDate), "yyyy-MM-dd");
      const { data: flightsData } = await supabase.from("flights")
        .select("id, user_id, date, duration_minutes, glider, takeoff_location_id, landing_location_id")
        .in("user_id", userIds)
        .eq("date", dateStr);

      if (!flightsData || flightsData.length === 0) { setLoading(false); return; }

      // Get profiles
      const { data: profiles } = await supabase.from("profiles").select("user_id, pilot_name").in("user_id", userIds);
      const profileMap: Record<string, string> = {};
      profiles?.forEach(p => { profileMap[p.user_id] = p.pilot_name || "?"; });

      // Get location names
      const locIds = [...new Set([
        ...flightsData.map(f => f.takeoff_location_id).filter(Boolean),
        ...flightsData.map(f => f.landing_location_id).filter(Boolean),
      ])] as string[];
      const locMap: Record<string, string> = {};
      if (locIds.length > 0) {
        const { data: locs } = await supabase.from("locations").select("id, name").in("id", locIds);
        locs?.forEach(l => { locMap[l.id] = l.name; });
      }

      // Get training items for these flights
      const flightIds = flightsData.map(f => f.id);
      const { data: ftiData } = await supabase.from("flight_training_items")
        .select("flight_id, item_id, instructor_rating, instructor_note")
        .in("flight_id", flightIds);

      // Get training item names
      const itemIds = [...new Set((ftiData as any[] || []).map((d: any) => d.item_id))];
      const itemNameMap: Record<string, string> = {};
      if (itemIds.length > 0) {
        const { data: items } = await supabase.from("training_items").select("id, name").in("id", itemIds);
        items?.forEach(i => { itemNameMap[i.id] = i.name; });
      }

      const result: StudentFlight[] = flightsData.map(f => ({
        id: f.id,
        user_id: f.user_id,
        pilot_name: profileMap[f.user_id] || "?",
        date: f.date,
        duration_minutes: f.duration_minutes,
        glider: f.glider,
        takeoff_name: f.takeoff_location_id ? locMap[f.takeoff_location_id] || null : null,
        landing_name: f.landing_location_id ? locMap[f.landing_location_id] || null : null,
        training_items: (ftiData as any[] || [])
          .filter((d: any) => d.flight_id === f.id)
          .map((d: any) => ({
            item_id: d.item_id,
            name: itemNameMap[d.item_id] || "?",
            instructor_rating: d.instructor_rating,
            instructor_note: d.instructor_note,
          })),
      }));

      setFlights(result.sort((a, b) => a.pilot_name.localeCompare(b.pilot_name)));
      setLoading(false);
    };
    fetchFlights();
  }, [eventId, eventDate, groupId, isAdmin]);

  const handleRate = async (flightId: string, itemId: string, rating: number) => {
    if (!user) return;
    const current = flights.find(f => f.id === flightId)?.training_items.find(ti => ti.item_id === itemId);
    const newRating = current?.instructor_rating === rating ? rating - 1 : rating;

    await supabase.from("flight_training_items")
      .update({ instructor_rating: newRating, instructor_id: user.id } as any)
      .eq("flight_id", flightId)
      .eq("item_id", itemId);

    setFlights(prev => prev.map(f => f.id === flightId ? {
      ...f,
      training_items: f.training_items.map(ti => ti.item_id === itemId ? { ...ti, instructor_rating: newRating } : ti),
    } : f));
  };

  if (!isAdmin) return null;
  if (loading) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (flights.length === 0) return null;

  return (
    <div>
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        {t("events.studentFlights")} ({flights.length})
      </h2>
      <div className="space-y-2">
        {flights.map((flight) => (
          <Card key={flight.id} className="border-0 shadow-sm">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Plane className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium">{flight.pilot_name}</span>
                {flight.duration_minutes && (
                  <span className="text-xs text-muted-foreground ml-auto">{flight.duration_minutes} min</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
                {flight.takeoff_name && <span>↗ {flight.takeoff_name}</span>}
                {flight.landing_name && <span>↘ {flight.landing_name}</span>}
                {flight.glider && <span>🪂 {flight.glider}</span>}
              </div>
              {flight.training_items.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-border/50">
                  {flight.training_items.map((ti) => (
                    <div key={ti.item_id} className="flex items-center justify-between">
                      <span className="text-xs truncate pr-2">{ti.name}</span>
                      <div className="flex gap-0.5 shrink-0">
                        {[1, 2, 3].map((star) => (
                          <button
                            key={star}
                            onClick={() => handleRate(flight.id, ti.item_id, star)}
                            className="p-0.5 active:scale-90 transition-transform"
                          >
                            <Star className={cn(
                              "h-4 w-4 transition-colors",
                              star <= (ti.instructor_rating || 0)
                                ? "fill-amber-400 text-amber-400"
                                : "text-muted-foreground/30"
                            )} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
