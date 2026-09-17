import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, Download, Pencil, GraduationCap, ShieldCheck, HandHelping, User, Crown, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const GROUP_FUNCTIONS = ["student", "licensed", "launch_helper", "instructor", "school_lead"] as const;
export type GroupFunction = (typeof GROUP_FUNCTIONS)[number];

// Im Team-Bereich werden nur Schulleitung, Fluglehrer und Starthelfer angezeigt
const TEAM_FUNCTIONS: GroupFunction[] = ["school_lead", "instructor", "launch_helper"];

const FUNCTION_ICONS: Record<GroupFunction, any> = {
  student: GraduationCap,
  licensed: ShieldCheck,
  launch_helper: HandHelping,
  instructor: User,
  school_lead: Crown,
};

const TRAINING_LEVELS = ["ground", "altitude", "exam_ready", "licensed"] as const;

interface PersonRow {
  userId: string;
  pilotName: string;
  role: string;
  trainingLevel: string | null;
  functions: GroupFunction[];
}

interface Props {
  groupId: string;
  canManage: boolean;
}

function csvEscape(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function SchoolPeople({ groupId, canManage }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<GroupFunction | "all">("all");
  const [editing, setEditing] = useState<PersonRow | null>(null);
  const [editFunctions, setEditFunctions] = useState<GroupFunction[]>([]);
  const [editLevel, setEditLevel] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignBusy, setAssignBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: members }, { data: funcs }] = await Promise.all([
      supabase.from("group_members").select("user_id, role").eq("group_id", groupId),
      supabase.from("group_member_functions" as any).select("user_id, function").eq("group_id", groupId),
    ]);
    const memberList = members || [];
    const userIds = memberList.map((m) => m.user_id);
    let profileMap: Record<string, { pilot_name: string | null; training_level: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("user_id, pilot_name, training_level").in("user_id", userIds);
      (profs || []).forEach((p: any) => { profileMap[p.user_id] = p; });
    }
    const funcMap: Record<string, GroupFunction[]> = {};
    ((funcs as any[]) || []).forEach((f) => {
      if (!funcMap[f.user_id]) funcMap[f.user_id] = [];
      funcMap[f.user_id].push(f.function as GroupFunction);
    });
    setPeople(
      memberList.map((m) => ({
        userId: m.user_id,
        pilotName: profileMap[m.user_id]?.pilot_name || "",
        role: m.role,
        trainingLevel: profileMap[m.user_id]?.training_level || null,
        functions: funcMap[m.user_id] || [],
      }))
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, [groupId]);

  const teamPeople = useMemo(
    () => people.filter((p) => p.functions.some((f) => TEAM_FUNCTIONS.includes(f as any))),
    [people]
  );

  const counts = useMemo(() => {
    const c: Record<GroupFunction, number> = { student: 0, licensed: 0, launch_helper: 0, instructor: 0, school_lead: 0 };
    teamPeople.forEach((p) => p.functions.forEach((f) => { c[f]++; }));
    return c;
  }, [teamPeople]);

  const filtered = useMemo(() => {
    return teamPeople.filter((p) => {
      if (filter !== "all" && !p.functions.includes(filter)) return false;
      if (search.trim() && !p.pilotName.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [teamPeople, filter, search]);

  const openEdit = (p: PersonRow) => {
    setEditing(p);
    setEditFunctions([...p.functions]);
    setEditLevel(p.trainingLevel || "");
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      // sync functions
      const toAdd = editFunctions.filter((f) => !editing.functions.includes(f));
      const toRemove = editing.functions.filter((f) => !editFunctions.includes(f));
      if (toAdd.length > 0) {
        await supabase.from("group_member_functions" as any).insert(
          toAdd.map((f) => ({ group_id: groupId, user_id: editing.userId, function: f })) as any
        );
      }
      for (const f of toRemove) {
        await supabase.from("group_member_functions" as any).delete()
          .eq("group_id", groupId).eq("user_id", editing.userId).eq("function", f);
      }
      // training level
      const newLevel = editLevel || null;
      if (newLevel !== editing.trainingLevel) {
        const { error } = await supabase.rpc("set_member_training_level" as any, {
          _group_id: groupId,
          _user_id: editing.userId,
          _training_level: newLevel,
        } as any);
        if (error) throw error;
      }
      toast({ title: t("school.people.saved") });
      setEditing(null);
      await load();
    } catch (e: any) {
      toast({ title: t("common.error"), description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleFunction = async (p: PersonRow, f: GroupFunction) => {
    const has = p.functions.includes(f);
    setAssignBusy(`${p.userId}-${f}`);
    const { error } = has
      ? await supabase.from("group_member_functions" as any).delete()
          .eq("group_id", groupId).eq("user_id", p.userId).eq("function", f)
      : await supabase.from("group_member_functions" as any).insert({ group_id: groupId, user_id: p.userId, function: f } as any);
    setAssignBusy(null);
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      return;
    }
    setPeople((prev) =>
      prev.map((x) =>
        x.userId === p.userId
          ? { ...x, functions: has ? x.functions.filter((y) => y !== f) : [...x.functions, f] }
          : x
      )
    );
  };

  const handleExport = () => {
    const headers = [t("school.csv.name"), t("school.people.functions"), t("school.csv.level")];
    const rows = filtered.map((p) => [
      csvEscape(p.pilotName),
      csvEscape(p.functions.map((f) => t(`school.functions.${f}`)).join("; ")),
      csvEscape(p.trainingLevel ? t(`school.levels.${p.trainingLevel}`, { defaultValue: p.trainingLevel }) : ""),
    ].join(","));
    const csv = "﻿" + [headers.map(csvEscape).join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `people-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: t("school.csv.exported") });
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground text-sm">{t("common.loading")}</div>;
  }

  return (
    <div className="space-y-3">
      {/* Counters */}
      <div className="grid grid-cols-3 gap-1.5">
        {TEAM_FUNCTIONS.map((f) => {
          const Icon = FUNCTION_ICONS[f];
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(active ? "all" : f)}
              className={`rounded-xl p-2 flex flex-col items-center gap-0.5 transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-card shadow-sm"}`}
            >
              <Icon className={`h-4 w-4 ${active ? "" : "text-primary"}`} />
              <span className="text-sm font-bold leading-none">{counts[f]}</span>
              <span className={`text-[8px] leading-tight text-center ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {t(`school.functions.${f}`)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("school.people.search")} className="pl-8 h-9 text-sm" />
        </div>
        <Button variant="outline" size="sm" className="h-9 gap-1 shrink-0" onClick={handleExport}>
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t("school.csv.export")}</span>
        </Button>
      </div>

      {canManage && (
        <Button variant="secondary" size="sm" className="w-full gap-1.5" onClick={() => setAssignOpen(true)}>
          <Users className="h-3.5 w-3.5" />
          {t("school.people.assignFunctions")}
        </Button>
      )}


      {filtered.length === 0 && (
        <p className="text-center py-8 text-muted-foreground text-sm">{t("school.people.empty")}</p>
      )}

      {filtered.map((p) => (
        <Card
          key={p.userId}
          className="border-0 shadow-sm cursor-pointer hover:bg-muted/30 active:scale-[0.99] transition-all"
          onClick={() => navigate(`/pilot/${p.userId}`)}
        >
          <CardContent className="p-3 flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {(p.pilotName || "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-sm truncate">{p.pilotName || t("common.unknown")}</p>
                {canManage && (
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                    onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {p.functions.map((f) => (
                  <Badge key={f} variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                    {t(`school.functions.${f}`)}
                  </Badge>
                ))}
                {p.trainingLevel && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-primary/40 text-primary">
                    {t(`school.levels.${p.trainingLevel}`, { defaultValue: p.trainingLevel })}
                  </Badge>
                )}
                {p.functions.length === 0 && !p.trainingLevel && (
                  <span className="text-[10px] text-muted-foreground">{t("school.people.noFunction")}</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing?.pilotName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">{t("school.people.functions")}</Label>
              {GROUP_FUNCTIONS.map((f) => (
                <label key={f} className="flex items-center gap-2 py-1 cursor-pointer">
                  <Checkbox
                    checked={editFunctions.includes(f)}
                    onCheckedChange={(checked) =>
                      setEditFunctions((prev) => (checked ? [...prev, f] : prev.filter((x) => x !== f)))
                    }
                  />
                  <span className="text-sm">{t(`school.functions.${f}`)}</span>
                </label>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("school.people.trainingLevel")}</Label>
              <Select value={editLevel || "__none__"} onValueChange={(v) => setEditLevel(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                   <SelectItem value="__none__">—</SelectItem>
                   {editLevel && !(TRAINING_LEVELS as readonly string[]).includes(editLevel) && (
                     <SelectItem value={editLevel}>{editLevel}</SelectItem>
                   )}
                   {TRAINING_LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>{t(`school.levels.${l}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={saveEdit} disabled={saving}>{saving ? "..." : t("common.save")}</Button>
              <Button variant="outline" onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("school.people.assignFunctions")}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">{t("school.people.assignHint")}</p>
          <div className="space-y-3">
            {people.map((p) => (
              <div key={p.userId} className="space-y-1.5">
                <p className="text-sm font-medium truncate">{p.pilotName || t("common.unknown")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {GROUP_FUNCTIONS.map((f) => {
                    const active = p.functions.includes(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        disabled={assignBusy === `${p.userId}-${f}`}
                        onClick={() => toggleFunction(p, f)}
                        className={`rounded-full px-2.5 py-1 text-[11px] border transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground border-transparent"
                            : "bg-muted/40 text-muted-foreground border-border/60"
                        }`}
                      >
                        {t(`school.functions.${f}`)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <Button className="w-full" onClick={() => setAssignOpen(false)}>{t("common.close")}</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
