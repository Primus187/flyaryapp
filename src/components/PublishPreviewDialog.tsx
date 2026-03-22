import { useState, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Heart, MessageCircle, MapPin, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

function getYoutubeEmbedUrl(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

export default function PublishPreviewDialog({
  open, onOpenChange, onPublish, flight, pilotName, avatarUrl, groupName,
  photos, videoUrls, trackPoints, loading,
}: PublishPreviewDialogProps) {
  const { t } = useTranslation();
  const [feedComment, setFeedComment] = useState(flight.comments || "");
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>(photos.map(p => p.id));

  const initials = pilotName?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
  const hasTrack = trackPoints.length > 0;
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="text-base">{t("flights.feedPreview")}</DialogTitle>
        </DialogHeader>

        {/* Preview card */}
        <div className="px-4">
          <Card className="border shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 p-3 pb-2">
              <div className="p-[2px] rounded-full bg-gradient-to-tr from-primary via-secondary to-accent">
                <Avatar className="h-8 w-8 border-2 border-background">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="text-xs bg-muted">{initials}</AvatarFallback>
                </Avatar>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{pilotName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {groupName && <span>{groupName} · </span>}
                  {flight.takeoff?.name && <><MapPin className="h-3 w-3 inline mr-0.5" />{flight.takeoff.name} · </>}
                  {t("feed.justNow")}
                </p>
              </div>
            </div>

            {/* Videos preview */}
            {videoUrls && videoUrls.length > 0 && videoUrls.map((url, i) => {
              const embedUrl = getYoutubeEmbedUrl(url);
              return embedUrl ? (
                <div key={`vid-${i}`} className="relative w-full aspect-video bg-muted">
                  <iframe src={embedUrl} title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="absolute inset-0 w-full h-full" />
                </div>
              ) : null;
            })}

            {/* Selected photos preview */}
            {selectedPhotos.length > 0 && (
              <div className="aspect-square w-full overflow-hidden bg-muted">
                <img src={selectedPhotos[0].url} alt="" className="w-full h-full object-cover" />
              </div>
            )}

            {/* Mini map */}
            {(hasTrack || flight.takeoff || flight.landing) && (
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
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {flight.glider && <span className="font-medium text-foreground">🪂 {flight.glider}</span>}
                {flight.duration_minutes && <span>⏱ {formatDuration(flight.duration_minutes)}</span>}
                {flight.altitude_gain && <span>↑ {flight.altitude_gain}m</span>}
                {flight.distance_km && <span>↔ {Number(flight.distance_km).toFixed(1)}km</span>}
              </div>

              {/* Comment preview */}
              {feedComment.trim() && (
                <p className="text-sm">
                  <span className="font-semibold mr-1">{pilotName}</span>
                  <span className="text-muted-foreground">{feedComment}</span>
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Edit section */}
        <div className="px-4 space-y-4 pb-2">
          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t("flights.feedDescription")}
            </label>
            <Textarea
              value={feedComment}
              onChange={e => setFeedComment(e.target.value)}
              placeholder={t("flights.feedDescriptionPlaceholder")}
              className="min-h-[60px] text-sm resize-none"
              rows={2}
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
                        "rounded-lg aspect-square object-cover transition-all",
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

        <DialogFooter className="p-4 pt-2">
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
