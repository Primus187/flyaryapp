import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Send, Paperclip, Megaphone, Trash2, FileText, X, CheckCheck, Lock, Reply, Copy, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/image-compress";
import { hasConfirmed, summarizeReceipts } from "@/lib/announcement-receipts";
import { CHAT_INBOX_KEY } from "@/hooks/use-chat";
import {
  extractMentions, groupReactions, insertMention, mentionQuery, mentionSuggestions, REACTION_EMOJIS, replySnippet, splitMentions,
  type ChatChannel, type MentionCandidate, type Reaction,
} from "@/lib/chat";

interface ChatMessage {
  id: string;
  channel_id: string;
  user_id: string;
  message: string;
  attachment_path: string | null;
  is_announcement: boolean;
  requires_confirmation: boolean;
  mentions?: string[];
  reply_to?: string | null;
  edited_at?: string | null;
  created_at: string;
}

const LONG_PRESS_MS = 450;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- chat tables are not in the generated types.ts yet
const chatTable = (name: string) => supabase.from(name as any) as any;

/**
 * One chat channel (migration 0025): group, event or direct. Access, posting and moderation rights
 * come from the database (chat_can_read/post/manage); this component only reflects them.
 * `fullHeight` fills the channel page; otherwise it is embedded (e.g. the event page's chat tab).
 * `focusMessageId` scrolls to and highlights one message (search results).
 */
export default function ChannelChat({ channel, fullHeight = false, focusMessageId }: { channel: ChatChannel; fullHeight?: boolean; focusMessageId?: string | null }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const channelId = channel.id;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [announcement, setAnnouncement] = useState(false);
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [readers, setReaders] = useState<MentionCandidate[]>([]);
  const [mentionQ, setMentionQ] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [flashId, setFlashId] = useState<string | null>(null);
  const focusedRef = useRef<string | null>(null);
  // Tap on a message → reactions; long press (or right click) → reply/copy/edit/delete.
  const [menu, setMenu] = useState<{ id: string; mode: "react" | "actions" } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const pressRef = useRef<{ timer: number; x: number; y: number; fired: boolean } | null>(null);
  const closedRef = useRef<{ id: string; at: number } | null>(null);
  const [receipts, setReceipts] = useState<Record<string, string[]>>({});
  const [expandedReceipts, setExpandedReceipts] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;

  const loadProfiles = useCallback(async (userIds: string[]) => {
    const unique = [...new Set(userIds)].filter((id) => !profilesRef.current[id]);
    if (unique.length === 0) return;
    const { data } = await supabase.from("profiles").select("user_id, pilot_name").in("user_id", unique);
    if (data) setProfiles((prev) => ({ ...prev, ...Object.fromEntries(data.map((p) => [p.user_id, p.pilot_name || "Pilot"])) }));
  }, []);

  const loadAttachmentUrls = useCallback(async (msgs: ChatMessage[]) => {
    const paths = msgs.map((m) => m.attachment_path).filter(Boolean) as string[];
    if (paths.length === 0) return;
    const { data: signed } = await supabase.storage.from("chat-attachments").createSignedUrls(paths, 3600);
    if (signed) setAttachmentUrls((prev) => ({ ...prev, ...Object.fromEntries(signed.filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl])) }));
  }, []);

  const loadReceipts = useCallback(async (msgs: ChatMessage[]) => {
    const ids = msgs.filter((m) => m.is_announcement && m.requires_confirmation).map((m) => m.id);
    if (ids.length === 0) return;
    const { data } = await chatTable("chat_message_receipts").select("message_id, user_id").in("message_id", ids);
    if (data) {
      setReceipts((prev) => {
        const next = { ...prev };
        (data as { message_id: string; user_id: string }[]).forEach((r) => { next[r.message_id] = [...new Set([...(next[r.message_id] || []), r.user_id])]; });
        return next;
      });
    }
  }, []);

  // All reactions of the channel (filtered through the message; a list of 200 ids would make the URL too long).
  const loadReactions = useCallback(async () => {
    const { data } = await chatTable("chat_message_reactions").select("message_id, user_id, emoji, chat_messages!inner(channel_id)")
      .eq("chat_messages.channel_id", channelId);
    if (data) setReactions((data as Reaction[]).map(({ message_id, user_id, emoji }) => ({ message_id, user_id, emoji })));
  }, [channelId]);

  // Opening (and reading new messages in) the channel resets its unread count.
  const markRead = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not in generated types.ts yet
    await supabase.rpc("chat_mark_read" as any, { _channel: channelId } as any);
    void queryClient.invalidateQueries({ queryKey: CHAT_INBOX_KEY(user?.id) });
  }, [channelId, queryClient, user?.id]);

  useEffect(() => {
    // Who can read the channel: for "X of Y confirmed" and author names.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not in generated types.ts yet
    supabase.rpc("chat_channel_readers" as any, { _channel: channelId } as any).then(({ data }) => {
      const rows = (data as { user_id: string; pilot_name: string }[] | null) || [];
      setReaders(rows.map((r) => ({ user_id: r.user_id, name: r.pilot_name || "" })));
      setProfiles((prev) => ({ ...prev, ...Object.fromEntries(rows.map((r) => [r.user_id, r.pilot_name || "Pilot"])) }));
    });
  }, [channelId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await chatTable("chat_messages").select("*").eq("channel_id", channelId)
        .order("created_at", { ascending: false }).limit(200);
      if (cancelled || !data) return;
      const msgs = (data as ChatMessage[]).reverse();
      setMessages(msgs);
      loadProfiles(msgs.map((m) => m.user_id));
      loadAttachmentUrls(msgs);
      loadReceipts(msgs);
      loadReactions();
      void markRead();
    };
    void load();

    const realtime = supabase
      .channel(`chat-channel-${channelId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel_id=eq.${channelId}` }, (payload) => {
        const msg = payload.new as ChatMessage;
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        loadProfiles([msg.user_id]);
        if (msg.attachment_path) loadAttachmentUrls([msg]);
        void markRead();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages", filter: `channel_id=eq.${channelId}` }, (payload) => {
        const msg = payload.new as ChatMessage;
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_messages" }, (payload) => {
        const removed = (payload.old as { id?: string }).id;
        if (removed) setMessages((prev) => prev.filter((m) => m.id !== removed));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_message_receipts" }, (payload) => {
        const receipt = payload.new as { message_id: string; user_id: string };
        setReceipts((prev) => ({ ...prev, [receipt.message_id]: [...new Set([...(prev[receipt.message_id] || []), receipt.user_id])] }));
      })
      // Reactions of other channels arrive too (no channel column to filter on); they never match a shown message.
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_message_reactions" }, (payload) => {
        const r = payload.new as Reaction;
        setReactions((prev) => (prev.some((x) => x.message_id === r.message_id && x.user_id === r.user_id && x.emoji === r.emoji) ? prev : [...prev, r]));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_message_reactions" }, (payload) => {
        const r = payload.old as Partial<Reaction>;
        setReactions((prev) => prev.filter((x) => !(x.message_id === r.message_id && x.user_id === r.user_id && x.emoji === r.emoji)));
      })
      .subscribe();
    return () => { cancelled = true; void supabase.removeChannel(realtime); };
  }, [channelId, loadProfiles, loadAttachmentUrls, loadReceipts, loadReactions, markRead]);

  useEffect(() => {
    // A message to jump to (search result): scroll there once it is loaded, otherwise stay at the bottom.
    if (focusMessageId && focusedRef.current !== focusMessageId) {
      const el = document.getElementById(`msg-${focusMessageId}`);
      if (el) {
        focusedRef.current = focusMessageId;
        el.scrollIntoView({ block: "center" });
        setFlashId(focusMessageId);
        window.setTimeout(() => setFlashId(null), 2000);
      }
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, focusMessageId]);

  const scrollToMessage = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashId(id);
    window.setTimeout(() => setFlashId(null), 1500);
  };

  const toggleReaction = async (msg: ChatMessage, emoji: string) => {
    if (!user) return;
    const mine = reactions.some((r) => r.message_id === msg.id && r.user_id === user.id && r.emoji === emoji);
    const row = { message_id: msg.id, user_id: user.id, emoji };
    // Optimistic; realtime echoes are de-duplicated above.
    setReactions((prev) => (mine ? prev.filter((r) => !(r.message_id === msg.id && r.user_id === user.id && r.emoji === emoji)) : [...prev, row]));
    const { error } = mine
      ? await chatTable("chat_message_reactions").delete().eq("message_id", msg.id).eq("user_id", user.id).eq("emoji", emoji)
      : await chatTable("chat_message_reactions").insert(row);
    if (error && error.code !== "23505") {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      setReactions((prev) => (mine ? [...prev, row] : prev.filter((r) => !(r.message_id === msg.id && r.user_id === user.id && r.emoji === emoji))));
    }
  };

  const startReply = (msg: ChatMessage) => {
    setEditing(null);
    setReplyTo(msg);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const startEdit = (msg: ChatMessage) => {
    setReplyTo(null);
    setEditing(msg);
    setText(msg.message);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const cancelEdit = () => { setEditing(null); setText(""); };

  const copyMessage = async (msg: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(msg.message);
      toast({ title: t("chat.copied") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  const openMenu = (id: string, mode: "react" | "actions") => {
    setConfirmDelete(false);
    setMenu({ id, mode });
  };

  // Gesture handlers for one bubble. Taps on links/buttons inside (images, reply quote, reaction chips) keep their own action.
  const bubbleHandlers = (msg: ChatMessage) => {
    const interactive = (target: EventTarget) => !!(target as HTMLElement).closest("a, button");
    const clear = () => { if (pressRef.current) window.clearTimeout(pressRef.current.timer); };
    return {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.button !== 0 || interactive(e.target)) return;
        clear();
        const press = { x: e.clientX, y: e.clientY, fired: false, timer: 0 };
        press.timer = window.setTimeout(() => {
          press.fired = true;
          navigator.vibrate?.(10);
          openMenu(msg.id, "actions");
        }, LONG_PRESS_MS);
        pressRef.current = press;
      },
      onPointerMove: (e: React.PointerEvent) => {
        const press = pressRef.current;
        if (press && !press.fired && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) clear();
      },
      onPointerUp: clear,
      onPointerCancel: clear,
      onPointerLeave: clear,
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault();
        clear();
        openMenu(msg.id, "actions");
      },
      onClick: (e: React.MouseEvent) => {
        if (pressRef.current?.fired) { pressRef.current = null; return; }
        if (interactive(e.target)) return;
        // The tap that closed this message's menu (pointerdown outside) must not reopen it.
        const closed = closedRef.current;
        if (closed && closed.id === msg.id && Date.now() - closed.at < 400) return;
        openMenu(msg.id, "react");
      },
    };
  };

  const saveEdit = async () => {
    if (!editing || sending) return;
    setSending(true);
    try {
      const mentions = channel.kind === "direct" ? [] : extractMentions(text, readers);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not in generated types.ts yet
      const { error } = await supabase.rpc("chat_edit_message" as any, { _message: editing.id, _text: text, _mentions: mentions } as any);
      if (error) {
        toast({ title: t("common.error"), description: error.message, variant: "destructive" });
        return;
      }
      const edited = { message: text.trim(), mentions, edited_at: new Date().toISOString() };
      setMessages((prev) => prev.map((m) => (m.id === editing.id ? { ...m, ...edited } : m)));
      cancelEdit();
    } finally {
      setSending(false);
    }
  };

  const send = async () => {
    if (editing) { await saveEdit(); return; }
    if ((!text.trim() && !pendingFile) || !user || sending || !channel.can_post) return;
    setSending(true);
    try {
      let attachmentPath: string | null = null;
      if (pendingFile) {
        setUploading(true);
        let file: File | Blob = pendingFile;
        let name = pendingFile.name;
        if (pendingFile.type.startsWith("image/")) {
          const compressed = await compressImage(pendingFile);
          file = compressed;
          name = compressed.name;
        }
        // channel/<channel>/<user>/<file>: storage policies check the channel's read/post rights.
        attachmentPath = `channel/${channelId}/${user.id}/${Date.now()}_${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("chat-attachments").upload(attachmentPath, file);
        if (upErr) {
          toast({ title: t("chat.attachmentFailed"), variant: "destructive" });
          return;
        }
      }
      const isAnnouncement = announcement && channel.can_manage;
      const { error } = await chatTable("chat_messages").insert({
        channel_id: channelId,
        user_id: user.id,
        message: text.trim(),
        // Replying notifies the replied-to author like a mention (direct channels push every message anyway).
        mentions: [...new Set([...extractMentions(text, readers),
          ...(replyTo && replyTo.user_id !== user.id && channel.kind !== "direct" ? [replyTo.user_id] : [])])],
        reply_to: replyTo?.id ?? null,
        attachment_path: attachmentPath,
        is_announcement: isAnnouncement,
        requires_confirmation: isAnnouncement && requiresConfirmation,
      });
      if (error) {
        toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      } else {
        setText("");
        setReplyTo(null);
        setPendingFile(null);
        setAnnouncement(false);
        setRequiresConfirmation(false);
      }
    } finally {
      setSending(false);
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteMessage = async (msg: ChatMessage) => {
    if (msg.attachment_path) await supabase.storage.from("chat-attachments").remove([msg.attachment_path]);
    const { error } = await chatTable("chat_messages").delete().eq("id", msg.id);
    if (error) { toast({ title: t("common.error"), description: error.message, variant: "destructive" }); return; }
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
  };

  const confirmReceipt = async (msg: ChatMessage) => {
    if (!user) return;
    const { error } = await chatTable("chat_message_receipts").insert({ message_id: msg.id, user_id: user.id });
    // A duplicate key (already confirmed) is not an error here.
    if (error && error.code !== "23505") {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      return;
    }
    setReceipts((prev) => ({ ...prev, [msg.id]: [...new Set([...(prev[msg.id] || []), user.id])] }));
  };

  const readerIds = readers.map((r) => r.user_id);
  const readerNames = readers.map((r) => r.name);
  const suggestions = mentionQ === null ? [] : mentionSuggestions(readers, mentionQ, user?.id);

  const onTextChange = (value: string, cursor: number | null) => {
    setText(value);
    setMentionQ(mentionQuery(value.slice(0, cursor ?? value.length)));
    setMentionIndex(0);
  };

  const pickMention = (candidate: MentionCandidate) => {
    const input = inputRef.current;
    const next = insertMention(text, input?.selectionStart ?? text.length, candidate.name);
    setText(next.text);
    setMentionQ(null);
    requestAnimationFrame(() => { input?.focus(); input?.setSelectionRange(next.cursor, next.cursor); });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setMentionIndex((i) => (i + step + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pickMention(suggestions[Math.min(mentionIndex, suggestions.length - 1)]);
        return;
      }
      if (e.key === "Escape") { setMentionQ(null); return; }
    }
    if (e.key === "Escape" && editing) { cancelEdit(); return; }
    if (e.key === "Escape" && replyTo) { setReplyTo(null); return; }
    if (e.key === "Enter" && !e.shiftKey) void send();
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
            <p className="text-sm whitespace-pre-wrap break-words line-clamp-3">{latestAnnouncement.message}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{profiles[latestAnnouncement.user_id] || "Pilot"} · {formatDate(latestAnnouncement.created_at)}</p>
          </div>
        </div>
      )}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Radix wraps the content in a display:table div that grows with unbreakable content (long links,
            one-line quotes) and pushes the chat off screen; keep it as wide as the viewport. */}
        <ScrollArea className={`${fullHeight ? "h-[calc(100dvh-19rem)] min-h-[16rem]" : "h-80"} px-3 py-2 [&_[data-radix-scroll-area-viewport]>div]:!block`}>
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">{t("events.noMessages")}</p>
          )}
          {messages.map((msg) => {
            const isMe = msg.user_id === user?.id;
            const msgDate = formatDate(msg.created_at);
            const showDate = msgDate !== lastDate;
            lastDate = msgDate;
            const canDelete = isMe || channel.can_manage;
            const mentionsMe = !isMe && !!user && (msg.mentions || []).includes(user.id);
            const parent = msg.reply_to ? messages.find((m) => m.id === msg.reply_to) : null;
            const ownBubble = isMe && !msg.is_announcement;
            const msgReactions = groupReactions(reactions.filter((r) => r.message_id === msg.id), user?.id);
            return (
              <div key={msg.id} id={`msg-${msg.id}`} className={`rounded-lg transition-colors duration-700 ${flashId === msg.id ? "bg-amber-300/30" : ""}`}>
                {showDate && (
                  <div className="flex justify-center my-2">
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{msgDate}</span>
                  </div>
                )}
                <div className={`flex mb-1.5 ${isMe ? "justify-end" : "justify-start"}`}>
                  <Popover open={menu?.id === msg.id} onOpenChange={(open) => {
                    if (!open) { closedRef.current = { id: msg.id, at: Date.now() }; setMenu(null); }
                  }}>
                  <PopoverAnchor asChild>
                  <div {...bubbleHandlers(msg)}
                    className={`group relative max-w-[78%] rounded-xl px-3 py-1.5 cursor-pointer select-none [-webkit-touch-callout:none] transition-transform ${menu?.id === msg.id ? "scale-[0.98] brightness-95" : ""} ${msg.is_announcement ? "bg-primary/10 border border-primary/30" : isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"}${mentionsMe ? " ring-2 ring-amber-400/70" : ""}`}>
                    {msg.is_announcement && (
                      <Badge variant="outline" className="mb-1 text-[9px] h-4 gap-1 border-primary/40 text-primary">
                        <Megaphone className="h-2.5 w-2.5" /> {t("chat.announcement")}
                      </Badge>
                    )}
                    {!isMe && channel.kind !== "direct" && <p className="text-[10px] font-medium opacity-70 mb-0.5">{profiles[msg.user_id] || "Pilot"}</p>}
                    {msg.reply_to && (
                      <button type="button" onClick={() => parent && scrollToMessage(parent.id)}
                        className={`mb-1 block w-full rounded-md border-l-2 px-2 py-1 text-left text-[11px] ${ownBubble ? "border-primary-foreground/60 bg-primary-foreground/15" : "border-primary/60 bg-background/60"}`}>
                        {parent ? (
                          <>
                            <span className="block font-semibold">{profiles[parent.user_id] || "Pilot"}</span>
                            <span className="line-clamp-2 [overflow-wrap:anywhere] opacity-80">{replySnippet(parent.message, !!parent.attachment_path)}</span>
                          </>
                        ) : (
                          <span className="italic opacity-80">{t("chat.replyUnavailable")}</span>
                        )}
                      </button>
                    )}
                    {msg.attachment_path && (
                      isImage(msg.attachment_path) ? (
                        <a href={attachmentUrls[msg.attachment_path]} target="_blank" rel="noopener noreferrer">
                          <img src={attachmentUrls[msg.attachment_path]} alt="" className="rounded-lg max-h-48 object-cover mb-1" loading="lazy" />
                        </a>
                      ) : (
                        <a href={attachmentUrls[msg.attachment_path]} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-1.5 text-xs underline mb-1 ${isMe && !msg.is_announcement ? "text-primary-foreground" : "text-primary"}`}>
                          <FileText className="h-3.5 w-3.5" /> {msg.attachment_path.split("/").pop()?.replace(/^\d+_/, "")}
                        </a>
                      )
                    )}
                    {msg.message && (
                      <p className="text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">
                        {splitMentions(msg.message, readerNames).map((part, i) => part.mention
                          ? <span key={i} className={`font-semibold ${isMe && !msg.is_announcement ? "underline" : "text-primary"}`}>{part.text}</span>
                          : <span key={i}>{part.text}</span>)}
                      </p>
                    )}
                    {msg.is_announcement && msg.requires_confirmation && (
                      <div className="mt-1.5 pt-1.5 border-t border-primary/20 space-y-1">
                        {user && hasConfirmed(receipts[msg.id] || [], user.id) ? (
                          <p className="text-[10px] flex items-center gap-1 text-green-600 dark:text-green-400">
                            <CheckCheck className="h-3 w-3" /> {t("chat.confirmed")}
                          </p>
                        ) : (
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1" onClick={() => confirmReceipt(msg)}>
                            <CheckCheck className="h-3 w-3" /> {t("chat.confirmReceipt")}
                          </Button>
                        )}
                        {(() => {
                          const summary = summarizeReceipts(readerIds.filter((id) => id !== msg.user_id), receipts[msg.id] || []);
                          const expanded = expandedReceipts === msg.id;
                          return (
                            <div>
                              <button type="button" className="text-[10px] underline text-muted-foreground" onClick={() => setExpandedReceipts(expanded ? null : msg.id)}>
                                {t("chat.receiptSummary", { confirmed: summary.confirmedCount, total: summary.totalCount })}
                              </button>
                              {expanded && summary.pendingUserIds.length > 0 && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {t("chat.receiptPending")}: {summary.pendingUserIds.map((id) => profiles[id] || "Pilot").join(", ")}
                                </p>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    {msgReactions.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {msgReactions.map((r) => (
                          <button key={r.emoji} type="button" onClick={() => toggleReaction(msg, r.emoji)}
                            title={r.userIds.map((id) => profiles[id] || "Pilot").join(", ")}
                            aria-pressed={r.mine}
                            className={`flex h-5 items-center gap-0.5 rounded-full border px-1.5 text-[11px] ${r.mine
                              ? "border-primary bg-primary/15 text-foreground"
                              : ownBubble ? "border-primary-foreground/30 bg-primary-foreground/10" : "border-border bg-background/70"}`}>
                            <span>{r.emoji}</span><span className="tabular-nums">{r.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className={`flex items-center gap-1.5 mt-0.5 justify-end ${ownBubble ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {msg.edited_at && <p className="text-[9px] italic">{t("chat.edited")}</p>}
                      <p className="text-[9px]">{formatTime(msg.created_at)}</p>
                    </div>
                  </div>
                  </PopoverAnchor>
                  {menu?.id === msg.id && (
                    menu.mode === "react" ? (
                      <PopoverContent side="top" align={isMe ? "end" : "start"} className="w-auto rounded-full p-1">
                        <div className="flex gap-0.5">
                          {REACTION_EMOJIS.map((emoji) => {
                            const mine = msgReactions.some((r) => r.emoji === emoji && r.mine);
                            return (
                              <button key={emoji} type="button" aria-pressed={mine} aria-label={emoji}
                                onClick={() => { void toggleReaction(msg, emoji); setMenu(null); }}
                                className={`h-10 w-10 rounded-full text-2xl active:scale-90 transition-transform ${mine ? "bg-primary/20" : "hover:bg-accent"}`}>
                                {emoji}
                              </button>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    ) : (
                      <PopoverContent side="bottom" align={isMe ? "end" : "start"} className="w-52 p-1">
                        {confirmDelete ? (
                          <div className="space-y-1 p-1">
                            <p className="px-1 text-sm">{t("chat.deleteConfirm")}</p>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="flex-1" onClick={() => setConfirmDelete(false)}>{t("common.cancel")}</Button>
                              <Button size="sm" variant="destructive" className="flex-1" onClick={() => { void deleteMessage(msg); setMenu(null); }}>{t("common.delete")}</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            {channel.can_post && (
                              <MenuAction icon={Reply} label={t("chat.reply")} onClick={() => { startReply(msg); setMenu(null); }} />
                            )}
                            {msg.message && (
                              <MenuAction icon={Copy} label={t("chat.copy")} onClick={() => { void copyMessage(msg); setMenu(null); }} />
                            )}
                            {isMe && channel.can_post && (
                              <MenuAction icon={Pencil} label={t("common.edit")} onClick={() => { startEdit(msg); setMenu(null); }} />
                            )}
                            {canDelete && (
                              <MenuAction icon={Trash2} label={t("common.delete")} destructive onClick={() => setConfirmDelete(true)} />
                            )}
                          </div>
                        )}
                      </PopoverContent>
                    )
                  )}
                  </Popover>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </ScrollArea>

        {!channel.can_post ? (
          <p className="flex items-center justify-center gap-1.5 px-3 py-3 border-t border-border text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> {channel.archived_at ? t("chat.archivedReadOnly") : t("chat.teamOnlyPosting")}
          </p>
        ) : (
          <>
            {editing && (
              <div className="flex items-center gap-2 px-2 py-1.5 border-t border-border bg-muted/30">
                <Pencil className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1 text-xs">
                  <p className="font-semibold">{t("chat.editing")}</p>
                  <p className="truncate text-muted-foreground">{replySnippet(editing.message, !!editing.attachment_path)}</p>
                </div>
                <button type="button" onClick={cancelEdit} aria-label={t("common.cancel")}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
              </div>
            )}
            {replyTo && (
              <div className="flex items-center gap-2 px-2 py-1.5 border-t border-border bg-muted/30">
                <Reply className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1 text-xs">
                  <p className="font-semibold">{t("chat.replyingTo", { name: profiles[replyTo.user_id] || "Pilot" })}</p>
                  <p className="truncate text-muted-foreground">{replySnippet(replyTo.message, !!replyTo.attachment_path)}</p>
                </div>
                <button type="button" onClick={() => setReplyTo(null)} aria-label={t("common.cancel")}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
              </div>
            )}
            {pendingFile && (
              <div className="flex items-center gap-2 px-2 py-1.5 border-t border-border bg-muted/30">
                {pendingFile.type.startsWith("image/") ? (
                  <img src={URL.createObjectURL(pendingFile)} alt="" className="h-10 w-10 object-cover rounded" />
                ) : (
                  <FileText className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-xs truncate flex-1">{pendingFile.name}</span>
                <button onClick={() => setPendingFile(null)} aria-label={t("common.delete")}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
              </div>
            )}
            {channel.can_manage && !editing && (
              <div className="flex flex-col gap-1.5 px-2 py-1.5 border-t border-border">
                <div className="flex items-center gap-2">
                  <Switch id={`announce-${channelId}`} checked={announcement} onCheckedChange={(v) => { setAnnouncement(v); if (!v) setRequiresConfirmation(false); }} />
                  <Label htmlFor={`announce-${channelId}`} className="text-xs flex items-center gap-1 cursor-pointer">
                    <Megaphone className="h-3 w-3" /> {t("chat.asAnnouncement")}
                  </Label>
                </div>
                {announcement && (
                  <div className="flex items-center gap-2 pl-1">
                    <Switch id={`confirm-${channelId}`} checked={requiresConfirmation} onCheckedChange={setRequiresConfirmation} />
                    <Label htmlFor={`confirm-${channelId}`} className="text-xs flex items-center gap-1 cursor-pointer">
                      <CheckCheck className="h-3 w-3" /> {t("chat.requireConfirmation")}
                    </Label>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2 p-2 border-t border-border">
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.txt,.csv,.doc,.docx"
                onChange={(e) => setPendingFile(e.target.files?.[0] || null)} />
              <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => fileInputRef.current?.click()} disabled={uploading || !!editing} aria-label={t("chat.attach")}>
                <Paperclip className="h-4 w-4" />
              </Button>
              <div className="relative flex-1">
                {suggestions.length > 0 && (
                  <ul role="listbox" aria-label={t("chat.mentionSomeone")} className="absolute bottom-full left-0 z-20 mb-1 w-full max-w-xs overflow-hidden rounded-md border bg-popover py-1 text-sm shadow-md">
                    {suggestions.map((s, i) => (
                      <li key={s.user_id} role="option" aria-selected={i === mentionIndex}>
                        <button type="button" onMouseDown={(e) => { e.preventDefault(); pickMention(s); }}
                          className={`w-full px-3 py-1.5 text-left ${i === mentionIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"}`}>
                          @{s.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <Input ref={inputRef} value={text} onChange={(e) => onTextChange(e.target.value, e.target.selectionStart)}
                  onBlur={() => setMentionQ(null)} placeholder={channel.kind === "direct" ? t("events.typeMessage") : t("chat.typeMessageMention")}
                  onKeyDown={onKeyDown} className="h-9 text-sm" />
              </div>
              <Button size="icon" className="h-9 w-9 shrink-0" onClick={send} disabled={(!text.trim() && !pendingFile) || sending} aria-label={t("chat.send")}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MenuAction({ icon: Icon, label, onClick, destructive = false }: {
  icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; destructive?: boolean;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-3 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent ${destructive ? "text-destructive" : ""}`}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
