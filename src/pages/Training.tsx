import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Star, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

interface TrainingItem {
  id: string;
  category_id: string;
  name: string;
  sort_order: number;
  is_exam_maneuver: boolean;
}

interface Progress {
  item_id: string;
  rating: number;
}

export default function Training() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<TrainingItem[]>([]);
  const [progress, setProgress] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("training_categories").select("*").order("sort_order"),
      supabase.from("training_items").select("*").order("sort_order"),
      supabase.from("training_progress").select("item_id, rating").eq("user_id", user.id),
    ]).then(([catRes, itemRes, progRes]) => {
      if (catRes.data) setCategories(catRes.data);
      if (itemRes.data) setItems(itemRes.data);
      if (progRes.data) {
        const map = new Map<string, number>();
        progRes.data.forEach((p) => map.set(p.item_id, p.rating));
        setProgress(map);
      }
      setLoading(false);
    });
  }, [user]);

  const handleRate = async (e: React.MouseEvent, itemId: string, rating: number) => {
    e.stopPropagation();
    if (!user) return;
    const currentRating = progress.get(itemId) || 0;
    const newRating = currentRating === rating ? rating - 1 : rating;
    
    setProgress((prev) => {
      const next = new Map(prev);
      next.set(itemId, newRating);
      return next;
    });

    await supabase.from("training_progress").upsert(
      { user_id: user.id, item_id: itemId, rating: newRating, updated_at: new Date().toISOString() },
      { onConflict: "user_id,item_id" }
    );
  };

  const categoryProgress = (catId: string) => {
    const catItems = items.filter((i) => i.category_id === catId);
    if (catItems.length === 0) return 0;
    const total = catItems.reduce((sum, i) => sum + (progress.get(i.id) || 0), 0);
    return Math.round((total / (catItems.length * 3)) * 100);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-24 max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-bold">{t("training.title")}</h1>

      <Accordion type="multiple" className="space-y-2">
        {categories.map((cat) => {
          const pct = categoryProgress(cat.id);
          return (
            <AccordionItem key={cat.id} value={cat.id} className={cn("border rounded-xl bg-card overflow-hidden", cat.name === "SHV-Prüfungsmanöver" && "border-amber-500/50 bg-amber-500/5")}>
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {cat.name === "SHV-Prüfungsmanöver" && <Shield className="h-4 w-4 text-amber-500 shrink-0" />}
                  <span className="font-semibold text-sm truncate">{cat.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground shrink-0">{pct}%</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-0 pb-0">
                <div className="divide-y divide-border/50">
                  {items
                    .filter((i) => i.category_id === cat.id)
                    .map((item) => {
                      const rating = progress.get(item.id) || 0;
                      return (
                        <button
                          key={item.id}
                          onClick={() => navigate(`/training/${item.id}`)}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                        >
                          <span className="text-sm truncate pr-2">{item.name}</span>
                          <div className="flex gap-0.5 shrink-0">
                            {[1, 2, 3].map((star) => (
                              <button
                                key={star}
                                onClick={(e) => handleRate(e, item.id, star)}
                                className="p-0.5 active:scale-90 transition-transform"
                              >
                                <Star
                                  className={cn(
                                    "h-5 w-5 transition-colors",
                                    star <= rating
                                      ? "fill-amber-400 text-amber-400"
                                      : "text-muted-foreground/30"
                                  )}
                                />
                              </button>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
