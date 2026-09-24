import type { FeedFlight } from "@/components/FeedCard";
import type { FeedEvent } from "@/components/FeedEventCard";
import type { FeedAchievement } from "@/components/FeedAchievementCard";

export type FeedItem =
  | { type: "flight"; date: string; data: FeedFlight }
  | { type: "event"; date: string; data: FeedEvent }
  | { type: "achievement"; date: string; data: FeedAchievement };

/** Shape returned by the feed_page() RPC: storage paths instead of signed URLs. */
type RawFlight = Omit<FeedFlight, "avatar_url" | "photoUrls" | "uploadedVideos"> & {
  avatar_path: string | null; photoPaths: string[]; uploadedVideoPaths: { video: string; poster: string | null }[];
};
type RawEvent = Omit<FeedEvent, "avatar_url" | "photos"> & {
  avatar_path: string | null; photoRows: { id: string; storage_path: string }[];
};
type RawAchievement = Omit<FeedAchievement, "avatar_url"> & { avatar_path: string | null };
export type RawFeedItem =
  | { type: "flight"; date: string; data: RawFlight }
  | { type: "event"; date: string; data: RawEvent }
  | { type: "achievement"; date: string; data: RawAchievement };

export interface RawFeedPage { items: RawFeedItem[]; nextCursor: string | null; groupIds: string[] }

export type Signer = (bucket: string, paths: string[]) => Promise<Record<string, string>>;

const isStoragePath = (p: string | null | undefined): p is string => !!p && !p.startsWith("http");
const avatar = (path: string | null, signed: Record<string, string>) =>
  !path ? "" : path.startsWith("http") ? path : signed[path] || "";

/** Signs every photo/avatar/video path of a page in one request per bucket (in parallel). */
export async function resolveFeedItems(items: RawFeedItem[], sign: Signer): Promise<FeedItem[]> {
  const photoPaths = new Set<string>();
  const videoPaths = new Set<string>();
  for (const item of items) {
    if (isStoragePath(item.data.avatar_path)) photoPaths.add(item.data.avatar_path);
    if (item.type === "flight") {
      item.data.photoPaths.forEach(p => photoPaths.add(p));
      item.data.uploadedVideoPaths.forEach(v => { videoPaths.add(v.video); if (v.poster) videoPaths.add(v.poster); });
    } else if (item.type === "event") {
      item.data.photoRows.forEach(r => photoPaths.add(r.storage_path));
    }
  }
  const [photos, videos] = await Promise.all([
    photoPaths.size ? sign("flight-photos", [...photoPaths]) : Promise.resolve({} as Record<string, string>),
    videoPaths.size ? sign("flight-videos", [...videoPaths]) : Promise.resolve({} as Record<string, string>),
  ]);

  return items.map((item): FeedItem => {
    if (item.type === "flight") {
      const { avatar_path, photoPaths: paths, uploadedVideoPaths, ...rest } = item.data;
      return { type: "flight", date: item.date, data: {
        ...rest,
        avatar_url: avatar(avatar_path, photos),
        photoUrls: paths.map(p => photos[p]).filter(Boolean),
        uploadedVideos: uploadedVideoPaths.map(v => ({ videoUrl: videos[v.video] || "", posterUrl: v.poster ? videos[v.poster] || "" : "" })),
      } };
    }
    if (item.type === "event") {
      const { avatar_path, photoRows, ...rest } = item.data;
      return { type: "event", date: item.date, data: {
        ...rest,
        avatar_url: avatar(avatar_path, photos),
        photos: photoRows.filter(r => photos[r.storage_path]).map(r => ({ id: r.id, url: photos[r.storage_path] })),
      } };
    }
    const { avatar_path, ...rest } = item.data;
    return { type: "achievement", date: item.date, data: { ...rest, avatar_url: avatar(avatar_path, photos) } };
  });
}
