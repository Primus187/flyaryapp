import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BadgeCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { suggestSiteLinks, type OwnLocation } from "@/lib/official-sites";
import { useOfficialSites, useSiteName } from "@/lib/official-sites-store";

const DISMISSED_KEY = "flyary.siteLinks.dismissed";
const readDismissed = (): string[] => { try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]"); } catch { return []; } };

/**
 * Own places that lie on an official site: offer to link them, which gives them the official name
 * (and keeps every flight on them). Declined suggestions are remembered on this device.
 */
export default function SiteLinkSuggestions({ locations, onLinked }: { locations: OwnLocation[]; onLinked: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { active } = useOfficialSites();
  const siteName = useSiteName();
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const [busy, setBusy] = useState(false);
  const suggestions = useMemo(
    () => suggestSiteLinks(locations, active).filter((s) => !dismissed.includes(`${s.location.id}:${s.site.id}`)),
    [locations, active, dismissed],
  );
  if (suggestions.length === 0) return null;

  const link = async (items: typeof suggestions) => {
    setBusy(true);
    let failed = 0;
    for (const { location, site } of items) {
      const { error } = await supabase.from("locations").update({ official_site_id: site.id }).eq("id", location.id);
      if (error) failed++;
    }
    setBusy(false);
    if (failed) toast({ title: t("common.error"), description: t("locations.official.linkFailed", { count: failed }), variant: "destructive" });
    else toast({ title: t("locations.official.linked", { count: items.length }) });
    onLinked();
  };
  const dismiss = (key: string) => {
    const next = [...dismissed, key];
    setDismissed(next);
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(next)); } catch { /* per device only */ }
  };

  return (
    <Card className="border-primary/40 bg-primary/5 shadow-sm">
      <CardContent className="p-3 space-y-2.5">
        <div className="flex items-start gap-2">
          <BadgeCheck className="h-5 w-5 text-primary shrink-0" />
          <div className="text-sm">
            <p className="font-medium">{t("locations.official.suggestTitle", { count: suggestions.length })}</p>
            <p className="text-xs text-muted-foreground">{t("locations.official.suggestHint")}</p>
          </div>
        </div>
        <div className="space-y-1.5">
          {suggestions.map((s) => {
            const key = `${s.location.id}:${s.site.id}`;
            return (
              <div key={key} className="flex items-center gap-2 rounded-lg bg-background/70 px-2.5 py-2 text-xs">
                <div className="flex-1 min-w-0">
                  <p className="truncate"><span className="text-muted-foreground">{s.location.name}</span> → <span className="font-medium">{siteName(s.site.name_de)}</span></p>
                  <p className="text-[11px] text-muted-foreground">{t("locations.official.distance", { meters: s.meters })}</p>
                </div>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={busy} onClick={() => link([s])}>{t("locations.official.link")}</Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={busy} onClick={() => dismiss(key)} aria-label={t("locations.official.dismiss")}><X className="h-3.5 w-3.5" /></Button>
              </div>
            );
          })}
        </div>
        {suggestions.length > 1 && (
          <Button size="sm" className="w-full" disabled={busy} onClick={() => link(suggestions)}>{t("locations.official.linkAll", { count: suggestions.length })}</Button>
        )}
      </CardContent>
    </Card>
  );
}
