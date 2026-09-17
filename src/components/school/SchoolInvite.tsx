import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, QrCode, Share2 } from "lucide-react";

interface Props {
  groupId: string;
}

export default function SchoolInvite({ groupId }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [code, setCode] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    if (!groupId) return;
    supabase
      .from("groups")
      .select("invite_code")
      .eq("id", groupId)
      .maybeSingle()
      .then(({ data }) => setCode((data as any)?.invite_code || null));
  }, [groupId]);

  const link = code ? `${window.location.origin}/groups?invite=${code}` : "";

  useEffect(() => {
    if (!link) return;
    QRCode.toDataURL(link, { width: 320, margin: 1 }).then(setQr).catch(() => setQr(null));
  }, [link]);

  const message = `${t("school.invite.shareText")}\n${link}`;

  const copy = async () => {
    await navigator.clipboard.writeText(message);
    toast({ title: t("school.invite.copied") });
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: message });
        return;
      } catch {
        /* abgebrochen */
      }
    }
    copy();
  };

  if (!code) return null;

  return (
    <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur-sm">
      <CardContent className="p-4 space-y-3">
        <div>
          <p className="font-semibold text-sm">{t("school.invite.title")}</p>
          <p className="text-xs text-muted-foreground">{t("school.invite.hint")}</p>
        </div>
        <code className="block text-xs bg-muted rounded-md px-3 py-2 truncate">{link}</code>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 gap-1.5" onClick={share}>
            <Share2 className="h-3.5 w-3.5" /> {t("school.invite.share")}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={copy}>
            <Copy className="h-3.5 w-3.5" /> {t("groups.copy")}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowQr((v) => !v)}>
            <QrCode className="h-3.5 w-3.5" />
          </Button>
        </div>
        {showQr && qr && (
          <div className="flex flex-col items-center gap-2 pt-1">
            <img src={qr} alt={t("school.invite.qrAlt")} className="w-40 h-40 rounded-xl bg-background p-2" />
            <p className="text-[11px] text-muted-foreground text-center">{t("school.invite.steps")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
