import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface Message {
  id: string;
  event_id: string;
  user_id: string;
  message: string;
  created_at: string;
}

export default function EventChat({ eventId, groupId }: { eventId: string; groupId: string }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("event_messages")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });
      if (data) {
        setMessages(data);
        loadProfiles(data.map(m => m.user_id));
      }
    };
    load();

    const channel = supabase
      .channel(`event-chat-${eventId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "event_messages", filter: `event_id=eq.${eventId}` }, (payload) => {
        const msg = payload.new as Message;
        setMessages(prev => [...prev, msg]);
        loadProfiles([msg.user_id]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadProfiles = async (userIds: string[]) => {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return;
    const { data } = await supabase.from("profiles").select("user_id, pilot_name").in("user_id", unique);
    if (data) {
      setProfiles(prev => {
        const next = { ...prev };
        data.forEach(p => { next[p.user_id] = p.pilot_name || t("events.pilot"); });
        return next;
      });
    }
  };

  const send = async () => {
    if (!text.trim() || !user || sending) return;
    setSending(true);
    await supabase.from("event_messages").insert({ event_id: eventId, user_id: user.id, message: text.trim() });
    setText("");
    setSending(false);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" });
  };

  let lastDate = "";

  return (
    <div className="flex flex-col">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("events.chat")}</h2>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <ScrollArea className="h-72 px-3 py-2">
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
                  <div className={`max-w-[75%] rounded-xl px-3 py-1.5 ${isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"}`}>
                    {!isMe && <p className="text-[10px] font-medium opacity-70 mb-0.5">{profiles[msg.user_id] || t("events.pilot")}</p>}
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                    <p className={`text-[9px] mt-0.5 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"} text-right`}>{formatTime(msg.created_at)}</p>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </ScrollArea>
        <div className="flex gap-2 p-2 border-t border-border">
          <Input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={t("events.typeMessage")}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            className="h-9 text-sm"
          />
          <Button size="icon" className="h-9 w-9 shrink-0" onClick={send} disabled={!text.trim() || sending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
