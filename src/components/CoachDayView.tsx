import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Plane, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Props {
  eventId: string;
  eventDate: string;
  groupId: string;
}

interface TrainingItemRating {
  item_id: string;
  name: string;
  instructor_rating: number | null;
  instructor_note: string | null;
}

interface StudentFlight {
  id: string;
  user_id: string;
  pilot_name: string;
  duration_minutes: number | null;
  glider: string | null;
  takeoff_name: string | null;
  landing_name: string | null;
  training_items: TrainingItemRating[];
}

export default function CoachDayView({ eventId, eventDate, groupId }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [flights, setFlights] = useState<StudentFlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFlightId, setExpandedFlightId] = useState<string | null>(null);
  const [noteEdits, setNoteEdits] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchFlights = async () => {
      const { data: members } = await supabase.from("group_members").select("user_id").eq("group_id", groupId);
      if (!members || members.length === 0) { setLoading(false); return; }
      const userIds = members.map(m => m.user_id);

      const dateStr = new Date(eventDate).toISOString().split("T")[0];
      const { data: flightsData } = await supabase.from("flights")
        .select("id, user_id, duration_minutes, glider, takeoff_location_id, landing_location_id")
        .in("user_id", userIds)
        .eq("date", dateStr);

      if (!flightsData || flightsData.length === 0) { setLoading(false); return; }

      // Parallel fetches
      const flightIds = flightsData.map(f => f.id);
      const locIds = [...new Set([
        ...flightsData.map(f => f.takeoff_location_id).filter(Boolean),
        ...flightsData.map(f => f.landing_location_id).filter(Boolean),
      ])] as string[];

      const [profilesRes, locsRes, ftiRes] = await Promise.all([
        supabase.from("profiles").select("user_id, pilot_name").in("user_id", userIds),
        locIds.length > 0 ? supabase.from("locations").select("id, name").in("id", locIds) : { data: [] },
        supabase.from("flight_training_items" as any).select("flight_id, item_id, instructor_rating, instructor_note").in("flight_id", flightIds),
      ]);

      const profileMap: Record<string, string> = {};
      profilesRes.data?.forEach(p => { profileMap[p.user_id] = p.pilot_name || "?"; });
      const locMap: Record<string, string> = {};
      (locsRes.data as any[] || []).forEach((l: any) => { locMap[l.id] = l.name; });

      const itemIds = [...new Set((ftiRes.data as any[] || []).map((d: any) => d.item_id))];
      const itemNameMap: Record<string, string> = {};
      if (itemIds.length > 0) {
        const { data: items } = await supabase.from("training_items").select("id, name").in("id", itemIds);
        items?.forEach(i => { itemNameMap[i.id] = i.name; });
      }

      const result: StudentFlight[] = flightsData.map(f => ({
        id: f.id,
        user_id: f.user_id,
        pilot_name: profileMap[f.user_id] || "?",
        duration_minutes: f.duration_minutes,
        glider: f.glider,
        takeoff_name: f.takeoff_location_id ? locMap[f.takeoff_location_id] || null : null,
        landing_name: f.landing_location_id ? locMap[f.landing_location_id] || null : null,
        training_items: (ftiRes.data as any[] || [])
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
  }, [eventId, eventDate, groupId]);

  const handleRate = async (flightId: string, itemId: string, rating: number) => {
    if (!user) return;
    const current = flights.find(f => f.id === flightId)?.training_items.find(ti => ti.item_id === itemId);
    const newRating = current?.instructor_rating === rating ? rating - 1 : rating;

    await supabase.from("flight_training_items" as any)
      .update({ instructor_rating: newRating, instructor_id: user.id } as any)
      .eq("flight_id", flightId)
      .eq("item_id", itemId);

    setFlights(prev => prev.map(f => f.id === flightId ? {
      ...f,
      training_items: f.training_items.map(ti => ti.item_id === itemId ? { ...ti, instructor_rating: newRating } : ti),
    } : f));
  };

  const handleSaveNote = async (flightId: string, itemId: string) => {
    if (!user) return;
    const key = `${flightId}-${itemId}`;
    const note = noteEdits[key] ?? "";

    await supabase.from("flight_training_items" as any)
      .update({ instructor_note: note || null, instructor_id: user.id } as any)
      .eq("flight_id", flightId)
      .eq("item_id", itemId);

    setFlights(prev => prev.map(f => f.id === flightId ? {
      ...f,
      training_items: f.training_items.map(ti => ti.item_id === itemId ? { ...ti, instructor_note: note || null } : ti),
    } : f));

    toast({ title: t("common.saved") });
  };

  if (loading) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (flights.length === 0) return <p className="text-sm text-muted-foreground">{t("events.noStudentFlights")}</p>;

  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {t("events.coachDayView")} ({flights.length})
      </h2>
      {flights.map((flight) => {
        const isExpanded = expandedFlightId === flight.id;
        return (
          <Card key={flight.id} className="border-0 shadow-sm">
            <CardContent className="p-0">
              <button
                className="w-full p-3 flex items-center gap-2 text-left"
                onClick={() => setExpandedFlightId(isExpanded ? null : flight.id)}
              >
                <Plane className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium flex-1">{flight.pilot_name}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {flight.duration_minutes && <span>{flight.duration_minutes} min</span>}
                  {flight.glider && <span>🪂 {flight.glider}</span>}
                </div>
                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 space-y-3">
                  <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
                    {flight.takeoff_name && <span>↗ {flight.takeoff_name}</span>}
                    {flight.landing_name && <span>↘ {flight.landing_name}</span>}
                  </div>

                  {flight.training_items.length > 0 ? (
                    <div className="space-y-3 pt-1 border-t border-border/50">
                      {flight.training_items.map((ti) => {
                        const noteKey = `${flight.id}-${ti.item_id}`;
                        const noteValue = noteEdits[noteKey] ?? ti.instructor_note ?? "";
                        return (
                          <div key={ti.item_id} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium truncate pr-2">{ti.name}</span>
                              <div className="flex gap-0.5 shrink-0">
                                {[1, 2, 3].map((star) => (
                                  <button
                                    key={star}
                                    onClick={() => handleRate(flight.id, ti.item_id, star)}
                                    className="p-1 active:scale-90 transition-transform"
                                  >
                                    <Star className={cn(
                                      "h-5 w-5 transition-colors",
                                      star <= (ti.instructor_rating || 0)
                                        ? "fill-amber-400 text-amber-400"
                                        : "text-muted-foreground/30"
                                    )} />
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Textarea
                                placeholder={t("events.coachNotePlaceholder")}
                                className="text-xs min-h-[2rem] h-8 resize-none"
                                value={noteValue}
                                onChange={(e) => setNoteEdits(prev => ({ ...prev, [noteKey]: e.target.value }))}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="shrink-0 h-8 w-8"
                                onClick={() => handleSaveNote(flight.id, ti.item_id)}
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic pt-1 border-t border-border/50">
                      {t("events.noTrainingItems")}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
