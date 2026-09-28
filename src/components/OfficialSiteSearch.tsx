import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BadgeCheck, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchSites, type OfficialSite } from "@/lib/official-sites";
import { officialName, siteDetails, useOfficialSites, useSiteName } from "@/lib/official-sites-store";

/** Search field over the catalogue of official sites; renders nothing while the catalogue is empty. */
export default function OfficialSiteSearch({ onPick, disabled }: { onPick: (site: OfficialSite) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  const { active } = useOfficialSites();
  const siteName = useSiteName();
  const [query, setQuery] = useState("");
  const hits = useMemo(() => searchSites(active, query, "both", 15), [active, query]);
  if (active.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("locations.official.searchPlaceholder")} />
      </div>
      {hits.length > 0 && (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-border divide-y divide-border">
          {hits.map((site) => (
            <button key={site.id} type="button" disabled={disabled} onClick={() => onPick(site)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/50 disabled:opacity-50">
              <BadgeCheck className="h-4 w-4 text-primary shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block truncate">{siteName(officialName(site))}</span>
                <span className="block text-[11px] text-muted-foreground truncate">
                  {t(site.type === "takeoff" ? "locations.takeoff" : site.type === "landing" ? "locations.landingPlace" : "locations.both")}
                  {siteDetails(site) ? ` · ${siteDetails(site)}` : ""}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">{t("locations.official.source")}</p>
    </div>
  );
}
