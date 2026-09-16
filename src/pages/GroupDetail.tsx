import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, Save, Trash2, UserMinus, Users, Trophy, Plus } from "lucide-react";
import ChallengeCard from "@/components/ChallengeCard";
import GroupChat from "@/components/GroupChat";

interface MemberRow { id: string; user_id: string; role: string; profiles: { pilot_name: string | null } | null; }

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [group, setGroup] = useState<any>(null); const [myRole, setMyRole] = useState<string>("member"); const [members, setMembers] = useState<MemberRow[]>([]);
  const [name, setName] = useState(""); const [description, setDescription] = useState(""); const [groupType, setGroupType] = useState("pilot_group");
  const [challenges, setChallenges] = useState<any[]>([]);
  const [showNewChallenge, setShowNewChallenge] = useState(false);
  const [newChallenge, setNewChallenge] = useState({ title: "", description: "", end_date: "" });
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
      setGroup(g); setName(g.name); setDescription(g.description || ""); setGroupType(g.group_type);
      if (membership) setMyRole(membership.role); if (mems) setMembers(mems); setLoading(false);

      // Load challenges
      loadChallenges();
    };
    load();
  }, [user, id]);

  const loadChallenges = async () => {
    if (!id || !user) return;
    const { data: challengeList } = await supabase.from("challenges" as any).select("*").eq("group_id", id).order("created_at", { ascending: false });
    if (!challengeList) { setChallenges([]); return; }

    // For each challenge, get goal count, my progress, participant count
    const enriched = await Promise.all((challengeList as any[]).map(async (c) => {
      const { data: goals } = await supabase.from("challenge_goals" as any).select("id").eq("challenge_id", c.id);
      const { data: myProg } = await supabase.from("challenge_progress" as any).select("goal_id").eq("challenge_id", c.id).eq("user_id", user!.id);
      const { data: allProg } = await supabase.from("challenge_progress" as any).select("user_id").eq("challenge_id", c.id);
      const uniqueParticipants = new Set((allProg as any[] || []).map((p: any) => p.user_id));
      return {
        ...c,
        totalGoals: (goals as any[] || []).length,
        myCompleted: (myProg as any[] || []).length,
        participantCount: uniqueParticipants.size,
      };
    }));
    setChallenges(enriched);
  };

  const handleSave = async () => { if (!isAdmin || !name.trim()) return; setSaving(true); const { error } = await supabase.from("groups").update({ name: name.trim(), description: description.trim() || null, group_type: groupType as any }).eq("id", id); setSaving(false); if (error) toast({ title: t("common.error"), description: error.message, variant: "destructive" }); else toast({ title: t("groups.groupUpdated") }); };
  const handleCopyCode = () => { if (!group) return; navigator.clipboard.writeText(group.invite_code); toast({ title: t("groups.codeCopied") }); };
  const handleDelete = async () => { if (!confirm(t("groups.deleteGroup"))) return; await supabase.from("groups").delete().eq("id", id); toast({ title: t("groups.groupDeleted") }); navigate("/groups"); };
  const handleRemoveMember = async (memberId: string) => { if (!confirm(t("groups.removeMember"))) return; await supabase.from("group_members").delete().eq("id", memberId); setMembers(prev => prev.filter(m => m.id !== memberId)); toast({ title: t("groups.memberRemoved") }); };
  const handleChangeRole = async (memberId: string, newRole: string) => { await supabase.from("group_members").update({ role: newRole as any }).eq("id", memberId); setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m)); toast({ title: t("groups.roleChanged") }); };

  const handleCreateChallenge = async () => {
    if (!newChallenge.title.trim() || !user || !id) return;
    const { error } = await supabase.from("challenges" as any).insert({
      group_id: id,
      title: newChallenge.title.trim(),
      description: newChallenge.description.trim() || null,
      end_date: newChallenge.end_date || null,
      created_by: user.id,
    } as any);
    if (error) { toast({ title: t("common.error"), description: error.message, variant: "destructive" }); return; }
    setNewChallenge({ title: "", description: "", end_date: "" });
    setShowNewChallenge(false);
    loadChallenges();
    toast({ title: t("challenges.challengeCreated") });
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/groups")}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl font-bold tracking-tight flex-1 truncate">{group?.name}</h1>
        {isAdmin && <Button variant="ghost" size="icon" onClick={handleDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
      </div>

      <Tabs defaultValue="info" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="info" className="flex-1">{t("challenges.info")}</TabsTrigger>
          <TabsTrigger value="challenges" className="flex-1">
            <Trophy className="h-3.5 w-3.5 mr-1" />
            {t("challenges.title")}
            {challenges.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">{challenges.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex-1">{t("events.chat")}</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4 mt-4">
          <Card className="border-0 shadow-sm"><CardContent className="p-4 space-y-3">
            <div className="space-y-1.5"><Label className="text-xs">{t("groups.name")}</Label><Input value={name} onChange={e => setName(e.target.value)} disabled={!isAdmin} /></div>
            <div className="space-y-1.5"><Label className="text-xs">{t("groups.description")}</Label><Input value={description} onChange={e => setDescription(e.target.value)} disabled={!isAdmin} placeholder={t("common.optional")} /></div>
            <div className="space-y-1.5"><Label className="text-xs">{t("groups.groupType")}</Label><Select value={groupType} onValueChange={setGroupType} disabled={!isAdmin}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pilot_group">{t("groups.pilotGroup")}</SelectItem><SelectItem value="school">{t("groups.school")}</SelectItem></SelectContent></Select></div>
            {isAdmin && <Button className="w-full gap-2" onClick={handleSave} disabled={saving}><Save className="h-4 w-4" /> {saving ? "..." : t("common.save")}</Button>}
          </CardContent></Card>
          {isAdmin && (<Card className="border-0 shadow-sm"><CardContent className="p-4"><Label className="text-xs">{t("groups.inviteCode")}</Label><div className="flex items-center gap-2 mt-1.5"><code className="flex-1 text-xs bg-muted rounded-md px-3 py-2 truncate">{group?.invite_code}</code><Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={handleCopyCode}><Copy className="h-3.5 w-3.5" /> {t("groups.copy")}</Button></div><p className="text-[11px] text-muted-foreground mt-1.5">{t("groups.shareCode")}</p></CardContent></Card>)}
          <Card className="border-0 shadow-sm"><CardContent className="p-4"><div className="flex items-center gap-2 mb-3"><Users className="h-4 w-4 text-muted-foreground" /><p className="text-sm font-medium">{t("groups.members")} ({members.length})</p></div><div className="space-y-2">{members.map(m => (<div key={m.id} className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 min-w-0"><span className="text-sm truncate">{m.profiles?.pilot_name || t("common.unknown")}</span><Badge variant="secondary" className="text-[10px] shrink-0">{m.role === "admin" ? t("groups.admin") : t("groups.member")}</Badge></div>{isAdmin && m.user_id !== user?.id && (<div className="flex gap-1 shrink-0"><Select value={m.role} onValueChange={v => handleChangeRole(m.id, v)}><SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">{t("groups.admin")}</SelectItem><SelectItem value="member">{t("groups.member")}</SelectItem></SelectContent></Select><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveMember(m.id)}><UserMinus className="h-3.5 w-3.5 text-destructive" /></Button></div>)}</div>))}</div></CardContent></Card>
        </TabsContent>

        <TabsContent value="challenges" className="space-y-3 mt-4">
          {isAdmin && (
            <Button variant="outline" className="w-full gap-2" onClick={() => setShowNewChallenge(true)}>
              <Plus className="h-4 w-4" /> {t("challenges.newChallenge")}
            </Button>
          )}

          {showNewChallenge && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("challenges.challengeTitle")}</Label>
                  <Input value={newChallenge.title} onChange={e => setNewChallenge({ ...newChallenge, title: e.target.value })} placeholder={t("challenges.titlePlaceholder")} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("challenges.challengeDescription")}</Label>
                  <Textarea value={newChallenge.description} onChange={e => setNewChallenge({ ...newChallenge, description: e.target.value })} placeholder={t("challenges.descriptionPlaceholder")} rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("challenges.endDate")}</Label>
                  <Input type="date" value={newChallenge.end_date} onChange={e => setNewChallenge({ ...newChallenge, end_date: e.target.value })} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreateChallenge} disabled={!newChallenge.title.trim()}>{t("common.create")}</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowNewChallenge(false)}>{t("common.cancel")}</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {challenges.length === 0 && !showNewChallenge && (
            <div className="text-center py-8">
              <Trophy className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t("challenges.noChallenges")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("challenges.noChallengesDesc")}</p>
            </div>
          )}

          {challenges.map(c => (
            <ChallengeCard key={c.id} challenge={c} />
          ))}
        </TabsContent>

        <TabsContent value="chat" className="mt-4">
          <GroupChat groupId={id!} canAnnounce={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
