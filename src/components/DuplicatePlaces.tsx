import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Combine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSiteName } from "@/lib/official-sites-store";

interface Place { id: string; name: string; official_site_id?: string | null }

/**
 * Own places linked to the same official site, offered for merging. The place with the most flights
 * stays; the others move into it (merge_locations, migration 0067).
 */
export default function DuplicatePlaces({ locations, flightCounts, onMerged }: {
  locations: Place[]; flightCounts: Record<string, number>; onMerged: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const siteName = useSiteName();
  const [busy, setBusy] = useState<string | null>(null);

  const groups = useMemo(() => {
    const bySite = new Map<string, Place[]>();
    for (const l of locations) if (l.official_site_id) bySite.set(l.official_site_id, [...(bySite.get(l.official_site_id) || []), l]);
    return [...bySite.entries()].filter(([, list]) => list.length > 1)
      .map(([site, list]) => ({ site, places: [...list].sort((a, b) => (flightCounts[b.id] || 0) - (flightCounts[a.id] || 0)) }));
  }, [locations, flightCounts]);
  if (groups.length === 0) return null;

  const merge = async (site: string, [keep, ...rest]: Place[]) => {
    setBusy(site);
    for (const place of rest) {
      const { error } = await supabase.rpc("merge_locations", { _keep: keep.id, _remove: place.id });
      if (error) { toast({ title: t("common.error"), description: error.message, variant: "destructive" }); break; }
    }
    setBusy(null);
    toast({ title: t("locations.merge.doneShort", { name: siteName(keep.name) }) });
    onMerged();
  };

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="p-3 space-y-2">
        <p className="text-sm font-medium flex items-center gap-1.5"><Combine className="h-4 w-4 text-primary" />{t("locations.merge.duplicatesTitle")}</p>
        {groups.map(({ site, places }) => (
          <div key={site} className="flex items-center gap-2 rounded-lg bg-background/70 px-2.5 py-2 text-xs">
            <p className="flex-1 min-w-0 truncate">{places.map((p) => siteName(p.name)).join(" · ")}</p>
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={busy === site} onClick={() => { void merge(site, places); }}>
              {t("locations.merge.action")}
            </Button>
          </div>
        ))}
        <p className="text-[11px] text-muted-foreground">{t("locations.merge.duplicatesHint")}</p>
      </CardContent>
    </Card>
  );
}
