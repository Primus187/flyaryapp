import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Send, Paperclip, Megaphone, Trash2, FileText, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/image-compress";

interface GroupMessage {
  id: string;
  group_id: string;
  user_id: string;
  message: string;
  attachment_path: string | null;
  is_announcement: boolean;
  is_team_only: boolean;
  created_at: string;
}

/**
 * `teamOnly` renders the internal team channel (Abschnitt 6.3) instead of the school-wide chat:
 * separate message set (is_team_only), no attachments (storage RLS only knows group membership,
 * not is_team_only, so team-only attachments could otherwise be fetched by any group member who
 * guesses the object path).
 */
export default function GroupChat({ groupId, canAnnounce = false, teamOnly = false }: { groupId: string; canAnnounce?: boolean; teamOnly?: boolean }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [announcement, setAnnouncement] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;

  const loadProfiles = useCallback(async (userIds: string[]) => {
    const unique = [...new Set(userIds)].filter((id) => !profilesRef.current[id]);
    if (unique.length === 0) return;
    const { data } = await supabase.from("profiles").select("user_id, pilot_name").in("user_id", unique);
    if (data) {
      setProfiles((prev) => {
        const next = { ...prev };
        data.forEach((p) => { next[p.user_id] = p.pilot_name || "Pilot"; });
        return next;
      });
    }
  }, []);

  const loadAttachmentUrls = useCallback(async (msgs: GroupMessage[]) => {
    const paths = msgs.map((m) => m.attachment_path).filter(Boolean) as string[];
    const missing = paths.filter((p) => !attachmentUrls[p]);
    if (missing.length === 0) return;
    const { data: signed } = await supabase.storage.from("chat-attachments").createSignedUrls(missing, 3600);
    if (signed) {
      setAttachmentUrls((prev) => {
        const next = { ...prev };
        signed.forEach((s) => { if (s.signedUrl) next[s.path] = s.signedUrl; });
        return next;
      });
    }
  }, [attachmentUrls]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("group_messages" as any)
        .select("*")
        .eq("group_id", groupId)
        .eq("is_team_only", teamOnly)
        .order("created_at", { ascending: true })
        .limit(200);
      if (data) {
        const msgs = data as unknown as GroupMessage[];
        setMessages(msgs);
        loadProfiles(msgs.map((m) => m.user_id));
        loadAttachmentUrls(msgs);
      }
    };
    load();

    const channel = supabase
      .channel(`group-chat-${groupId}-${teamOnly ? "team" : "all"}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` }, (payload) => {
        const msg = payload.new as GroupMessage;
        if (!!msg.is_team_only !== teamOnly) return;
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        loadProfiles([msg.user_id]);
        if (msg.attachment_path) loadAttachmentUrls([msg]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` }, (payload) => {
        setMessages((prev) => prev.filter((m) => m.id !== (payload.old as any).id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId, teamOnly, loadProfiles, loadAttachmentUrls]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    if ((!text.trim() && !pendingFile) || !user || sending) return;
    setSending(true);
    try {
      let attachmentPath: string | null = null;
      if (pendingFile && !teamOnly) {
        setUploading(true);
        let file: File | Blob = pendingFile;
        let name = pendingFile.name;
        if (pendingFile.type.startsWith("image/")) {
          const compressed = await compressImage(pendingFile);
          file = compressed;
          name = compressed.name;
        }
        attachmentPath = `chat/${groupId}/${user.id}/${Date.now()}_${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("chat-attachments").upload(attachmentPath, file);
        if (upErr) {
          toast({ title: t("chat.attachmentFailed"), variant: "destructive" });
          setSending(false); setUploading(false);
          return;
        }
        setUploading(false);
      }
      const isAnnouncement = announcement && canAnnounce;
      const { error } = await supabase.from("group_messages" as any).insert({
        group_id: groupId,
        user_id: user.id,
        message: text.trim(),
        attachment_path: attachmentPath,
        is_announcement: isAnnouncement,
        is_team_only: teamOnly,
      } as any);
      if (error) {
        toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      } else {
        setText("");
        setPendingFile(null);
        setAnnouncement(false);
      }
    } finally {
      setSending(false);
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteMessage = async (msg: GroupMessage) => {
    if (msg.attachment_path) {
      await supabase.storage.from("chat-attachments").remove([msg.attachment_path]);
    }
    await supabase.from("group_messages" as any).delete().eq("id", msg.id);
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
  };

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" });
  const isImage = (path: string) => /\.(jpe?g|png|webp|gif)$/i.test(path);

  const announcements = messages.filter((m) => m.is_announcement);
  const latestAnnouncement = announcements.length > 0 ? announcements[announcements.length - 1] : null;

  let lastDate = "";

  return (
    <div className="flex flex-col">
      {latestAnnouncement && (
        <div className="mb-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 flex items-start gap-2">
          <Megaphone className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">{t("chat.announcement")}</p>
            <p className="text-sm whitespace-pre-wrap break-words">{latestAnnouncement.message}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{profiles[latestAnnouncement.user_id] || "Pilot"} · {formatDate(latestAnnouncement.created_at)}</p>
          </div>
        </div>
      )}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <ScrollArea className="h-80 px-3 py-2">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">{t("events.noMessages")}</p>
          )}
          {messages.map((msg) => {
            const isMe = msg.user_id === user?.id;
            const msgDate = formatDate(msg.created_at);
            let showDate = false;
            if (msgDate !== lastDate) { showDate = true; lastDate = msgDate; }
            return (
              <div key={msg.id}>
                {showDate && (
                  <div className="flex justify-center my-2">
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{msgDate}</span>
                  </div>
                )}
                <div className={`flex mb-1.5 ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`group relative max-w-[78%] rounded-xl px-3 py-1.5 ${msg.is_announcement ? "bg-primary/10 border border-primary/30" : isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"}`}>
                    {msg.is_announcement && (
                      <Badge variant="outline" className="mb-1 text-[9px] h-4 gap-1 border-primary/40 text-primary">
                        <Megaphone className="h-2.5 w-2.5" /> {t("chat.announcement")}
                      </Badge>
                    )}
                    {!isMe && <p className="text-[10px] font-medium opacity-70 mb-0.5">{profiles[msg.user_id] || "Pilot"}</p>}
                    {msg.attachment_path && (
                      isImage(msg.attachment_path) ? (
                        <a href={attachmentUrls[msg.attachment_path]} target="_blank" rel="noopener noreferrer">
                          <img src={attachmentUrls[msg.attachment_path]} alt="" className="rounded-lg max-h-48 object-cover mb-1" loading="lazy" />
                        </a>
                      ) : (
                        <a href={attachmentUrls[msg.attachment_path]} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-1.5 text-xs underline mb-1 ${isMe && !msg.is_announcement ? "text-primary-foreground" : "text-primary"}`}>
                          <FileText className="h-3.5 w-3.5" /> {msg.attachment_path.split("/").pop()}
                        </a>
                      )
                    )}
                    {msg.message && <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>}
                    <div className={`flex items-center gap-1.5 mt-0.5 justify-end ${isMe && !msg.is_announcement ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      <p className="text-[9px]">{formatTime(msg.created_at)}</p>
                      {isMe && (
                        <button onClick={() => deleteMessage(msg)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </ScrollArea>

        {pendingFile && (
          <div className="flex items-center gap-2 px-2 py-1.5 border-t border-border bg-muted/30">
            {pendingFile.type.startsWith("image/") ? (
              <img src={URL.createObjectURL(pendingFile)} alt="" className="h-10 w-10 object-cover rounded" />
            ) : (
              <FileText className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-xs truncate flex-1">{pendingFile.name}</span>
            <button onClick={() => setPendingFile(null)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
          </div>
        )}

        {canAnnounce && (
          <div className="flex items-center gap-2 px-2 py-1.5 border-t border-border">
            <Switch id="announce" checked={announcement} onCheckedChange={setAnnouncement} />
            <Label htmlFor="announce" className="text-xs flex items-center gap-1 cursor-pointer">
              <Megaphone className="h-3 w-3" /> {t("chat.asAnnouncement")}
            </Label>
          </div>
        )}

        <div className="flex gap-2 p-2 border-t border-border">
          {!teamOnly && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf,.txt,.csv,.doc,.docx"
                onChange={(e) => setPendingFile(e.target.files?.[0] || null)}
              />
              <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <Paperclip className="h-4 w-4" />
              </Button>
            </>
          )}
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("events.typeMessage")}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            className="h-9 text-sm"
          />
          <Button size="icon" className="h-9 w-9 shrink-0" onClick={send} disabled={(!text.trim() && !pendingFile) || sending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
