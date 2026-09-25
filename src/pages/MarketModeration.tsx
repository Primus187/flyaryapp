import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Ban, Eye, EyeOff, HardDrive, RotateCcw, ShieldCheck, Star, Trash2, X } from "lucide-react";
import { Stars } from "@/components/market/Stars";
import { fetchReportedReviews, moderateReview, type ReportedReview } from "@/lib/marketplace-reviews";
import { Progress } from "@/components/ui/progress";
import { bucketsBySize, fetchStorageUsage, formatBytes, usageLevel, type StorageUsage } from "@/lib/storage-usage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/layout/EmptyState";
import LoadingState from "@/components/layout/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { marketErrorCode } from "@/lib/marketplace-listing";
import { fetchModerationQueue, moderateListing, setBan, type ModerationAction, type QueueItem } from "@/lib/marketplace-moderation";
import { deleteListing } from "@/lib/marketplace-photos";
import { ageLabel } from "@/lib/marketplace-search";

/** Moderation queue (plan 4.8): listings with open reports the viewer may handle. */
export default function MarketModeration() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  /** Admins: storage against the Free plan (plan 4.9). */
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  /** Reported reviews (plan 8.1), for Flyary admins and moderators. */
  const [reviews, setReviews] = useState<ReportedReview[]>([]);

  const load = useCallback(async () => {
    try {
      setItems(await fetchModerationQueue());
      setReviews(await fetchReportedReviews().catch(() => []));
    } catch {
      toast.error(t("market.errors.unknown"));
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void load();
    if (user) void supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      setIsAdmin(data === true);
      if (data === true) fetchStorageUsage().then(setUsage).catch(() => setUsage(null));
    });
  }, [load, user]);

  const run = async (item: QueueItem, work: () => Promise<unknown>, done: string) => {
    setBusy(item.listing_id);
    try {
      await work();
      toast.success(t(done));
      await load();
    } catch (e) {
      toast.error(t(`market.errors.${marketErrorCode(e)}`));
    }
    setBusy(null);
  };

  const moderate = (item: QueueItem, action: ModerationAction) => {
    let reason: string | undefined;
    if (action === "hide") {
      const answer = window.prompt(t("market.moderation.hideReason"));
      if (!answer?.trim()) return;
      reason = answer;
    }
    void run(item, () => moderateListing(item.listing_id, action, reason), `market.moderation.done.${action}`);
  };

  const ban = (item: QueueItem) => {
    if (!item.seller_id) return;
    if (item.seller_banned) {
      if (window.confirm(t("market.moderation.unbanConfirm", { name: item.seller_name ?? "" }))) {
        void run(item, () => setBan(item.seller_id!, false), "market.moderation.done.unban");
      }
      return;
    }
    const answer = window.prompt(t("market.moderation.banDays", { name: item.seller_name ?? "" }), "30");
    if (answer === null) return;
    const days = answer.trim() === "" || answer.trim() === "0" ? null : Number.parseInt(answer, 10);
    if (days !== null && (!Number.isInteger(days) || days < 1 || days > 3650)) return;
    void run(item, () => setBan(item.seller_id!, true, days, item.reasons.join(", ")), "market.moderation.done.ban");
  };

  const remove = (item: QueueItem) => {
    if (!window.confirm(t("market.moderation.deleteConfirm", { title: item.title }))) return;
    void run(item, () => deleteListing(item.listing_id), "market.moderation.done.delete");
  };

  const handleReview = async (review: ReportedReview, hide: boolean) => {
    setBusy(review.id);
    try {
      await moderateReview(review.id, hide);
      toast.success(t(hide ? "market.reviews.moderation.hidden" : "market.reviews.moderation.kept"));
      await load();
    } catch (e) {
      toast.error(t(`market.errors.${marketErrorCode(e)}`));
    }
    setBusy(null);
  };

  if (loading) return <LoadingState />;

  return (
    <PageContainer>
      <PageHeader title={t("market.moderation.title")} subtitle={t("market.moderation.subtitle")} back="/market" />
      {usage && (() => {
        const level = usageLevel(usage.total_bytes);
        return (
          <Card className={level.warn ? "border-amber-500/50" : undefined}>
            <CardContent className="space-y-2 p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <HardDrive className="h-4 w-4" /> {t("market.storage.title", { used: formatBytes(usage.total_bytes), percent: level.percent })}
              </p>
              <Progress value={level.percent} />
              <p className="text-[11px] text-muted-foreground">
                {bucketsBySize(usage).map(([bucket, bytes]) => `${bucket}: ${formatBytes(bytes)}`).join(" · ")}
              </p>
              {level.warn && <p className="text-xs text-amber-700 dark:text-amber-300">{t("market.storage.warn")}</p>}
            </CardContent>
          </Card>
        );
      })()}
      {reviews.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-3">
            <p className="flex items-center gap-2 text-sm font-medium"><Star className="h-4 w-4" /> {t("market.reviews.moderation.title")}</p>
            {reviews.map((r) => (
              <div key={r.id} className={busy === r.id ? "space-y-1 border-t pt-2 opacity-60" : "space-y-1 border-t pt-2"}>
                <div className="flex items-center gap-2"><Stars value={r.rating} /><span className="truncate text-xs text-muted-foreground">{r.listing_title}</span></div>
                {r.comment && <p className="whitespace-pre-wrap text-sm">{r.comment}</p>}
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" disabled={busy === r.id} onClick={() => void handleReview(r, true)}>
                    <EyeOff className="mr-1 h-3.5 w-3.5" />{t("market.reviews.moderation.hide")}
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => void handleReview(r, false)}>
                    <Eye className="mr-1 h-3.5 w-3.5" />{t("market.reviews.moderation.keep")}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {items.length === 0 && reviews.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={t("market.moderation.empty")} />
      ) : items.map((item) => (
        <Card key={item.listing_id} className={busy === item.listing_id ? "opacity-60" : undefined}>
          <CardContent className="space-y-2 p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[item.seller_name, item.is_school ? t("market.browse.school") : null, ageLabel(item.first_reported_at, i18n.language)].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Badge variant="destructive" className="shrink-0">{t("market.moderation.reports", { count: item.open_reports })}</Badge>
            </div>
            <div className="flex flex-wrap gap-1">
              {item.status === "removed" && <Badge variant="secondary">{t("market.moderation.hidden")}</Badge>}
              {item.seller_banned && <Badge variant="outline">{t("market.moderation.banned")}</Badge>}
              {item.reasons.map((r) => <Badge key={r} variant="outline">{t(`market.report.reasons.${r}`)}</Badge>)}
            </div>
            {item.removed_reason && <p className="text-xs text-muted-foreground">{item.removed_reason}</p>}
            {item.notes.map((n, i) => <p key={i} className="rounded bg-muted/50 px-2 py-1 text-xs">«{n}»</p>)}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Button size="sm" variant="outline" className="gap-1" onClick={() => navigate(`/market/${item.listing_id}`)}>
                <Eye className="h-3.5 w-3.5" />{t("market.moderation.open")}
              </Button>
              {item.status === "removed" ? (
                <Button size="sm" variant="outline" className="gap-1" disabled={!!busy} onClick={() => moderate(item, "restore")}>
                  <RotateCcw className="h-3.5 w-3.5" />{t("market.moderation.restore")}
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="gap-1" disabled={!!busy} onClick={() => moderate(item, "hide")}>
                  <EyeOff className="h-3.5 w-3.5" />{t("market.moderation.hide")}
                </Button>
              )}
              <Button size="sm" variant="ghost" className="gap-1" disabled={!!busy} onClick={() => moderate(item, "dismiss")}>
                <X className="h-3.5 w-3.5" />{t("market.moderation.dismiss")}
              </Button>
              {isAdmin && item.seller_id && (
                <Button size="sm" variant="ghost" className="gap-1" disabled={!!busy} onClick={() => ban(item)}>
                  <Ban className="h-3.5 w-3.5" />{item.seller_banned ? t("market.moderation.unban") : t("market.moderation.ban")}
                </Button>
              )}
              {isAdmin && (
                <Button size="sm" variant="ghost" className="gap-1 text-destructive" disabled={!!busy} onClick={() => remove(item)}>
                  <Trash2 className="h-3.5 w-3.5" />{t("market.moderation.delete")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </PageContainer>
  );
}
