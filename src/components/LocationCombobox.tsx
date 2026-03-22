import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown, Plus, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import LocationMapPicker from "@/components/LocationMapPicker";

interface LocationOption {
  id: string;
  name: string;
  type: string;
}

interface Props {
  locations: LocationOption[];
  value: string;
  onChange: (value: string) => void;
  filterType: "takeoff" | "landing";
  placeholder?: string;
  onLocationCreated: () => void;
}

const countryCodeToFlag = (code: string) => {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
};

export default function LocationCombobox({ locations, value, onChange, filterType, placeholder, onLocationCreated }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newLoc, setNewLoc] = useState({ name: "", type: filterType === "takeoff" ? "takeoff" : "landing", latitude: 0, longitude: 0, altitude: "" });

  const filtered = useMemo(() => {
    return locations.filter((l) => l.type === filterType || l.type === "both");
  }, [locations, filterType]);

  const selectedName = filtered.find((l) => l.id === value)?.name || locations.find((l) => l.id === value)?.name;

  const handleCreate = async () => {
    if (!user || !newLoc.name.trim()) return;
    setCreating(true);
    try {
      // Reverse geocode for country
      let country_code: string | null = null;
      if (newLoc.latitude !== 0 || newLoc.longitude !== 0) {
        try {
          const res = await supabase.functions.invoke("reverse-geocode", {
            body: null,
            headers: {},
          });
          // Use fetch directly for query params
          const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reverse-geocode?lat=${newLoc.latitude}&lon=${newLoc.longitude}`;
          const geoRes = await fetch(url, {
            headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          });
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            country_code = geoData.country_code || null;
          }
        } catch { /* ignore */ }
      }

      const { data, error } = await supabase.from("locations").insert({
        user_id: user.id,
        name: newLoc.name.trim(),
        type: newLoc.type as any,
        latitude: newLoc.latitude,
        longitude: newLoc.longitude,
        altitude: newLoc.altitude ? parseInt(newLoc.altitude) : null,
        country_code,
      }).select("id").single();

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
              <CommandGroup>
                {filtered
                  .filter((l) => l.name.toLowerCase().includes(search.toLowerCase()))
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
                      {loc.name}
                    </CommandItem>
                  ))}
              </CommandGroup>
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
