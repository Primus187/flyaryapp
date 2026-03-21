import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Users, Copy, Link, LogOut, Trash2 } from "lucide-react";

export default function Groups() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [groups, setGroups] = useState<any[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchGroups = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("group_members")
      .select("group_id, role, groups(id, name, description, invite_code, created_by)")
      .eq("user_id", user.id);
    if (data) setGroups(data.map((m: any) => ({ ...m.groups, role: m.role })));
    setLoading(false);
  };

  useEffect(() => { fetchGroups(); }, [user]);

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    const { data, error } = await supabase.from("groups").insert({ name: newName.trim(), description: newDesc.trim() || null, created_by: user.id }).select().single();
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    // Add creator as admin
    await supabase.from("group_members").insert({ group_id: data.id, user_id: user.id, role: "admin" });
    toast({ title: "Gruppe erstellt" });
    setNewName(""); setNewDesc(""); setCreateOpen(false);
    fetchGroups();
  };

  const handleJoin = async () => {
    if (!user || !inviteCode.trim()) return;
    // Find group by invite code
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
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{g.name}</p>
                    <p className="text-xs text-muted-foreground">{g.role === "admin" ? "Admin" : "Mitglied"}{g.description ? ` · ${g.description}` : ""}</p>
                  </div>
                  <div className="flex gap-1">
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
