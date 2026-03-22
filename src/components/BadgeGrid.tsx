import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BADGES, type BadgeDefinition, type BadgeCategory } from "@/lib/badges";
import HexBadge from "./HexBadge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { format } from "date-fns";

interface BadgeGridProps {
  unlockedBadges: { badge_key: string; unlocked_at: string }[];
  /** Current stats for progress display */
  stats?: {
    flightCount: number;
    totalMinutes: number;
    totalAltitude: number;
    totalDistance: number;
    uniqueTakeoffs: number;
    maxDuration: number;
    maxDistance: number;
    maxAltitude: number;
  };
  compact?: boolean; // show only unlocked, max 6
}

const CATEGORY_ORDER: BadgeCategory[] = ["flights", "time", "altitude", "distance", "sites", "records", "seasonal"];

function getProgressForBadge(badge: BadgeDefinition, stats?: BadgeGridProps["stats"]): string | undefined {
  if (!stats) return undefined;
  let current = 0;
  switch (badge.category) {
    case "flights": current = stats.flightCount; break;
    case "time": current = Math.floor(stats.totalMinutes / 60); break;
    case "altitude": current = stats.totalAltitude; break;
    case "distance": current = Math.round(stats.totalDistance); break;
    case "sites": current = stats.uniqueTakeoffs; break;
    case "records":
      if (badge.key === "thermik_king") current = stats.maxDuration;
      else if (badge.key === "xc_beast") current = Math.round(stats.maxDistance);
      else if (badge.key === "high_flyer") current = stats.maxAltitude;
      break;
  }
  if (current >= badge.threshold) return undefined;
  const displayThreshold = badge.threshold >= 1000 ? `${(badge.threshold/1000).toFixed(0)}k` : String(badge.threshold);
  const displayCurrent = current >= 1000 ? `${(current/1000).toFixed(1)}k` : String(current);
  return `${displayCurrent}/${displayThreshold}`;
}

export default function BadgeGrid({ unlockedBadges, stats, compact }: BadgeGridProps) {
  const { t } = useTranslation();
  const [selectedBadge, setSelectedBadge] = useState<BadgeDefinition | null>(null);
  const unlockedSet = new Set(unlockedBadges.map(b => b.badge_key));
  const getUnlockDate = (key: string) => unlockedBadges.find(b => b.badge_key === key)?.unlocked_at;

  const badgesToShow = compact
    ? BADGES.filter(b => unlockedSet.has(b.key)).slice(0, 6)
    : BADGES;

  const grouped = compact
    ? { all: badgesToShow }
    : CATEGORY_ORDER.reduce((acc, cat) => {
        const items = BADGES.filter(b => b.category === cat);
        if (items.length) acc[cat] = items;
        return acc;
      }, {} as Record<string, BadgeDefinition[]>);

  return (
    <>
      <div className="space-y-4">
        {Object.entries(grouped).map(([cat, badges]) => (
          <div key={cat}>
            {!compact && (
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                {t(`badges.category_${cat}`)}
              </p>
            )}
            <div className={`grid ${compact ? "grid-cols-6" : "grid-cols-4"} gap-1 justify-items-center`}>
              {badges.map(badge => (
                <button
                  key={badge.key}
                  onClick={() => setSelectedBadge(badge)}
                  className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg p-0.5 transition-transform active:scale-95"
                >
                  <HexBadge
                    badge={badge}
                    unlocked={unlockedSet.has(badge.key)}
                    size={compact ? 48 : 64}
                    progress={!unlockedSet.has(badge.key) ? getProgressForBadge(badge, stats) : undefined}
                  />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Sheet open={!!selectedBadge} onOpenChange={() => setSelectedBadge(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          {selectedBadge && (
            <SheetHeader className="text-center space-y-3 pb-4">
              <div className="flex justify-center">
                <HexBadge badge={selectedBadge} unlocked={unlockedSet.has(selectedBadge.key)} size={96} />
              </div>
              <SheetTitle className="text-lg">{t(`badges.${selectedBadge.key}`)}</SheetTitle>
              <p className="text-sm text-muted-foreground">{t(`badges.${selectedBadge.key}_desc`)}</p>
              {unlockedSet.has(selectedBadge.key) ? (
                <p className="text-xs text-primary font-medium">
                  ✓ {t("badges.unlockedOn")} {format(new Date(getUnlockDate(selectedBadge.key)!), "dd.MM.yyyy")}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {getProgressForBadge(selectedBadge, stats) || t("badges.locked")}
                </p>
              )}
            </SheetHeader>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
