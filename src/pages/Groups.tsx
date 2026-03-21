import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Users, Copy, Link, LogOut, Trash2, ChevronDown, ChevronUp, GraduationCap, Mountain } from "lucide-react";

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  created_by: string;
  group_type: string;
  role: string;
}

interface MemberRow {
  id: string;
  user_id: string;
  role: string;
  profiles: { pilot_name: string | null } | null;
}

export default function Groups() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<string>("pilot_group");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, MemberRow[]>>({});

  const fetchGroups = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("group_members")
      .select("group_id, role, groups(id, name, description, invite_code, created_by, group_type)")
      .eq("user_id", user.id);
    if (data) setGroups(data.map((m: any) => ({ ...m.groups, role: m.role })));
    setLoading(false);
  };

  useEffect(() => { fetchGroups(); }, [user]);

  const fetchMembers = async (groupId: string) => {
    if (members[groupId]) return;
    const { data } = await supabase
      .from("group_members")
      .select("id, user_id, role, profiles(pilot_name)")
      .eq("group_id", groupId) as any;
    if (data) setMembers(prev => ({ ...prev, [groupId]: data }));
  };

  const toggleExpand = (groupId: string) => {
    if (expandedGroup === groupId) {
      setExpandedGroup(null);
    } else {
      setExpandedGroup(groupId);
      fetchMembers(groupId);
    }
  };

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    const { data, error } = await supabase.from("groups").insert({
      name: newName.trim(),
      description: newDesc.trim() || null,
      created_by: user.id,
      group_type: newType as any,
    }).select().single();
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    await supabase.from("group_members").insert({ group_id: data.id, user_id: user.id, role: "admin" });
    toast({ title: "Gruppe erstellt" });
    setNewName(""); setNewDesc(""); setNewType("pilot_group"); setCreateOpen(false);
    fetchGroups();
  };

  const handleJoin = async () => {
    if (!user || !inviteCode.trim()) return;
    const { data: group } = await supabase.from("groups").select("id, name").eq("invite_code", inviteCode.trim()).single();
    if (!group) { toast({ title: "Ungültiger Einladungscode", variant: "destructive" }); return; }
    const { error } = await supabase.from("group_members").insert({ group_id: group.id, user_id: user.id, role: "member" });
    if (error?.code === "23505") { toast({ title: "Du bist bereits Mitglied" }); }
    else if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); }
    else { toast({ title: `Beigetreten: ${group.name}` }); }
    setInviteCode(""); setJoinOpen(false);
    fetchGroups();
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Einladungscode kopiert" });
  };

  const handleLeave = async (groupId: string) => {
    if (!user || !confirm("Gruppe wirklich verlassen?")) return;
    await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", user.id);
    toast({ title: "Gruppe verlassen" });
    fetchGroups();
  };

  const handleDelete = async (groupId: string) => {
    if (!confirm("Gruppe wirklich löschen? Alle Termine werden gelöscht.")) return;
    await supabase.from("groups").delete().eq("id", groupId);
    toast({ title: "Gruppe gelöscht" });
    fetchGroups();
  };

  const handleRemoveMember = async (groupId: string, memberId: string) => {
    if (!confirm("Mitglied wirklich entfernen?")) return;
    await supabase.from("group_members").delete().eq("id", memberId);
    setMembers(prev => ({ ...prev, [groupId]: prev[groupId]?.filter(m => m.id !== memberId) }));
    toast({ title: "Mitglied entfernt" });
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Laden...</div>;

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl font-bold tracking-tight flex-1">Gruppen</h1>
        <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5"><Link className="h-4 w-4" /> Beitreten</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Gruppe beitreten</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Einladungscode</Label>
                <Input value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="Code einfügen" />
              </div>
              <Button className="w-full" onClick={handleJoin}>Beitreten</Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Neu</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Neue Gruppe</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="z.B. Flugschule Bern" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Typ</Label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pilot_group">Pilotengruppe (alle erstellen Termine)</SelectItem>
                    <SelectItem value="school">Flugschule (nur Admin erstellt Termine)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Beschreibung</Label>
                <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Optional" />
              </div>
              <Button className="w-full" onClick={handleCreate}>Erstellen</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Noch keine Gruppen</p>
          <p className="text-xs mt-1">Erstelle eine Gruppe oder tritt mit einem Einladungscode bei.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map(g => (
            <Card key={g.id} className="border-0 shadow-sm">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(g.id)}>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{g.name}</p>
                      <Badge variant="secondary" className="text-[10px] gap-1 shrink-0">
                        {g.group_type === "school" ? <><GraduationCap className="h-2.5 w-2.5" /> Schule</> : <><Mountain className="h-2.5 w-2.5" /> Piloten</>}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {g.role === "admin" ? "Admin" : "Mitglied"}
                      {g.description ? ` · ${g.description}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleExpand(g.id)}>
                      {expandedGroup === g.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                    {g.role === "admin" && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopyCode(g.invite_code)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {g.role === "admin" ? (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(g.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleLeave(g.id)}>
                        <LogOut className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>

                {expandedGroup === g.id && (
                  <div className="border-t pt-2 space-y-2">
                    {g.role === "admin" && (
                      <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                        <span className="text-xs text-muted-foreground flex-1 truncate">Code: {g.invite_code}</span>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleCopyCode(g.invite_code)}>
                          <Copy className="h-3 w-3" /> Kopieren
                        </Button>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-medium mb-1.5">Mitglieder</p>
                      {!members[g.id] ? (
                        <p className="text-xs text-muted-foreground">Laden...</p>
                      ) : members[g.id].length === 0 ? (
                        <p className="text-xs text-muted-foreground">Keine Mitglieder</p>
                      ) : (
                        <div className="space-y-1">
                          {members[g.id].map(m => (
                            <div key={m.id} className="flex items-center justify-between text-xs">
                              <span>{m.profiles?.pilot_name || "Unbekannt"} <span className="text-muted-foreground">({m.role === "admin" ? "Admin" : "Mitglied"})</span></span>
                              {g.role === "admin" && m.user_id !== user?.id && (
                                <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive px-2" onClick={() => handleRemoveMember(g.id, m.id)}>
                                  Entfernen
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
