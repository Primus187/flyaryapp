import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BadgeCheck, Combine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSiteName } from "@/lib/official-sites-store";

interface Place { id: string; name: string; type: string; official_site_id: string | null }

/**
 * Merges the open place into another own place: flights, templates, flight days and challenges move
 * over, then this place is deleted (merge_locations, migration 0067).
 */
export default function MergeLocationDialog({ location, open, onOpenChange, onMerged }: {
  location: Place; open: boolean; onOpenChange: (open: boolean) => void; onMerged: (keptId: string) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const siteName = useSiteName();
  const [places, setPlaces] = useState<Place[]>([]);
  const [target, setTarget] = useState<Place | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setTarget(null);
    supabase.from("locations").select("id, name, type, official_site_id").eq("user_id", user.id).neq("id", location.id).order("name")
      .then(({ data }) => setPlaces((data || []) as Place[]));
  }, [open, user, location.id]);

  // Places at the same official site first: that is what "the same place twice" usually means.
  const sorted = useMemo(() => [...places].sort((a, b) =>
    Number(b.official_site_id === location.official_site_id && !!b.official_site_id) - Number(a.official_site_id === location.official_site_id && !!a.official_site_id)),
  [places, location.official_site_id]);

  const merge = async () => {
    if (!target) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("merge_locations", { _keep: target.id, _remove: location.id });
    setBusy(false);
    if (error) { toast({ title: t("common.error"), description: error.message, variant: "destructive" }); return; }
    toast({ title: t("locations.merge.done", { name: siteName(target.name), count: data ?? 0 }) });
    onOpenChange(false);
    onMerged(target.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("locations.merge.title")}</DialogTitle>
          <DialogDescription>{t("locations.merge.hint", { name: siteName(location.name) })}</DialogDescription>
        </DialogHeader>
        {!target ? (
          <div className="max-h-72 overflow-y-auto rounded-lg border border-border divide-y divide-border">
            {sorted.map((p) => (
              <button key={p.id} type="button" onClick={() => setTarget(p)} className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/50">
                <span className="flex-1 truncate">{siteName(p.name)}</span>
                {p.official_site_id && p.official_site_id === location.official_site_id && <BadgeCheck className="h-4 w-4 text-primary shrink-0" aria-label={t("locations.merge.sameSite")} />}
              </button>
            ))}
            {sorted.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">{t("locations.merge.none")}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">{t("locations.merge.confirm", { from: siteName(location.name), to: siteName(target.name) })}</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setTarget(null)} disabled={busy}>{t("common.back")}</Button>
              <Button className="flex-1 gap-1.5" onClick={() => { void merge(); }} disabled={busy}><Combine className="h-4 w-4" />{t("locations.merge.action")}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
