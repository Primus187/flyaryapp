import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Heart, MessageCircle, Calendar, Clock, MapPin, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface EventPublishPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPublish: (selectedPhotoIds: string[], feedDescription: string) => void;
  event: {
    title: string;
    description: string | null;
    event_date: string;
    event_type: string | null;
    meeting_point: string | null;
  };
  pilotName: string;
  avatarUrl: string;
  groupName: string;
  photos: { id: string; url: string }[];
  loading?: boolean;
}

export default function EventPublishPreviewDialog({
  open, onOpenChange, onPublish, event, pilotName, avatarUrl, groupName,
  photos, loading,
}: EventPublishPreviewDialogProps) {
  const { t, i18n } = useTranslation();
  const descriptionId = useId();
  const [feedDescription, setFeedDescription] = useState(event.description || "");
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>(photos.map(p => p.id));

  const initials = pilotName?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
  const selectedPhotos = photos.filter(p => selectedPhotoIds.includes(p.id));
  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";
  const eventDate = new Date(event.event_date);

  const togglePhoto = (id: string) => {
    setSelectedPhotoIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex w-[calc(100%_-_2rem)] max-w-md max-h-[calc(100dvh_-_2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0">
        <DialogHeader className="shrink-0 p-4 pr-12 text-left">
          <DialogTitle className="text-base">{t("events.feedPreview")}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 min-w-0 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4">
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
                  {t("feed.justNow")}
                </p>
              </div>
            </div>

            {/* Selected photos */}
            {selectedPhotos.length > 0 && (
              <div className="aspect-square w-full overflow-hidden bg-muted">
                <img src={selectedPhotos[0].url} alt="" className="w-full h-full object-cover" />
              </div>
            )}

            {/* Event info overlay */}
            <div className="relative px-3 py-3 bg-accent">
              <h3 className="text-base font-bold [overflow-wrap:anywhere]">{event.title}</h3>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {eventDate.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {eventDate.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                </span>
                {event.meeting_point && (
                  <span className="flex min-w-0 items-start gap-1">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 [overflow-wrap:anywhere]">{event.meeting_point}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Actions preview */}
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-3 opacity-50">
                <Heart className="h-5 w-5" />
                <MessageCircle className="h-5 w-5" />
              </div>
              {feedDescription.trim() && (
                <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
                  <span className="font-semibold mr-1">{pilotName}</span>
                  <span className="text-muted-foreground">{feedDescription}</span>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Edit section */}
          <div className="min-w-0 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor={descriptionId} className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("events.feedDescription")}
              </label>
              <Textarea
                id={descriptionId}
                value={feedDescription}
                onChange={e => setFeedDescription(e.target.value)}
                placeholder={t("events.feedDescriptionPlaceholder")}
                className="min-h-[88px] resize-none text-base sm:text-sm"
                rows={3}
              />
            </div>

            {photos.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("events.selectPhotos")} ({selectedPhotoIds.length}/{photos.length})
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
          <Button onClick={() => onPublish(selectedPhotoIds, feedDescription)} disabled={loading} className="flex-1 gap-2">
            <Share2 className="h-4 w-4" />
            {t("events.publishToFeed")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
