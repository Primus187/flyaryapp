import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LocationMapPicker from "@/components/LocationMapPicker";
import LocationCombobox from "@/components/LocationCombobox";

interface LocationOption {
  id: string;
  name: string;
  type: string;
  latitude?: number;
  longitude?: number;
}

interface GoalData {
  label: string;
  points: number;
  goal_type: string;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  location_id: string | null;
}

interface Props {
  locations: LocationOption[];
  onSave: (goal: GoalData) => void;
  onCancel: () => void;
  initialValues?: Partial<GoalData>;
}

const GOAL_TYPES = ["start", "turnpoint", "waypoint", "goal"];

export default function ChallengeGoalForm({ locations, onSave, onCancel, initialValues }: Props) {
  const { t } = useTranslation();
  const [label, setLabel] = useState(initialValues?.label || "");
  const [points, setPoints] = useState(String(initialValues?.points ?? 10));
  const [goalType, setGoalType] = useState(initialValues?.goal_type || "waypoint");
  const [latitude, setLatitude] = useState<number | null>(initialValues?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(initialValues?.longitude ?? null);
  const [radius, setRadius] = useState(String(initialValues?.radius_meters ?? 400));
  const [locationId, setLocationId] = useState(initialValues?.location_id || "");
  const [tab, setTab] = useState("map");

  const handleLocationSelect = (locId: string) => {
    setLocationId(locId);
    const loc = locations.find(l => l.id === locId);
    if (loc && loc.latitude && loc.longitude) {
      setLatitude(loc.latitude);
      setLongitude(loc.longitude);
      if (!label) setLabel(loc.name);
    }
  };

  const handleMapSelect = (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
  };

  const handleSave = () => {
    if (!label.trim()) return;
    onSave({
      label: label.trim(),
      points: parseInt(points) || 10,
      goal_type: goalType,
      latitude,
      longitude,
      radius_meters: parseInt(radius) || 400,
      location_id: locationId || null,
    });
  };

  const goalTypeLabels: Record<string, string> = {
    start: t("challenges.start"),
    turnpoint: t("challenges.turnpoint"),
    waypoint: t("challenges.waypoint"),
    goal: t("challenges.goal"),
  };

  return (
    <div className="p-3 rounded-xl border border-border/50 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">{t("challenges.goalLabel")}</Label>
          <Input value={label} onChange={e => setLabel(e.target.value)} placeholder={t("challenges.goalLabelPlaceholder")} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("challenges.points")}</Label>
          <Input type="number" value={points} onChange={e => setPoints(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{t("challenges.goalType")}</Label>
          <Select value={goalType} onValueChange={setGoalType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {GOAL_TYPES.map(gt => (
                <SelectItem key={gt} value={gt}>{goalTypeLabels[gt] || gt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("challenges.radius")}</Label>
          <Input type="number" value={radius} onChange={e => setRadius(e.target.value)} placeholder="400" />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="map" className="flex-1 text-xs">{t("locations.map")}</TabsTrigger>
          <TabsTrigger value="coords" className="flex-1 text-xs">{t("challenges.coordinates")}</TabsTrigger>
          <TabsTrigger value="location" className="flex-1 text-xs">{t("challenges.selectLocation")}</TabsTrigger>
        </TabsList>
        <TabsContent value="map">
          <LocationMapPicker
            latitude={latitude || 0}
            longitude={longitude || 0}
            onSelect={handleMapSelect}
            showSearch
          />
          {latitude && longitude && (
            <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">
              {latitude.toFixed(5)}, {longitude.toFixed(5)}
            </p>
          )}
        </TabsContent>
        <TabsContent value="coords">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">{t("locations.latitude")}</Label>
              <Input type="number" step="any" value={latitude ?? ""} onChange={e => setLatitude(e.target.value ? parseFloat(e.target.value) : null)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("locations.longitude")}</Label>
              <Input type="number" step="any" value={longitude ?? ""} onChange={e => setLongitude(e.target.value ? parseFloat(e.target.value) : null)} />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="location">
          <LocationCombobox
            locations={locations}
            value={locationId}
            onChange={handleLocationSelect}
            filterType="takeoff"
            onLocationCreated={() => {}}
          />
        </TabsContent>
      </Tabs>

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={!label.trim()}>{t("common.save")}</Button>
        <Button size="sm" variant="outline" onClick={onCancel}>{t("common.cancel")}</Button>
      </div>
    </div>
  );
}
