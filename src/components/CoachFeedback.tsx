import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface TrainingItemFeedback {
  flight_id: string;
  item_id: string;
  item_name: string;
  instructor_rating: number | null;
  instructor_note: string | null;
  instructor_id: string | null;
  instructor_name?: string;
}

interface CoachFeedbackProps {
  flightId: string;
  flightUserId: string;
  groupId: string | null;
}

export default function CoachFeedback({ flightId, flightUserId, groupId }: CoachFeedbackProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [items, setItems] = useState<TrainingItemFeedback[]>([]);
  const [isCoach, setIsCoach] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !flightId || !groupId) { setLoading(false); return; }

    const load = async () => {
      // Check if current user is group admin (coach)
      const { data: membership } = await supabase
        .from("group_members")
        .select("role")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .maybeSingle();

      const isAdmin = membership?.role === "admin";
      setIsCoach(isAdmin && user.id !== flightUserId);

      // Load training items with feedback
      const { data: trainingData } = await supabase
        .from("flight_training_items")
        .select("flight_id, item_id, instructor_rating, instructor_note, instructor_id, training_items(name)")
        .eq("flight_id", flightId);

      if (trainingData && (trainingData as any[]).length > 0) {
        const mapped: TrainingItemFeedback[] = (trainingData as any[]).map((d: any) => ({
          flight_id: d.flight_id,
          item_id: d.item_id,
          item_name: d.training_items?.name || "",
          instructor_rating: d.instructor_rating,
          instructor_note: d.instructor_note,
          instructor_id: d.instructor_id,
        }));

        // Load instructor names
        const instructorIds = [...new Set(mapped.filter(m => m.instructor_id).map(m => m.instructor_id!))];
        if (instructorIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, pilot_name")
            .in("user_id", instructorIds);
          if (profiles) {
            const nameMap = Object.fromEntries(profiles.map(p => [p.user_id, p.pilot_name]));
            mapped.forEach(m => {
              if (m.instructor_id) m.instructor_name = nameMap[m.instructor_id] || undefined;
            });
          }
        }

        setItems(mapped);
      }
      setLoading(false);
    };
    load();
  }, [user, flightId, groupId, flightUserId]);

  const handleSaveFeedback = async (itemId: string, rating: number, note: string) => {
    if (!user) return;
    await supabase
      .from("flight_training_items")
      .update({
        instructor_rating: rating || null,
        instructor_note: note || null,
        instructor_id: user.id,
      } as any)
      .eq("flight_id", flightId)
      .eq("item_id", itemId);

    setItems(prev => prev.map(i => i.item_id === itemId ? {
      ...i,
      instructor_rating: rating || null,
      instructor_note: note || null,
      instructor_id: user.id,
      instructor_name: undefined, // will show on reload
    } : i));
    setEditing(null);
    toast({ title: t("coach.feedbackSaved") });
  };

  const hasFeedback = items.some(i => i.instructor_rating || i.instructor_note);
  if (loading || items.length === 0) return null;
  if (!isCoach && !hasFeedback) return null;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-primary" />
          {t("coach.instructorFeedback")}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {items.map((item) => (
          <FeedbackItem
            key={item.item_id}
            item={item}
            isCoach={isCoach}
            isEditing={editing === item.item_id}
            onEdit={() => setEditing(item.item_id)}
            onCancel={() => setEditing(null)}
            onSave={handleSaveFeedback}
            t={t}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function FeedbackItem({
  item, isCoach, isEditing, onEdit, onCancel, onSave, t
}: {
  item: TrainingItemFeedback;
  isCoach: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (itemId: string, rating: number, note: string) => void;
  t: any;
}) {
  const [rating, setRating] = useState(item.instructor_rating || 0);
  const [note, setNote] = useState(item.instructor_note || "");

  useEffect(() => {
    setRating(item.instructor_rating || 0);
    setNote(item.instructor_note || "");
  }, [item, isEditing]);

  const hasFeedback = item.instructor_rating || item.instructor_note;

  return (
    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{item.item_name}</span>
        {isCoach && !isEditing && (
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onEdit}>
            {hasFeedback ? t("common.edit") : t("coach.addFeedback")}
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} type="button" onClick={() => setRating(rating === star ? 0 : star)} className="p-0.5">
                <Star className={cn("h-5 w-5 transition-colors", star <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
              </button>
            ))}
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("coach.notePlaceholder")}
            className="min-h-[60px] text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={() => onSave(item.item_id, rating, note)}>{t("common.save")}</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>{t("common.cancel")}</Button>
          </div>
        </div>
      ) : hasFeedback ? (
        <div className="space-y-1">
          {item.instructor_rating && (
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className={cn("h-4 w-4", star <= (item.instructor_rating || 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20")} />
              ))}
            </div>
          )}
          {item.instructor_note && <p className="text-xs text-muted-foreground">{item.instructor_note}</p>}
          {item.instructor_name && <p className="text-[10px] text-muted-foreground/60">— {item.instructor_name}</p>}
        </div>
      ) : null}
    </div>
  );
}
