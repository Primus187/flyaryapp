import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, Save, Trash2, UserMinus, GraduationCap, Mountain, Users } from "lucide-react";

interface MemberRow {
  id: string;
  user_id: string;
  role: string;
  profiles: { pilot_name: string | null } | null;
}

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [group, setGroup] = useState<any>(null);
  const [myRole, setMyRole] = useState<string>("member");
  const [members, setMembers] = useState<MemberRow[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [groupType, setGroupType] = useState("pilot_group");

  const isAdmin = myRole === "admin";

  useEffect(() => {
    if (!user || !id) return;
    const load = async () => {
      const [{ data: g }, { data: membership }, { data: mems }] = await Promise.all([
        supabase.from("groups").select("*").eq("id", id).single(),
        supabase.from("group_members").select("role").eq("group_id", id).eq("user_id", user.id).single(),
        supabase.from("group_members").select("id, user_id, role, profiles(pilot_name)").eq("group_id", id) as any,
      ]);
      if (!g) { navigate("/groups"); return; }
      setGroup(g);
      setName(g.name);
      setDescription(g.description || "");
      setGroupType(g.group_type);
      if (membership) setMyRole(membership.role);
      if (mems) setMembers(mems);
      setLoading(false);
    };
    load();
  }, [user, id]);

  const handleSave = async () => {
    if (!isAdmin || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("groups").update({
      name: name.trim(),
      description: description.trim() || null,
      group_type: groupType as any,
    }).eq("id", id);
    setSaving(false);
    if (error) toast({ title: "Fehler", description: error.message, variant: "destructive" });
    else toast({ title: "Gruppe aktualisiert" });
  };

  const handleCopyCode = () => {
    if (!group) return;
    navigator.clipboard.writeText(group.invite_code);
    toast({ title: "Einladungscode kopiert" });
  };

  const handleDelete = async () => {
    if (!confirm("Gruppe wirklich löschen? Alle Termine werden gelöscht.")) return;
    await supabase.from("groups").delete().eq("id", id);
    toast({ title: "Gruppe gelöscht" });
    navigate("/groups");
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Mitglied wirklich entfernen?")) return;
    await supabase.from("group_members").delete().eq("id", memberId);
    setMembers(prev => prev.filter(m => m.id !== memberId));
    toast({ title: "Mitglied entfernt" });
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    await supabase.from("group_members").update({ role: newRole as any }).eq("id", memberId);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
    toast({ title: "Rolle geändert" });
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Laden...</div>;

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/groups")}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl font-bold tracking-tight flex-1 truncate">{group?.name}</h1>
        {isAdmin && (
          <Button variant="ghost" size="icon" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>

      {/* Group info card */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} disabled={!isAdmin} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Beschreibung</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} disabled={!isAdmin} placeholder="Optional" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Gruppentyp</Label>
            <Select value={groupType} onValueChange={setGroupType} disabled={!isAdmin}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pilot_group">Pilotengruppe (alle erstellen Termine)</SelectItem>
                <SelectItem value="school">Flugschule (nur Admin erstellt Termine)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isAdmin && (
            <Button className="w-full gap-2" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? "..." : "Speichern"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Invite code */}
      {isAdmin && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <Label className="text-xs">Einladungscode</Label>
            <div className="flex items-center gap-2 mt-1.5">
              <code className="flex-1 text-xs bg-muted rounded-md px-3 py-2 truncate">{group?.invite_code}</code>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={handleCopyCode}>
                <Copy className="h-3.5 w-3.5" /> Kopieren
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">Teile diesen Code, damit andere beitreten können.</p>
          </CardContent>
        </Card>
      )}

      {/* Members */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Mitglieder ({members.length})</p>
          </div>
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm truncate">{m.profiles?.pilot_name || "Unbekannt"}</span>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {m.role === "admin" ? "Admin" : "Mitglied"}
                  </Badge>
                </div>
                {isAdmin && m.user_id !== user?.id && (
                  <div className="flex gap-1 shrink-0">
                    <Select value={m.role} onValueChange={v => handleChangeRole(m.id, v)}>
                      <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Mitglied</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveMember(m.id)}>
                      <UserMinus className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
