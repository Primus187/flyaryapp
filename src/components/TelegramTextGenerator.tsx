import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  event: any;
  profiles: Record<string, string>;
  briefingTasks: { label: string; assigned_user_id: string | null }[];
  maneuverNames: string[];
}

export default function TelegramTextGenerator({ event, profiles, briefingTasks, maneuverNames }: Props) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";

  const generateText = () => {
    const d = new Date(event.event_date);
    const dateStr = d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const timeStr = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

    const lines: string[] = [];

    // Title + status
    const statusMap: Record<string, string> = {
      confirmed: t("events.statusConfirmed"),
      cancelled: t("events.statusCancelled"),
      announced: t("events.statusAnnounced"),
    };
    lines.push(`${event.title} ${dateStr} — ${statusMap[event.status] || event.status}`);
    lines.push("");

    // Meeting point / departure
    if (event.meeting_point) {
      lines.push(`${t("events.meetingPoint")}: ${event.meeting_point}`);
      lines.push(`${t("events.time")}: ${timeStr}`);
    }
    if (event.departure_info) {
      lines.push("");
      lines.push(event.departure_info);
    }
    lines.push("");

    // Flight area
    if (event.flight_area) {
      lines.push(`${t("events.flightArea")}: ${event.flight_area}`);
      lines.push("");
    }

    // Day topic
    if (event.day_topic) {
      lines.push(`${t("events.dayTopic")}: ${event.day_topic}`);
      lines.push("");
    }

    // Briefing tasks
    if (briefingTasks.length > 0) {
      lines.push(`${t("events.briefingLabel")}:`);
      briefingTasks.forEach((task) => {
        const name = task.assigned_user_id ? profiles[task.assigned_user_id] || "?" : "—";
        lines.push(`${task.label} → ${name}`);
      });
      lines.push("");
    }

    // Planned maneuvers
    if (maneuverNames.length > 0) {
      lines.push(`${t("events.plannedManeuvers")}:`);
      maneuverNames.forEach((m) => lines.push(`• ${m}`));
      lines.push("");
    }

    // Flight prep notes
    if (event.flight_prep_notes) {
      lines.push(`${t("events.flightPrep")}:`);
      lines.push(event.flight_prep_notes);
      lines.push("");
    }

    // Description
    if (event.description) {
      lines.push(event.description);
    }

    return lines.join("\n").trim();
  };

  const handleCopy = async () => {
    const text = generateText();
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
