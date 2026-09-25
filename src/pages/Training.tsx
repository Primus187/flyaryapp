import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Star, Shield, ExternalLink, FileText, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { isCategoryLocked, prerequisiteName } from "@/lib/training-categories";
import { trainingFilter, matchesTrainingFilter } from "@/lib/training-level";
import { useToast } from "@/hooks/use-toast";

interface Category {
  id: string;
  name: string;
  sort_order: number;
  training_level: string | null;
  unlocks_after_category_id: string | null;
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

const LEVELS = ["grundkurs", "brevetkurs", "siku", "all"] as const;
type Level = typeof LEVELS[number];

export default function Training() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [savingItem, setSavingItem] = useState<string | null>(null);
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<TrainingItem[]>([]);
  const [progress, setProgress] = useState<Map<string, number>>(new Map());
  // Latest released rating of the instructors per maneuver (Flugtag-Cockpit 6.3); never overwrites the own stars.
  const [instructorRatings, setInstructorRatings] = useState<Record<string, { rating: 1 | 2 | 3; date: string }>>({});
  const [loading, setLoading] = useState(true);
  const [activeLevel, setActiveLevel] = useState<Level>("all");
  const [userLevel, setUserLevel] = useState<string>("grundkurs");

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("training_categories").select("*").order("sort_order"),
      supabase.from("training_items").select("*").order("sort_order"),
      supabase.from("training_progress").select("item_id, rating").eq("user_id", user.id),
      supabase.from("profiles").select("training_level").eq("user_id", user.id).single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration 0059 not in generated types.ts yet
      (supabase as any).rpc("my_instructor_ratings"),
    ]).then(([catRes, itemRes, progRes, profileRes, ratingsRes]) => {
      if (ratingsRes?.data && typeof ratingsRes.data === "object") setInstructorRatings(ratingsRes.data);
      if (catRes.data) setCategories(catRes.data as any);
      if (itemRes.data) setItems(itemRes.data);
      if (progRes.data) {
        const map = new Map<string, number>();
        progRes.data.forEach((p) => map.set(p.item_id, p.rating));
        setProgress(map);
      }
      if (profileRes.data) {
        const lvl = (profileRes.data as any).training_level || "grundkurs";
        setUserLevel(lvl);
        setActiveLevel(trainingFilter(lvl));
      }
      setLoading(false);
    });
  }, [user]);

  const handleRate = async (e: React.MouseEvent, itemId: string, rating: number) => {
    e.stopPropagation();
    if (!user || savingItem) return;
    const currentRating = progress.get(itemId) || 0;
    const newRating = currentRating === rating ? rating - 1 : rating;
    setSavingItem(itemId);
    const { error } = await supabase.from("training_progress").upsert(
      { user_id: user.id, item_id: itemId, rating: newRating, updated_at: new Date().toISOString() },
      { onConflict: "user_id,item_id" }
    );
    setSavingItem(null);
    if (error) { toast({ title: t("journeys.saveFailed"), variant: "destructive" }); return; }
    setProgress((prev) => { const next = new Map(prev); next.set(itemId, newRating); return next; });
  };

  const categoryProgress = (catId: string) => {
    const catItems = items.filter((i) => i.category_id === catId);
    if (catItems.length === 0) return 0;
    const total = catItems.reduce((sum, i) => sum + (progress.get(i.id) || 0), 0);
    return Math.round((total / (catItems.length * 3)) * 100);
  };

  const progressByCategory = Object.fromEntries(categories.map((c) => [c.id, categoryProgress(c.id)]));

  const filteredCategories = activeLevel === "all"
    ? categories
    : categories.filter((c) => matchesTrainingFilter(c.training_level, activeLevel));

  const levelLabels: Record<Level, string> = {
    grundkurs: t("training.grundkurs"),
    brevetkurs: t("training.brevetkurs"),
    siku: t("training.siku"),
    all: t("common.all"),
  };

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">{t("common.loading")}</div>;
  }

  return (
    <PageContainer className="pb-24">
      <PageHeader title={t("training.title")} />

      {/* Level filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => setActiveLevel(level)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
              activeLevel === level
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {levelLabels[level]}
          </button>
        ))}
      </div>

      {/* SHV Resources Card */}
      <div className="border rounded-xl bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-amber-500" />
          <h2 className="font-semibold text-sm">{t("training.shvResources")}</h2>
        </div>
        <p className="text-xs text-muted-foreground">{t("training.shvResourcesDescription")}</p>
        <div className="flex flex-col gap-2">
          <a href="https://www.shv-fsvl.ch/fileadmin/files/redakteure/Allgemein/Ausbildung/Weisungen/Gleitschirm_Pilot_Juli2025_DE.pdf" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline">
            <FileText className="h-3.5 w-3.5 shrink-0" />{t("training.shvExamRegulations")}<ExternalLink className="h-3 w-3 shrink-0 ml-auto" />
          </a>
          <a href="https://www.shv-fsvl.ch/ausbildung/pruefungen/gleitschirm/gs-pilot/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline">
            <FileText className="h-3.5 w-3.5 shrink-0" />{t("training.shvTrainingPortal")}<ExternalLink className="h-3 w-3 shrink-0 ml-auto" />
          </a>
          <a href="https://www.shv-fsvl.ch/fileadmin/files/redakteure/Allgemein/Ausbildung/Pruefungen/GS_Checklisten/Checkliste_Pilot_GS_DE.pdf" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline">
            <FileText className="h-3.5 w-3.5 shrink-0" />{t("training.shvExamChecklist")}<ExternalLink className="h-3 w-3 shrink-0 ml-auto" />
          </a>
          <a href="https://www.shv-fsvl.ch/ausbildung/e-learning/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline">
            <FileText className="h-3.5 w-3.5 shrink-0" />{t("training.shvElearning")}<ExternalLink className="h-3 w-3 shrink-0 ml-auto" />
          </a>
        </div>
      </div>

      <Accordion type="multiple" className="space-y-2">
        {filteredCategories.map((cat) => {
          const pct = categoryProgress(cat.id);
          const locked = isCategoryLocked(cat, progressByCategory);
          return (
            <AccordionItem key={cat.id} value={cat.id} className={cn("border rounded-xl bg-card overflow-hidden", cat.name === "SHV-Prüfungsmanöver" && "border-amber-500/50 bg-amber-500/5")}>
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {cat.name === "SHV-Prüfungsmanöver" && <Shield className="h-4 w-4 text-amber-500 shrink-0" />}
                  <span className="font-semibold text-sm truncate">{cat.name}</span>
                  {cat.training_level && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">{levelLabels[cat.training_level as Level] || cat.training_level}</Badge>
                  )}
                  {locked && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 gap-1 border-muted-foreground/40 text-muted-foreground">
                      <Lock className="h-2.5 w-2.5" />
                      {t("training.locked", { category: prerequisiteName(cat, categories) })}
                    </Badge>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground shrink-0">{pct}%</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-0 pb-0">
                {/* Progress bar */}
                <div className="mx-4 mb-2 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
                </div>
                <div className="divide-y divide-border/50">
                  {items.filter((i) => i.category_id === cat.id).map((item) => {
                    const rating = progress.get(item.id) || 0;
                    return (
                      <div key={item.id} className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left">
                        <button type="button" onClick={() => navigate(`/training/${item.id}`)} className="text-sm min-w-0 flex-1 text-left pr-2">
                          <span className="flex items-center gap-1.5">
                            {item.name}
                            {item.is_exam_maneuver && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-600 shrink-0">SHV</Badge>}
                          </span>
                          {instructorRatings[item.id] && (
                            <span className="block text-[11px] text-muted-foreground">
                              {t("training.instructorRating", {
                                rating: t(`flightDay.sheet.ratings.${instructorRatings[item.id].rating}`),
                                date: new Date(`${instructorRatings[item.id].date}T12:00:00`).toLocaleDateString(i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH", { day: "numeric", month: "numeric" }),
                              })}
                            </span>
                          )}
                        </button>
                        <div className="flex gap-0.5 shrink-0">
                          {[1, 2, 3].map((star) => (
                            <button key={star} type="button" disabled={savingItem !== null} aria-label={t("journeys.rate", { name: item.name, count: star })} aria-pressed={star <= rating} onClick={(e) => handleRate(e, item.id, star)} className="p-1.5 disabled:opacity-50 active:scale-90 transition-transform">
                              <Star className={cn("h-5 w-5 transition-colors", star <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </PageContainer>
  );
}
