import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { buildEventMessage, BriefingTaskLike } from "@/lib/event-message";

interface Props {
  event: any;
  profiles: Record<string, string>;
  briefingTasks: BriefingTaskLike[];
  maneuverNames: string[];
}

export default function TelegramTextGenerator({ event, profiles, briefingTasks, maneuverNames }: Props) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";

  const handleCopy = async () => {
    const text = buildEventMessage({ event, profiles, briefingTasks, maneuverNames, locale, t });
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: t("events.telegramCopied") });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="outline" className="w-full gap-2" onClick={handleCopy}>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {t("events.copyTelegramText")}
    </Button>
  );
}
