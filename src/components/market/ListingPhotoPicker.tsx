import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ImagePlus, Loader2, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ListingPhotoError, MAX_LISTING_PHOTOS, checkSourceFile, deleteListingPhoto, firstFreePosition, listingPhotoUrls, movePhoto,
  photosThatFit, reorderListingPhotos, sortPhotos, uploadListingPhoto, type ListingPhoto,
} from "@/lib/marketplace-photos";

interface Props {
  /** Saved listing; without one the picked files wait in `pending` until the draft exists. */
  listingId: string | null;
  photos: ListingPhoto[];
  pending: File[];
  onPhotosChange: (photos: ListingPhoto[]) => void;
  onPendingChange: (files: File[]) => void;
}

/** Photos of a listing (plan 4.3/4.4): add, remove, choose the cover photo. */
export default function ListingPhotoPicker({ listingId, photos, pending, onPhotosChange, onPendingChange }: Props) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const sorted = useMemo(() => sortPhotos(photos), [photos]);
  const pendingUrls = useMemo(() => pending.map((f) => URL.createObjectURL(f)), [pending]);
  useEffect(() => () => pendingUrls.forEach((u) => URL.revokeObjectURL(u)), [pendingUrls]);

  useEffect(() => {
    let cancelled = false;
    listingPhotoUrls(photos, "thumb").then((u) => { if (!cancelled) setUrls(u); });
    return () => { cancelled = true; };
  }, [photos]);

  const count = photos.length + pending.length;

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    const valid: File[] = [];
    for (const f of Array.from(files)) {
      const problem = checkSourceFile(f);
      if (problem) toast.error(t(`market.photos.errors.${problem}`));
      else valid.push(f);
    }
    const fitting = valid.slice(0, photosThatFit(count, valid.length));
    if (fitting.length < valid.length) toast.error(t("market.photos.errors.too_many"));
    if (!fitting.length) return;
    if (!listingId) { onPendingChange([...pending, ...fitting]); return; }

    setBusy(true);
    let current = [...photos];
    for (const f of fitting) {
      const position = firstFreePosition(current);
      if (position === null) break;
      try {
        current = [...current, await uploadListingPhoto(listingId, f, position)];
        onPhotosChange(current);
      } catch (e) {
        toast.error(t(`market.photos.errors.${e instanceof ListingPhotoError ? e.code : "upload_failed"}`));
      }
    }
    setBusy(false);
  };

  const removeSaved = async (photo: ListingPhoto) => {
    setBusy(true);
    try {
      await deleteListingPhoto(photo);
      onPhotosChange(photos.filter((p) => p.id !== photo.id));
    } catch {
      toast.error(t("market.form.saveFailed"));
    }
    setBusy(false);
  };

  const makeCoverSaved = async (index: number) => {
    const ids = movePhoto(sorted.map((p) => p.id), index, 0);
    setBusy(true);
    try {
      await reorderListingPhotos(listingId!, ids);
      onPhotosChange(ids.map((id, position) => ({ ...photos.find((p) => p.id === id)!, position })));
    } catch {
      toast.error(t("market.form.saveFailed"));
    }
    setBusy(false);
  };

  const tile = (key: string, src: string, isCover: boolean, onCover: () => void, onRemove: () => void) => (
    <div key={key} className={cn("relative aspect-square overflow-hidden rounded-lg bg-muted", isCover && "ring-2 ring-primary")}>
      {src && <img src={src} alt="" className="h-full w-full object-cover" />}
      {isCover ? (
        <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
          {t("market.photos.cover")}
        </span>
      ) : (
        <button type="button" disabled={busy} onClick={onCover} aria-label={t("market.photos.makeCover")}
          className="absolute left-1 top-1 rounded-full bg-background/80 p-1">
          <Star className="h-3.5 w-3.5" />
        </button>
      )}
      <button type="button" disabled={busy} onClick={onRemove} aria-label={t("market.photos.remove")}
        className="absolute right-1 top-1 rounded-full bg-background/80 p-1">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {sorted.map((p, i) => tile(p.id, urls[p.id] ?? "", i === 0, () => void makeCoverSaved(i), () => void removeSaved(p)))}
        {pending.map((f, i) => tile(`pending-${i}`, pendingUrls[i], sorted.length === 0 && i === 0,
          () => onPendingChange(movePhoto(pending, i, 0)), () => onPendingChange(pending.filter((_, j) => j !== i))))}
        {count < MAX_LISTING_PHOTOS && (
          <button type="button" disabled={busy} onClick={() => input.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-muted-foreground">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            <span className="text-[11px]">{busy ? t("market.photos.uploading") : t("market.photos.add")}</span>
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t("market.photos.hint", { max: MAX_LISTING_PHOTOS })}</p>
      <input ref={input} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => { void pick(e.target.files); e.target.value = ""; }} />
      {count === 0 && (
        <Button type="button" variant="outline" className="w-full gap-2" onClick={() => input.current?.click()}>
          <ImagePlus className="h-4 w-4" /> {t("market.photos.add")}
        </Button>
      )}
    </div>
  );
}
