import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Coins } from "lucide-react";

interface Signup {
  id: string;
  user_id: string;
  attended?: boolean;
}

interface Props {
  eventId: string;
  groupId: string;
  eventDate: string;
  signups: Signup[];
}

/** Day booking of launch-leader credits and rental items. Presence comes from the check-in of
 *  the flying day (DayCheckIn); the booking moves into the day closing wizard with 5.1. */
export default function EventAttendance({ eventId, groupId, eventDate, signups }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [booking, setBooking] = useState(false);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [helpers, setHelpers] = useState<string[]>([]);
  const [bookedCredits, setBookedCredits] = useState(0);
  const [bookedItems, setBookedItems] = useState(0);

  const bookingDate = eventDate.slice(0, 10);

  const loadContext = async () => {
    const [ratesRes, staffRes, creditsRes, itemsRes] = await Promise.all([
      supabase.from("school_rates").select("rate_key, amount").eq("group_id", groupId),
      supabase.from("event_staff").select("user_id, role").eq("event_id", eventId),
      supabase.from("launch_leader_credits").select("user_id").eq("event_id", eventId),
      supabase.from("billing_items").select("user_id, item_type").eq("event_id", eventId),
    ]);
    const map: Record<string, number> = {};
    (ratesRes.data || []).forEach((r: any) => { map[r.rate_key] = Number(r.amount) || 0; });
    setRates(map);
    setHelpers(((staffRes.data as any[]) || []).filter((s) => s.role === "launch_helper").map((s) => s.user_id));
    setBookedCredits(((creditsRes.data as any[]) || []).length);
    setBookedItems(((itemsRes.data as any[]) || []).filter((i) => i.item_type === "rental").length);
  };

  useEffect(() => { loadContext(); }, [eventId, groupId]);

  const attending = useMemo(() => signups.filter((s) => (s as any).signed_up !== false), [signups]);
  const attendedIds = useMemo(() => attending.filter((s) => s.attended).map((s) => s.user_id), [attending]);

  const book = async () => {
    if (!user) return;
    setBooking(true);
    const creditRate = rates["launch_leader_per_day"] || 0;
    const rentalRate = rates["rental_per_day"] || 0;
    let credits = 0;
    let items = 0;

    if (helpers.length > 0 && creditRate > 0) {
      const { data: existing } = await supabase
        .from("launch_leader_credits")
        .select("user_id")
        .eq("event_id", eventId);
      const already = new Set(((existing as any[]) || []).map((r) => r.user_id));
      const rows = helpers.filter((id) => !already.has(id)).map((id) => ({
        group_id: groupId, user_id: id, event_id: eventId, entry_type: "earned",
        booking_date: bookingDate, days: 1, amount: creditRate, created_by: user.id,
      }));
      if (rows.length > 0) {
        const { error } = await supabase.from("launch_leader_credits").insert(rows as any);
        if (error) {
          setBooking(false);
          toast({ title: t("common.error"), description: error.message, variant: "destructive" });
          return;
        }
        credits = rows.length;
      }
    }

    if (attendedIds.length > 0 && rentalRate > 0) {
      const { data: existing } = await supabase
        .from("billing_items")
        .select("user_id, item_type")
        .eq("event_id", eventId);
      const already = new Set(
        ((existing as any[]) || []).filter((r) => r.item_type === "rental").map((r) => r.user_id)
      );
      const rows = attendedIds.filter((id) => !already.has(id)).map((id) => ({
        group_id: groupId, user_id: id, event_id: eventId, item_type: "rental",
        description: t("school.attendance.rentalDescription"), quantity: 1,
        unit_amount: rentalRate, amount: rentalRate, billing_date: bookingDate, created_by: user.id,
      }));
      if (rows.length > 0) {
        const { error } = await supabase.from("billing_items").insert(rows as any);
        if (error) {
          setBooking(false);
          toast({ title: t("common.error"), description: error.message, variant: "destructive" });
          return;
        }
        items = rows.length;
      }
    }

    setBooking(false);
    await loadContext();
    if (credits === 0 && items === 0) {
      toast({ title: t("school.attendance.nothingToBook") });
      return;
    }
    toast({ title: t("school.attendance.booked", { credits, items }) });
  };

  if (attending.length === 0) return null;

  return (
    <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold flex-1">{t("school.attendance.bookingTitle")}</p>
          <Badge variant="secondary" className="text-[10px]">
            {t("school.attendance.count", { count: attendedIds.length, total: attending.length })}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground">{t("school.attendance.bookingHint")}</p>

        <Button size="sm" className="w-full gap-1.5" onClick={book} disabled={booking}>
          <Coins className="h-3.5 w-3.5" />
          {t("school.attendance.book")}
        </Button>

        {(bookedCredits > 0 || bookedItems > 0) && (
          <p className="text-[11px] text-muted-foreground text-center">
            {t("school.attendance.alreadyBooked", { credits: bookedCredits, items: bookedItems })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
