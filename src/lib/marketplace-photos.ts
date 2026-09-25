/**
 * Marketplace (plan 4.3): listing photos. Every photo is stored twice, both compressed in the browser:
 * a 1280 px image for the gallery and a 320 px thumbnail for lists (keeps storage and egress small on the
 * Supabase Free plan). Files: marketplace-photos/<listing_id>/<photo_id>.<ext> (+ `_thumb`).
 * The database allows at most 6 photos per listing (migration 0033).
 */
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "./image-compress";
import { getSignedUrls } from "./signed-url-cache";

export const MARKET_PHOTO_BUCKET = "marketplace-photos";
export const MAX_LISTING_PHOTOS = 6;
export const PHOTO_FULL_SIZE = 1280;
export const PHOTO_THUMB_SIZE = 320;
/** Limit for the picked original; phone photos are larger than the 2 MB the bucket takes after compression. */
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const STORED_TYPES = ["image/webp", "image/jpeg"];

export interface ListingPhoto {
  id: string;
  listing_id: string;
  path: string;
  thumb_path: string;
  position: number;
}

export type PhotoError = "not_an_image" | "too_large" | "too_many" | "unsupported_format";

/** Checks a picked file before compressing it. */
export function checkSourceFile(file: Pick<File, "type" | "size">): PhotoError | null {
  if (!file.type.startsWith("image/")) return "not_an_image";
  if (file.size > MAX_SOURCE_BYTES) return "too_large";
  return null;
}

/** How many of the picked files still fit, given the photos the listing already has. */
export const photosThatFit = (existing: number, picked: number) =>
  Math.max(0, Math.min(picked, MAX_LISTING_PHOTOS - existing));

export function photoPaths(listingId: string, photoId: string, type: string) {
  const ext = type === "image/webp" ? "webp" : "jpg";
  return { path: `${listingId}/${photoId}.${ext}`, thumb_path: `${listingId}/${photoId}_thumb.${ext}` };
}

/** New order after dragging the photo at `from` to `to` (ids only, first = cover photo). */
export function movePhoto<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length) return next;
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Lowest position 0–5 not taken yet (positions have gaps after deleting); null when full. */
export function firstFreePosition(photos: readonly { position: number }[]): number | null {
  const taken = new Set(photos.map((p) => p.position));
  for (let p = 0; p < MAX_LISTING_PHOTOS; p++) if (!taken.has(p)) return p;
  return null;
}

export const sortPhotos =<T extends { position: number }>(photos: readonly T[]) =>
  [...photos].sort((a, b) => a.position - b.position);

export class ListingPhotoError extends Error {
  constructor(public code: PhotoError | "upload_failed") { super(code); }
}

/** Compresses, uploads both files and records the photo. Removes the files again if a later step fails. */
export async function uploadListingPhoto(listingId: string, file: File, position: number): Promise<ListingPhoto> {
  const problem = checkSourceFile(file);
  if (problem) throw new ListingPhotoError(problem);
  if (position >= MAX_LISTING_PHOTOS) throw new ListingPhotoError("too_many");

  const [full, thumb] = await Promise.all([
    compressImage(file, PHOTO_FULL_SIZE, PHOTO_FULL_SIZE, 0.8),
    compressImage(file, PHOTO_THUMB_SIZE, PHOTO_THUMB_SIZE, 0.75),
  ]);
  // compressImage hands back the original when the browser cannot decode it (e.g. HEIC outside Safari)
  if (!STORED_TYPES.includes(full.type) || full.type !== thumb.type) throw new ListingPhotoError("unsupported_format");

  const photoId = crypto.randomUUID();
  const { path, thumb_path } = photoPaths(listingId, photoId, full.type);
  const bucket = supabase.storage.from(MARKET_PHOTO_BUCKET);
  const uploaded: string[] = [];
  try {
    for (const [p, f] of [[path, full], [thumb_path, thumb]] as const) {
      const { error } = await bucket.upload(p, f, { contentType: f.type, cacheControl: "31536000" });
      if (error) throw error;
      uploaded.push(p);
    }
    const { data, error } = await supabase
      .from("marketplace_listing_photos")
      .insert({ id: photoId, listing_id: listingId, path, thumb_path, position })
      .select("id, listing_id, path, thumb_path, position")
      .single();
    if (error || !data) throw error ?? new Error("insert failed");
    return data as unknown as ListingPhoto;
  } catch (e) {
    if (uploaded.length) await bucket.remove(uploaded);
    if (e instanceof ListingPhotoError) throw e;
    // Supabase errors are not always Error instances, but they carry a message
    const message = e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
    throw new ListingPhotoError(/at most 6 photos/.test(message) ? "too_many" : "upload_failed");
  }
}

/** Removes the files first, then the record (a leftover record would point to missing files). */
export async function deleteListingPhoto(photo: Pick<ListingPhoto, "id" | "path" | "thumb_path">): Promise<void> {
  const { error: storageError } = await supabase.storage.from(MARKET_PHOTO_BUCKET).remove([photo.path, photo.thumb_path]);
  if (storageError) throw storageError;
  const { error } = await supabase.from("marketplace_listing_photos").delete().eq("id", photo.id);
  if (error) throw error;
}

export async function reorderListingPhotos(listingId: string, photoIds: string[]): Promise<void> {
  const { error } = await supabase.rpc("marketplace_reorder_photos", { _listing: listingId, _photo_ids: photoIds });
  if (error) throw error;
}

/** Deletes a listing: first its files (the row's cascade would leave them in the bucket), then the listing. */
export async function deleteListing(listingId: string): Promise<void> {
  const { data, error: readError } = await supabase.from("marketplace_listing_photos")
    .select("path, thumb_path").eq("listing_id", listingId);
  if (readError) throw readError;
  const files = ((data ?? []) as unknown as { path: string; thumb_path: string }[]).flatMap((p) => [p.path, p.thumb_path]);
  if (files.length) {
    const { error } = await supabase.storage.from(MARKET_PHOTO_BUCKET).remove(files);
    if (error) throw error;
  }
  const { error } = await supabase.from("marketplace_listings").delete().eq("id", listingId);
  if (error) throw error;
}

/** Cover photo (lowest position) per listing, as signed thumbnail URL. */
export async function coverThumbnails(listingIds: readonly string[]): Promise<Record<string, string>> {
  if (listingIds.length === 0) return {};
  const { data } = await supabase.from("marketplace_listing_photos")
    .select("id, listing_id, path, thumb_path, position").in("listing_id", listingIds as string[]);
  const covers = new Map<string, ListingPhoto>();
  for (const p of (data ?? []) as unknown as ListingPhoto[]) {
    const current = covers.get(p.listing_id);
    if (!current || p.position < current.position) covers.set(p.listing_id, p);
  }
  const urls = await listingPhotoUrls([...covers.values()], "thumb");
  return Object.fromEntries([...covers.entries()].map(([listing, photo]) => [listing, urls[photo.id] ?? ""]));
}

/** Signed URLs for thumbnails (lists) or full images (gallery), keyed by photo id. */
export async function listingPhotoUrls(photos: readonly ListingPhoto[], size: "thumb" | "full"): Promise<Record<string, string>> {
  const pathOf = (p: ListingPhoto) => (size === "thumb" ? p.thumb_path : p.path);
  const urls = await getSignedUrls(MARKET_PHOTO_BUCKET, photos.map(pathOf));
  return Object.fromEntries(photos.map((p) => [p.id, urls[pathOf(p)] ?? ""]));
}
