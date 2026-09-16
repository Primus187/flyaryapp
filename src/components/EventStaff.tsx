import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { User, HandHelping, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StaffRow {
  id: string;
  user_id: string;
  role: "instructor" | "launch_helper";
  position: string | null;
}

interface MemberOption {
  user_id: string;
  name: string;
  functions: string[];
}

interface Props {
  eventId: string;
  groupId: string;
  canManage: boolean;
}

export default function EventStaff({ eventId, groupId, canManage }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<MemberOption[]>([]);
  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState<"instructor" | "launch_helper">("instructor");
  const [newPosition, setNewPosition] = useState("");

  const load = async () => {
    const { data } = await supabase.from("event_staff" as any).select("*").eq("event_id", eventId);
    const rows = (data as any[]) || [];
    setStaff(rows);
    if (rows.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("user_id, pilot_name").in("user_id", [...new Set(rows.map((r) => r.user_id))]);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => { map[p.user_id] = p.pilot_name || "Pilot"; });
      setNames(map);
    }
  };

  useEffect(() => {
    load();
    // Load potential staff: group members with instructor/launch_helper function
    const loadOptions = async () => {
      const { data: funcs } = await supabase
        .from("group_member_functions" as any)
        .select("user_id, function")
        .eq("group_id", groupId)
        .in("function", ["instructor", "launch_helper"]);
      const rows = (funcs as any[]) || [];
      if (rows.length === 0) { setOptions([]); return; }
      const ids = [...new Set(rows.map((r) => r.user_id))];
      const { data: profs } = await supabase.from("profiles").select("user_id, pilot_name").in("user_id", ids);
      const funcMap: Record<string, string[]> = {};
      rows.forEach((r) => {
        if (!funcMap[r.user_id]) funcMap[r.user_id] = [];
        funcMap[r.user_id].push(r.function);
      });
      setOptions(ids.map((id) => ({
        user_id: id,
        name: (profs || []).find((p: any) => p.user_id === id)?.pilot_name || "Pilot",
        functions: funcMap[id] || [],
      })));
    };
    loadOptions();
  }, [eventId, groupId]);

  const addStaff = async () => {
    if (!newUserId) return;
    const { error } = await supabase.from("event_staff" as any).insert({
      event_id: eventId,
      user_id: newUserId,
      role: newRole,
      position: newPosition.trim() || null,
    } as any);
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    } else {
      setNewUserId(""); setNewPosition("");
      await load();
    }
  };

  const removeStaff = async (id: string) => {
    await supabase.from("event_staff" as any).delete().eq("id", id);
    setStaff((prev) => prev.filter((s) => s.id !== id));
  };

  const instructors = staff.filter((s) => s.role === "instructor");
  const helpers = staff.filter((s) => s.role === "launch_helper");

  if (staff.length === 0 && !canManage) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("events.staff.title")}</h2>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3 space-y-2">
          {staff.length === 0 && <p className="text-sm text-muted-foreground">{t("events.staff.empty")}</p>}
          {[
            { list: instructors, icon: User, label: t("events.staff.instructors") },
            { list: helpers, icon: HandHelping, label: t("events.staff.launchHelpers") },
          ].map(({ list, icon: Icon, label }) =>
            list.length > 0 ? (
              <div key={label}>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Icon className="h-3 w-3" /> {label}
                </p>
                <div className="space-y-1">
                  {list.map((s) => (
                    <div key={s.id} className="flex items-center gap-2">
                      <span className="text-sm flex-1 truncate">{names[s.user_id] || "Pilot"}</span>
                      {s.position && <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">{s.position}</Badge>}
                      {canManage && (
                        <button onClick={() => removeStaff(s.id)} className="text-muted-foreground hover:text-destructive">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          )}

          {canManage && (
            <div className="pt-2 border-t border-border space-y-2">
              <div className="flex gap-2">
                <Select value={newUserId} onValueChange={setNewUserId}>
                  <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder={t("events.staff.selectPerson")} /></SelectTrigger>
                  <SelectContent>
                    {options.map((o) => (
                      <SelectItem key={o.user_id} value={o.user_id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as any)}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instructor">{t("events.staff.instructor")}</SelectItem>
                    <SelectItem value="launch_helper">{t("events.staff.launchHelper")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Input
                  value={newPosition}
                  onChange={(e) => setNewPosition(e.target.value)}
                  placeholder={t("events.staff.positionPlaceholder")}
                  className="h-8 text-xs flex-1"
                />
                <Button size="sm" className="h-8 gap-1" onClick={addStaff} disabled={!newUserId}>
                  <Plus className="h-3.5 w-3.5" /> {t("common.add")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
