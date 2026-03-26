import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Star, Target, BookOpen, AlertTriangle, ShieldAlert, Shield, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Item {
  id: string;
  name: string;
  goal: string | null;
  content: string | null;
  mistakes: string | null;
  danger: string | null;
  is_exam_maneuver: boolean;
}

export default function TrainingItemDetail() {
  const { itemId } = useParams<{ itemId: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [item, setItem] = useState<Item | null>(null);
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!itemId || !user) return;
    Promise.all([
      supabase.from("training_items").select("id, name, goal, content, mistakes, danger, is_exam_maneuver").eq("id", itemId).single(),
      supabase.from("training_progress").select("rating, notes").eq("user_id", user.id).eq("item_id", itemId).maybeSingle(),
    ]).then(([itemRes, progRes]) => {
      if (itemRes.data) setItem(itemRes.data);
      if (progRes.data) {
        setRating(progRes.data.rating || 0);
        setNotes(progRes.data.notes || "");
      }
      setLoading(false);
    });
  }, [itemId, user]);

  const handleRate = async (star: number) => {
    if (!user || !itemId) return;
    const newRating = rating === star ? star - 1 : star;
    setRating(newRating);
    await supabase.from("training_progress").upsert(
      { user_id: user.id, item_id: itemId, rating: newRating, notes, updated_at: new Date().toISOString() },
      { onConflict: "user_id,item_id" }
    );
  };

  const handleNotesBlur = async () => {
    if (!user || !itemId) return;
    await supabase.from("training_progress").upsert(
      { user_id: user.id, item_id: itemId, rating, notes, updated_at: new Date().toISOString() },
      { onConflict: "user_id,item_id" }
    );
  };

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">{t("common.loading")}</div>;
  }

  if (!item) {
    return (
      <div className="px-4 pt-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/training")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> {t("common.back")}
        </Button>
        <p className="mt-4 text-muted-foreground">{t("common.error")}</p>
      </div>
    );
  }

  const sections = [
    { icon: Target, label: t("training.goal"), text: item.goal, color: "text-emerald-500" },
    { icon: BookOpen, label: t("training.content"), text: item.content, color: "text-blue-500" },
    { icon: AlertTriangle, label: t("training.mistakes"), text: item.mistakes, color: "text-amber-500" },
    { icon: ShieldAlert, label: t("training.danger"), text: item.danger, color: "text-red-500" },
  ];

  return (
    <div className="px-4 pt-6 pb-24 max-w-lg mx-auto space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate("/training")} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> {t("common.back")}
      </Button>

      <div>
        <h1 className="text-xl font-bold">{item.name}</h1>
        {item.is_exam_maneuver && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <Shield className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-amber-600 font-medium">{t("training.shvExamManeuver")}</span>
          </div>
        )}
        <div className="flex gap-1 mt-3">
          {[1, 2, 3].map((star) => (
            <button key={star} onClick={() => handleRate(star)} className="p-0.5 active:scale-90 transition-transform">
              <Star
                className={cn(
                  "h-7 w-7 transition-colors",
                  star <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                )}
              />
            </button>
          ))}
        </div>
      </div>

      {sections.map(({ icon: Icon, label, text, color }) =>
        text ? (
          <div key={label} className="bg-card rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Icon className={cn("h-4 w-4", color)} />
              <h2 className="font-semibold text-sm">{label}</h2>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              {text.split("\n").map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        ) : null
      )}

      <div className="bg-card rounded-xl p-4 space-y-2">
        <h2 className="font-semibold text-sm">{t("training.notes")}</h2>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          placeholder={t("training.notesPlaceholder")}
          className="min-h-[80px] text-sm"
        />
      </div>
    </div>
  );
}
