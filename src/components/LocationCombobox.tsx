import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown, Plus, MapPin, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import LocationMapPicker from "@/components/LocationMapPicker";
import OfficialSiteHint from "@/components/OfficialSiteHint";
import { searchSites, type OfficialSite } from "@/lib/official-sites";
import { ensureOwnLocationForSite, siteDetails, officialName, useOfficialSites, useSiteName } from "@/lib/official-sites-store";

interface LocationOption {
  id: string;
  name: string;
  type: string;
  official_site_id?: string | null;
}

interface Props {
  locations: LocationOption[];
  value: string;
  onChange: (value: string) => void;
  filterType: "takeoff" | "landing";
  placeholder?: string;
  onLocationCreated: () => void;
}


export default function LocationCombobox({ locations, value, onChange, filterType, placeholder, onLocationCreated }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newLoc, setNewLoc] = useState({ name: "", type: filterType === "takeoff" ? "takeoff" : "landing", latitude: 0, longitude: 0, altitude: "" });

  const siteName = useSiteName();
  const { active: officialSites, byName, byId } = useOfficialSites();
  // Name of an official site just picked, until the parent has reloaded its list.
  const [pickedName, setPickedName] = useState<{ id: string; name: string } | null>(null);

  const filtered = useMemo(() => {
    return locations.filter((l) => l.type === filterType || l.type === "both");
  }, [locations, filterType]);

  const query = search.trim().toLowerCase();
  // A linked place is also found by its site's official name, area and village ("kron" finds an own "Jakobsbad").
  const ownMatches = filtered.filter((l) => {
    if (!query || l.name.toLowerCase().includes(query) || siteName(l.name).toLowerCase().includes(query)) return true;
    const site = l.official_site_id ? byId.get(l.official_site_id) : undefined;
    return !!site && searchSites([site], search, "both").length > 0;
  });
  const officialMatches = useMemo(() => {
    // Sites the pilot already has (possibly under an own name) are listed under "my places".
    const ownSites = new Set(locations.map((l) => l.official_site_id).filter(Boolean));
    const ownNames = new Set(locations.map((l) => l.name));
    return searchSites(officialSites, search, filterType, 40).filter((s) => !ownSites.has(s.id) && !ownNames.has(officialName(s))).slice(0, 20);
  }, [officialSites, search, filterType, locations]);

  const selectedRaw = filtered.find((l) => l.id === value)?.name || locations.find((l) => l.id === value)?.name
    || (pickedName?.id === value ? pickedName.name : undefined);
  const selectedName = selectedRaw ? siteName(selectedRaw) : undefined;

  const pickOfficial = async (site: OfficialSite) => {
    if (!user) return;
    setCreating(true);
    try {
      const id = await ensureOwnLocationForSite(user.id, site);
      setPickedName({ id, name: officialName(site) });
      onChange(id);
      onLocationCreated();
      setOpen(false);
      setSearch("");
      setDialogOpen(false);
    } catch (err: unknown) {
      toast({ title: t("common.error"), description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleCreate = async () => {
    if (!user || !newLoc.name.trim()) return;
    setCreating(true);
    try {
      // Reverse geocode for country
      let country_code: string | null = null;
      if (newLoc.latitude !== 0 || newLoc.longitude !== 0) {
        try {
          const { data: geoData, error: geoError } = await supabase.functions.invoke('reverse-geocode', {
            body: { lat: newLoc.latitude, lon: newLoc.longitude },
          });
          if (!geoError && geoData) {
            country_code = geoData.country_code || null;
          }
        } catch { /* ignore */ }
      }

      const { data, error } = await supabase.from("locations").insert({
        user_id: user.id,
        name: newLoc.name.trim(),
        type: newLoc.type,
        latitude: newLoc.latitude,
        longitude: newLoc.longitude,
        altitude: newLoc.altitude ? parseInt(newLoc.altitude) : null,
        country_code,
      } as TablesInsert<"locations">).select("id").single();

      if (error) throw error;
      toast({ title: t("locations.locationCreated") });
      onChange(data.id);
      onLocationCreated();
      setDialogOpen(false);
      setNewLoc({ name: "", type: filterType === "takeoff" ? "takeoff" : "landing", latitude: 0, longitude: 0, altitude: "" });
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal h-10">
            {selectedName || <span className="text-muted-foreground">{placeholder || t("flights.select")}</span>}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder={t("locations.searchLocation")} value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty>{t("locations.noResults")}</CommandEmpty>
              {(ownMatches.length > 0 || officialMatches.length === 0) && (
              <CommandGroup heading={officialMatches.length > 0 ? t("locations.official.mine") : undefined}>
                {ownMatches
                  .map((loc) => (
                    <CommandItem
                      key={loc.id}
                      value={loc.id}
                      onSelect={() => {
                        onChange(loc.id === value ? "" : loc.id);
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", value === loc.id ? "opacity-100" : "opacity-0")} />
                      {siteName(loc.name)}
                      {(loc.official_site_id || byName.has(loc.name)) && <BadgeCheck className="ml-1.5 h-3.5 w-3.5 text-primary shrink-0" aria-label={t("locations.official.badge")} />}
                    </CommandItem>
                  ))}
              </CommandGroup>
              )}
              {officialMatches.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading={t("locations.official.catalogue")}>
                    {officialMatches.map((site) => (
                      <CommandItem key={site.id} value={`official-${site.id}`} disabled={creating} onSelect={() => { void pickOfficial(site); }}>
                        <BadgeCheck className="mr-2 h-4 w-4 text-primary shrink-0" />
                        <span className="flex-1 min-w-0">
                          <span className="block truncate">{siteName(officialName(site))}</span>
                          <span className="block text-[11px] opacity-70 truncate">{siteDetails(site)}</span>
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    setSearch("");
                    setDialogOpen(true);
                  }}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t("locations.createNew")}
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("locations.createLocation")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("locations.name")}</Label>
              <Input value={newLoc.name} onChange={(e) => setNewLoc({ ...newLoc, name: e.target.value })} placeholder={t("locations.namePlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("locations.type")}</Label>
              <Select value={newLoc.type} onValueChange={(v) => setNewLoc({ ...newLoc, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="takeoff">{t("locations.takeoff")}</SelectItem>
                  <SelectItem value="landing">{t("locations.landingPlace")}</SelectItem>
                  <SelectItem value="both">{t("locations.both")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("locations.selectOnMap")}</Label>
              <LocationMapPicker
                latitude={newLoc.latitude}
                longitude={newLoc.longitude}
                onSelect={(lat, lng) => setNewLoc({ ...newLoc, latitude: lat, longitude: lng })}
              />
              {(newLoc.latitude !== 0 || newLoc.longitude !== 0) && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {newLoc.latitude.toFixed(4)}, {newLoc.longitude.toFixed(4)}
                </p>
              )}
              <OfficialSiteHint latitude={newLoc.latitude} longitude={newLoc.longitude} type={newLoc.type} onUse={(site) => { void pickOfficial(site); }} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("locations.altitude")}</Label>
              <Input type="number" value={newLoc.altitude} onChange={(e) => setNewLoc({ ...newLoc, altitude: e.target.value })} />
            </div>
            <Button onClick={handleCreate} disabled={creating || !newLoc.name.trim()} className="w-full">
              {creating ? t("common.loading") : t("common.create")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
