import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nearestSite, SAME_SITE_METERS, type OfficialSite } from "@/lib/official-sites";
import { officialName, useOfficialSites, useSiteName } from "@/lib/official-sites-store";

/** While a pilot places a new own site on the map: points out an official site at the same spot. */
export default function OfficialSiteHint({ latitude, longitude, type, onUse }: {
  latitude: number; longitude: number; type: string; onUse: (site: OfficialSite) => void;
}) {
  const { t } = useTranslation();
  const { active } = useOfficialSites();
  const siteName = useSiteName();
  const hit = useMemo(() => {
    if (latitude === 0 && longitude === 0) return null;
    const wanted = type === "takeoff" || type === "landing" ? type : "both";
    return nearestSite(active, latitude, longitude, wanted, SAME_SITE_METERS);
  }, [active, latitude, longitude, type]);
  if (!hit) return null;
  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-2.5 text-xs space-y-2">
      <p className="flex items-start gap-1.5">
        <BadgeCheck className="h-4 w-4 text-primary shrink-0" />
        <span>{t("locations.official.nearby", { name: siteName(officialName(hit.site)), meters: Math.round(hit.meters) })}</span>
      </p>
      <Button type="button" size="sm" className="w-full" onClick={() => onUse(hit.site)}>{t("locations.official.useSite")}</Button>
    </div>
  );
}
