import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { CHAT_INBOX_KEY } from "@/hooks/use-chat";
import { STUDENT_LEVELS, type ChannelAudience, type ChatChannel } from "@/lib/chat";

export interface ManagedGroup { id: string; name: string; group_type: string | null }

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- chat tables are not in the generated types.ts yet
const chatTable = (name: string) => supabase.from(name as any) as any;

/** Create or edit a group channel: free name, audience (everyone / team / students by level /
 *  selected people), team-only posting, archive. Rights are enforced by the database. */
export default function ChannelFormDialog({ open, onOpenChange, groups, channel, onSaved, onDeleted }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: ManagedGroup[];
  channel?: ChatChannel | null;
  onSaved?: (channelId: string) => void;
  onDeleted?: () => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const editing = !!channel;
  const [groupId, setGroupId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState<ChannelAudience>("all");
  const [levels, setLevels] = useState<string[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [initialMemberIds, setInitialMemberIds] = useState<string[]>([]);
  const [staffOnly, setStaffOnly] = useState(false);
  const [archived, setArchived] = useState(false);
  const [people, setPeople] = useState<{ user_id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setGroupId(channel?.group_id || groups[0]?.id || "");
    setName(channel?.name || "");
    setDescription(channel?.description || "");
    setAudience(channel?.audience || "all");
    setLevels(channel?.audience_levels || []);
    setStaffOnly(channel?.staff_only_posting || false);
    setArchived(!!channel?.archived_at);
    setMemberIds([]);
    setInitialMemberIds([]);
    if (channel) {
      chatTable("chat_channel_members").select("user_id").eq("channel_id", channel.id).then(({ data }: { data: { user_id: string }[] | null }) => {
        const ids = (data || []).map((m) => m.user_id);
        setMemberIds(ids);
        setInitialMemberIds(ids);
      });
    }
  }, [open, channel, groups]);

  const group = groups.find((g) => g.id === groupId) || (channel ? { id: channel.group_id!, name: channel.group_name || "", group_type: channel.group_type } : undefined);
  const isSchool = group?.group_type === "school";

  useEffect(() => {
    if (!open || !groupId) return;
    const load = async () => {
      const { data: members } = await supabase.from("group_members").select("user_id").eq("group_id", groupId);
      const ids = (members || []).map((m) => m.user_id);
      if (!ids.length) { setPeople([]); return; }
      const { data: profiles } = await supabase.from("profiles").select("user_id, pilot_name").in("user_id", ids);
      setPeople(ids.map((id) => ({ user_id: id, name: profiles?.find((p) => p.user_id === id)?.pilot_name || "Pilot" }))
        .sort((a, b) => a.name.localeCompare(b.name)));
    };
    void load();
  }, [open, groupId]);

  const audiences = useMemo<ChannelAudience[]>(() => (isSchool ? ["all", "team", "students", "custom"] : ["all", "custom"]), [isSchool]);
  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const save = async () => {
    if (!user || !groupId || !name.trim()) return;
    setSaving(true);
    try {
      const fields = {
        name: name.trim(),
        description: description.trim() || null,
        audience,
        audience_levels: audience === "students" && levels.length ? levels : null,
        staff_only_posting: staffOnly,
      };
      let channelId = channel?.id;
      if (editing) {
        const { error } = await chatTable("chat_channels").update({ ...fields, archived_at: archived ? channel!.archived_at || new Date().toISOString() : null }).eq("id", channel!.id);
        if (error) throw error;
      } else {
        const { data, error } = await chatTable("chat_channels")
          .insert({ ...fields, kind: "group", group_id: groupId, created_by: user.id }).select("id").single();
        if (error) throw error;
        channelId = data.id;
      }
      // Selected people: required for "custom", otherwise ignored.
      const wanted = audience === "custom" ? memberIds : [];
      const removed = initialMemberIds.filter((id) => !wanted.includes(id));
      const added = wanted.filter((id) => !initialMemberIds.includes(id));
      if (removed.length) {
        const { error } = await chatTable("chat_channel_members").delete().eq("channel_id", channelId).in("user_id", removed);
        if (error) throw error;
      }
      if (added.length) {
        const { error } = await chatTable("chat_channel_members").insert(added.map((id) => ({ channel_id: channelId, user_id: id, added_by: user.id })));
        if (error) throw error;
      }
      void queryClient.invalidateQueries({ queryKey: CHAT_INBOX_KEY(user.id) });
      void queryClient.invalidateQueries({ queryKey: ["chat-channel"] });
      toast({ title: editing ? t("chat.channelSaved") : t("chat.channelCreated") });
      onOpenChange(false);
      onSaved?.(channelId!);
    } catch (error) {
      toast({ title: t("common.error"), description: (error as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!channel || !confirm(t("chat.deleteChannelConfirm"))) return;
    const { error } = await chatTable("chat_channels").delete().eq("id", channel.id);
    if (error) { toast({ title: t("common.error"), description: error.message, variant: "destructive" }); return; }
    void queryClient.invalidateQueries({ queryKey: CHAT_INBOX_KEY(user?.id) });
    onOpenChange(false);
    onDeleted?.();
  };

  const lockAudience = !!channel?.is_default; // "Allgemein"/"Team" keep their audience

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? t("chat.editChannel") : t("chat.newChannel")}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {!editing && groups.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t("chat.group")}</Label>
              <Select value={groupId} onValueChange={(v) => { setGroupId(v); setAudience("all"); setMemberIds([]); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">{t("chat.channelName")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("chat.channelNamePlaceholder")} maxLength={60} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("chat.channelDescription")}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={300} />
          </div>

          {!lockAudience && (
            <div className="space-y-2">
              <Label className="text-xs">{t("chat.whoIsIn")}</Label>
              <div className="grid grid-cols-2 gap-2">
                {audiences.map((a) => (
                  <button key={a} type="button" onClick={() => setAudience(a)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${audience === a ? "border-primary bg-primary/10 font-medium" : "border-border hover:bg-muted/50"}`}>
                    {t(`chat.audience.${a}`)}
                    <span className="block text-[11px] font-normal text-muted-foreground">{t(`chat.audienceHint.${a}`)}</span>
                  </button>
                ))}
              </div>
              {audience === "students" && (
                <div className="rounded-lg bg-muted/40 p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">{t("chat.levelsHint")}</p>
                  {STUDENT_LEVELS.map((l) => (
                    <label key={l} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={levels.includes(l)} onCheckedChange={() => setLevels((prev) => toggle(prev, l))} />
                      {t(`chat.levels.${l}`)}
                    </label>
                  ))}
                </div>
              )}
              {audience === "custom" && (
                <div className="rounded-lg bg-muted/40 p-3 space-y-2 max-h-56 overflow-y-auto">
                  <p className="text-xs text-muted-foreground">{t("chat.pickPeople", { count: memberIds.length })}</p>
                  {people.map((p) => (
                    <label key={p.user_id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={memberIds.includes(p.user_id)} onCheckedChange={() => setMemberIds((prev) => toggle(prev, p.user_id))} />
                      {p.name}
                    </label>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">{t("chat.staffSeesAll")}</p>
            </div>
          )}

          <label className="flex items-center justify-between gap-3">
            <span className="text-sm">{t("chat.teamOnlyPostingOption")}<span className="block text-[11px] text-muted-foreground">{t("chat.teamOnlyPostingHint")}</span></span>
            <Switch checked={staffOnly} onCheckedChange={setStaffOnly} />
          </label>
          {editing && (
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm">{t("chat.archive")}<span className="block text-[11px] text-muted-foreground">{t("chat.archiveHint")}</span></span>
              <Switch checked={archived} onCheckedChange={setArchived} />
            </label>
          )}

          <div className="flex gap-2 pt-1">
            {editing && !channel?.is_default && (
              <Button variant="ghost" className="text-destructive" onClick={remove}>{t("common.delete")}</Button>
            )}
            <Button className="ml-auto" onClick={save} disabled={saving || !name.trim() || (audience === "custom" && memberIds.length === 0)}>
              {editing ? t("common.save") : t("chat.createChannel")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
