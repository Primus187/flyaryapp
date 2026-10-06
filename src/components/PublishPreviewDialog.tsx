import { useId, useState, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Heart, MessageCircle, MapPin, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSiteName } from "@/lib/official-sites-store";
import { youtubeEmbedUrl, youtubeLink } from "@/lib/youtube";

const FlightDetailMap = lazy(() => import("@/components/FlightDetailMap"));

interface PublishPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPublish: (selectedPhotoIds: string[], feedComment: string) => void;
  flight: {
    date: string;
    glider: string | null;
    duration_minutes: number | null;
    altitude_gain: number | null;
    distance_km: number | null;
    comments: string | null;
    takeoff?: { name: string; latitude: number; longitude: number } | null;
    landing?: { name: string; latitude: number; longitude: number } | null;
  };
  pilotName: string;
  avatarUrl: string;
  groupName: string;
  photos: { id: string; url: string }[];
  videoUrls?: string[];
  trackPoints: [number, number][];
  loading?: boolean;
}

export default function PublishPreviewDialog({
  open, onOpenChange, onPublish, flight, pilotName, avatarUrl, groupName,
  photos, videoUrls, trackPoints, loading,
}: PublishPreviewDialogProps) {
  const { t } = useTranslation();
  const siteName = useSiteName();
  const descriptionId = useId();
  const [feedComment, setFeedComment] = useState(flight.comments || "");
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>(photos.map(p => p.id));

  const initials = pilotName?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
  const hasTrack = trackPoints.length > 0;
  const hasMap = hasTrack || [flight.takeoff, flight.landing].some(
    location => location && (location.latitude !== 0 || location.longitude !== 0)
  );
  const selectedPhotos = photos.filter(p => selectedPhotoIds.includes(p.id));

  const formatDuration = (min: number) => {
    const h = Math.floor(min / 60); const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const togglePhoto = (id: string) => {
    setSelectedPhotoIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex w-[calc(100%_-_2rem)] max-w-md max-h-[calc(100dvh_-_2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0">
        <DialogHeader className="shrink-0 p-4 pr-12 text-left">
          <DialogTitle className="text-base">{t("flights.feedPreview")}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 min-w-0 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4">
          {/* Preview card */}
          <Card className="min-w-0 overflow-hidden border">
            {/* Header */}
            <div className="flex items-center gap-3 px-3.5 pt-3.5 pb-3">
              <div className="shrink-0 rounded-[34%]">
                <Avatar className="h-11 w-11">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="text-sm bg-hero text-hero-foreground">{initials}</AvatarFallback>
                </Avatar>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold [overflow-wrap:anywhere]">{pilotName}</p>
                <p className="text-xs font-medium leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                  {groupName && <span>{groupName} · </span>}
                  {flight.takeoff?.name && <><MapPin className="h-3 w-3 inline mr-0.5" />{siteName(flight.takeoff.name)} · </>}
                  {t("feed.justNow")}
                </p>
              </div>
            </div>

            {/* Videos preview */}
            {videoUrls && videoUrls.length > 0 && videoUrls.map((url, i) => {
              const embedUrl = youtubeEmbedUrl(url);
              return embedUrl ? (
                <div key={`vid-${i}`} className="relative w-full aspect-video bg-muted">
                  <iframe src={embedUrl} title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="absolute inset-0 w-full h-full" />
                </div>
              ) : youtubeLink(url) ? (
                <a
                  key={`vid-${i}`}
                  href={youtubeLink(url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-3 py-2 text-sm text-primary underline underline-offset-2"
                >
                  {t("flights.watchVideo")}
                </a>
              ) : null;
            })}

            {/* Selected photos preview */}
            {selectedPhotos.length > 0 && (
              <div className="aspect-square w-full overflow-hidden bg-muted">
                <img src={selectedPhotos[0].url} alt="" className="w-full h-full object-cover" />
              </div>
            )}

            {/* Mini map */}
            {hasMap && (
              <Suspense fallback={<div className="h-[120px] bg-muted animate-pulse" />}>
                <div className="[&_.leaflet-container]:!h-[120px] [&>div]:!h-[120px]" style={{ height: 120, overflow: "hidden" }}>
                  <FlightDetailMap
                    takeoff={flight.takeoff || null}
                    landing={flight.landing || null}
                    trackPoints={trackPoints}
                  />
                </div>
              </Suspense>
            )}

            {/* Actions preview (non-interactive) */}
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-3 opacity-50">
                <Heart className="h-5 w-5" />
                <MessageCircle className="h-5 w-5" />
              </div>

              {/* Flight stats */}
              <div className="grid grid-cols-3 gap-2 rounded-lg bg-background px-3 py-2.5 [overflow-wrap:anywhere]">
                {flight.duration_minutes && <div><p className="text-[15px] stat-value">{formatDuration(flight.duration_minutes)}</p><p className="text-[11px] font-semibold text-muted-foreground">{t("dashboard.flightTime")}</p></div>}
                {flight.altitude_gain && <div><p className="text-[15px] stat-value">{flight.altitude_gain} m</p><p className="text-[11px] font-semibold text-muted-foreground">{t("stats.altitudeGain")}</p></div>}
                {flight.distance_km && <div><p className="text-[15px] stat-value">{Number(flight.distance_km).toFixed(1)} km</p><p className="text-[11px] font-semibold text-muted-foreground">{t("stats.distance")}</p></div>}
              </div>
              {flight.glider && <p className="text-[13px] font-medium text-muted-foreground [overflow-wrap:anywhere]">{flight.glider}</p>}

              {/* Comment preview */}
              {feedComment.trim() && (
                <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
                  <span className="font-semibold mr-1">{pilotName}</span>
                  <span className="text-muted-foreground">{feedComment}</span>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Edit section */}
          <div className="min-w-0 space-y-4">
            {/* Description */}
            <div className="space-y-1.5">
              <label htmlFor={descriptionId} className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("flights.feedDescription")}
              </label>
              <Textarea
                id={descriptionId}
                value={feedComment}
                onChange={e => setFeedComment(e.target.value)}
                placeholder={t("flights.feedDescriptionPlaceholder")}
                className="min-h-[88px] resize-none text-base sm:text-sm"
                rows={3}
              />
            </div>

            {/* Photo selection */}
            {photos.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("flights.selectPhotos")} ({selectedPhotoIds.length}/{photos.length})
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {photos.map(p => (
                    <label key={p.id} className="relative cursor-pointer group">
                      <img
                        src={p.url}
                        alt=""
                        className={cn(
                          "w-full rounded-lg aspect-square object-cover transition-all",
                          selectedPhotoIds.includes(p.id)
                            ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                            : "opacity-50 grayscale"
                        )}
                      />
                      <div className="absolute top-1 right-1">
                        <Checkbox
                          checked={selectedPhotoIds.includes(p.id)}
                          onCheckedChange={() => togglePhoto(p.id)}
                          className="h-4 w-4 bg-background/80 backdrop-blur-sm"
                        />
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t p-4 sm:space-x-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            {t("common.cancel")}
          </Button>
          <Button onClick={() => onPublish(selectedPhotoIds, feedComment)} disabled={loading} className="flex-1 gap-2">
            <Share2 className="h-4 w-4" />
            {t("flights.publishToFeed")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
