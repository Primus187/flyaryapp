import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Copy, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { buildEventMessage, BriefingTaskLike } from "@/lib/event-message";

interface Props {
  event: any;
  profiles: Record<string, string>;
  briefingTasks: BriefingTaskLike[];
  maneuverNames: string[];
}

export default function EventAnnounceDialog({ event, profiles, briefingTasks, maneuverNames }: Props) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [audience, setAudience] = useState<"participants" | "group">("participants");
  const [sending, setSending] = useState(false);

  const openDialog = () => {
    setText(buildEventMessage({ event, profiles, briefingTasks, maneuverNames, locale, t }));
    setOpen(true);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    toast({ title: t("events.telegramCopied") });
  };

  const handleSend = async () => {
    setSending(true);
    const { data, error } = await supabase.functions.invoke("notify-event-participants", {
      body: { event_id: event.id, title: event.title, message: text, audience },
    });
    setSending(false);
    if (error) {
      toast({ title: t("events.notifyFailed"), variant: "destructive" });
      return;
    }
    toast({ title: t("events.notifySent", { count: (data as any)?.recipients ?? 0 }) });
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" className="w-full gap-2" onClick={openDialog}>
        <Bell className="h-4 w-4" />{t("events.notifyParticipants")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("events.notifyParticipants")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("events.notifyAudience")}</Label>
              <Select value={audience} onValueChange={v => setAudience(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="participants">{t("events.notifyAudienceParticipants")}</SelectItem>
                  <SelectItem value="group">{t("events.notifyAudienceGroup")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("events.notifyPreview")}</Label>
              <Textarea value={text} onChange={e => setText(e.target.value)} rows={16} className="text-xs font-mono whitespace-pre-wrap" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="gap-2" onClick={handleCopy}><Copy className="h-4 w-4" />{t("events.copyTelegramText")}</Button>
            <Button className="gap-2" onClick={handleSend} disabled={sending || !text.trim()}>
              <Send className="h-4 w-4" />{sending ? t("common.sending") : t("events.notifySend")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
