import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus, Send, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { APP_VERSION } from "@/lib/app-update";
import {
  acceptScreenshots, FEEDBACK_KINDS, feedbackMailto, feedbackMessageValid, MAX_SCREENSHOTS, MESSAGE_MAX, submitFeedback, type FeedbackKind,
} from "@/lib/feedback";
import { cn } from "@/lib/utils";

/** Feedback from testers with up to three screenshots (migration 0086); e-mail stays as a fallback. */
export default function FeedbackDialog({ open, onOpenChange, mode }: { open: boolean; onOpenChange: (open: boolean) => void; mode: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [kind, setKind] = useState<FeedbackKind>("problem");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  // The page the feedback is about: the one "Mehr" was opened from is not known, so the current path is sent.
  const ctx = () => ({ path: window.location.pathname, appVersion: APP_VERSION, userAgent: navigator.userAgent });

  const reset = () => { setKind("problem"); setMessage(""); setFiles([]); };

  const send = async () => {
    if (!user || !feedbackMessageValid(message)) return;
    setSending(true);
    try {
      const result = await submitFeedback(user.id, kind, message, files, ctx());
      if (result.failed > 0) toast.warning(t("feedback.sentWithoutSome", { count: result.failed }));
      else toast.success(t("feedback.sent"));
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(/rate_limited/.test(e instanceof Error ? e.message : String((e as { message?: string })?.message)) ? t("feedback.rateLimited") : t("common.error"));
    }
    setSending(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!sending) onOpenChange(v); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("feedback.title")}</DialogTitle>
          <DialogDescription>{t("feedback.intro")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {FEEDBACK_KINDS.map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)}
                className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  kind === k ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground")}>
                {t(`feedback.kind.${k}`)}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="feedback-message" className="text-xs">{t("feedback.message")}</Label>
            <Textarea id="feedback-message" value={message} maxLength={MESSAGE_MAX} rows={5} placeholder={t(`feedback.placeholder.${kind}`)}
              onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium">{t("feedback.screenshots", { max: MAX_SCREENSHOTS })}</p>
            <div className="flex flex-wrap gap-2">
              {previews.map((url, i) => (
                <div key={url} className="relative h-20 w-20 overflow-hidden rounded-lg border">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button type="button" aria-label={t("common.delete")} onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}
                    className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              {files.length < MAX_SCREENSHOTS && (
                <button type="button" onClick={() => input.current?.click()}
                  className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-[11px] text-muted-foreground hover:bg-muted/50">
                  <ImagePlus className="h-5 w-5" />{t("feedback.addScreenshot")}
                </button>
              )}
            </div>
            <input ref={input} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => { setFiles((cur) => acceptScreenshots(cur, Array.from(e.target.files ?? []))); e.target.value = ""; }} />
            <p className="text-[11px] text-muted-foreground">{t("feedback.privacy")}</p>
          </div>
          <p className="text-[11px] text-muted-foreground">{t("feedback.context")}</p>
          <Button className="w-full gap-2" disabled={sending || !feedbackMessageValid(message)} onClick={() => void send()}>
            <Send className="h-4 w-4" />{sending ? t("feedback.sending") : t("feedback.send")}
          </Button>
          <p className="text-center text-xs">
            <a className="text-primary" href={feedbackMailto({ ...ctx(), mode })}>{t("feedback.byMail")}</a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
