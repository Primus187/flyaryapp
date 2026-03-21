import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, MapPin, Pencil, Trash2 } from "lucide-react";
import LocationMapPicker from "@/components/LocationMapPicker";

export default function Locations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [locations, setLocations] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", latitude: "", longitude: "", type: "both" as string, altitude: "", description: "" });

  const fetchLocations = async () => {
    if (!user) return;
    const { data } = await supabase.from("locations").select("*").eq("user_id", user.id).order("name");
    if (data) setLocations(data);
  };

  useEffect(() => { fetchLocations(); }, [user]);

  const resetForm = () => {
    setForm({ name: "", latitude: "", longitude: "", type: "both", altitude: "", description: "" });
    setEditId(null);
  };

  const handleSave = async () => {
    if (!user) return;
    const data = {
      user_id: user.id,
      name: form.name,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      type: form.type as any,
      altitude: form.altitude ? parseInt(form.altitude) : null,
      description: form.description || null,
    };

    if (editId) {
      await supabase.from("locations").update(data).eq("id", editId);
      toast({ title: "Ort aktualisiert" });
    } else {
      await supabase.from("locations").insert(data);
      toast({ title: "Ort erstellt" });
    }
    resetForm();
    setOpen(false);
    fetchLocations();
  };

  const handleEdit = (loc: any) => {
    setForm({
      name: loc.name,
      latitude: loc.latitude.toString(),
      longitude: loc.longitude.toString(),
      type: loc.type,
      altitude: loc.altitude?.toString() || "",
      description: loc.description || "",
    });
    setEditId(loc.id);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Ort löschen?")) return;
    await supabase.from("locations").delete().eq("id", id);
    toast({ title: "Ort gelöscht" });
    fetchLocations();
  };

  const handleMapSelect = (lat: number, lng: number) => {
    setForm((prev) => ({ ...prev, latitude: lat.toString(), longitude: lng.toString() }));
  };

  const typeLabel = (t: string) => t === "takeoff" ? "Startplatz" : t === "landing" ? "Landeplatz" : "Beides";
  const typeColor = (t: string) => t === "takeoff" ? "text-secondary" : t === "landing" ? "text-destructive" : "text-primary";

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Orte</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Ort</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editId ? "Ort bearbeiten" : "Neuer Ort"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="z.B. Niesen" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Typ</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="takeoff">Startplatz</SelectItem>
                    <SelectItem value="landing">Landeplatz</SelectItem>
                    <SelectItem value="both">Beides</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Position auf Karte wählen</Label>
                <LocationMapPicker
                  latitude={parseFloat(form.latitude) || 0}
                  longitude={parseFloat(form.longitude) || 0}
                  onSelect={handleMapSelect}
                />
                <p className="text-xs text-muted-foreground">Tippe auf die Karte, um die Position zu setzen.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Breitengrad</Label>
                  <Input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="46.7" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Längengrad</Label>
                  <Input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="7.6" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Höhe (m)</Label>
                  <Input type="number" value={form.altitude} onChange={(e) => setForm({ ...form, altitude: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Beschreibung</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional" />
              </div>
              <Button className="w-full" onClick={handleSave}>{editId ? "Aktualisieren" : "Speichern"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {locations.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MapPin className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Noch keine Orte erfasst</p>
        </div>
      ) : (
        <div className="space-y-2">
          {locations.map((loc) => (
            <Card key={loc.id} className="border-0 shadow-sm">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{loc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className={typeColor(loc.type)}>{typeLabel(loc.type)}</span>
                    {loc.altitude && <span> · {loc.altitude}m</span>}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(loc)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(loc.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}