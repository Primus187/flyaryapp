import { describe, expect, it, vi } from "vitest";
import { resolveFeedItems, type RawFeedItem } from "./feed-page";

const social = { likes: [], comments: [], isBookmarked: false };

const flight: RawFeedItem = { type: "flight", date: "2026-09-20T10:00:00+00:00", data: {
  ...social, id: "f1", date: "2026-09-20", created_at: "", published_at: "2026-09-20T10:00:00+00:00", feedDescription: null,
  glider: null, duration_minutes: 30, altitude_gain: null, distance_km: null, takeoff_name: null, landing_name: null,
  user_id: "u1", pilot_name: "Anna", group_name: "Vertical", videoUrls: [], hasTrack: false, takeoff: null, landing: null,
  avatar_path: "u1/avatar.jpg", photoPaths: ["u1/f1/a.webp", "u1/f1/missing.webp"],
  uploadedVideoPaths: [{ video: "u1/f1/v.mp4", poster: "u1/f1/v.jpg" }],
} };
const event: RawFeedItem = { type: "event", date: "2026-09-19T08:00:00+00:00", data: {
  ...social, id: "e1", title: "Höhenflug", description: null, feed_description: null, event_date: "2026-09-19T07:00:00+00:00",
  event_type: null, meeting_point: null, max_participants: null, status: "confirmed", group_name: "Vertical",
  created_at: "", published_at: null, signup_count: 2, user_signed_up: true, created_by: "u2", pilot_name: "Ben",
  avatar_path: "https://cdn.example/ben.png", photoRows: [{ id: "p1", storage_path: "events/u2/e1/x.webp" }],
} };
const achievement: RawFeedItem = { type: "achievement", date: "2026-09-18T08:00:00+00:00", data: {
  ...social, id: "a1", user_id: "u3", challenge_id: "c1", goal_id: null, achievement_type: "challenge_completed",
  created_at: "", pilot_name: "Cleo", challenge_title: "Gipfel", goal_label: null, group_name: "", total_goals: 3,
  completed_goals: 3, avatar_path: null,
} };

describe("resolveFeedItems", () => {
  it("signs all paths in one call per bucket and maps them to card fields", async () => {
    const sign = vi.fn(async (_bucket: string, paths: string[]) =>
      Object.fromEntries(paths.filter(p => !p.includes("missing")).map(p => [p, `signed:${p}`])));
    const [f, e, a] = await resolveFeedItems([flight, event, achievement], sign);

    expect(sign).toHaveBeenCalledTimes(2);
    expect(sign.mock.calls.find(c => c[0] === "flight-photos")![1].sort()).toEqual(["events/u2/e1/x.webp", "u1/avatar.jpg", "u1/f1/a.webp", "u1/f1/missing.webp"]);
    if (f.type !== "flight" || e.type !== "event" || a.type !== "achievement") throw new Error("order");
    expect(f.data.avatar_url).toBe("signed:u1/avatar.jpg");
    expect(f.data.photoUrls).toEqual(["signed:u1/f1/a.webp"]);
    expect(f.data.uploadedVideos).toEqual([{ videoUrl: "signed:u1/f1/v.mp4", posterUrl: "signed:u1/f1/v.jpg" }]);
    expect("photoPaths" in f.data).toBe(false);
    expect(e.data.avatar_url).toBe("https://cdn.example/ben.png");
    expect(e.data.photos).toEqual([{ id: "p1", url: "signed:events/u2/e1/x.webp" }]);
    expect(a.data.avatar_url).toBe("");
  });

  it("does not call the signer for pages without media", async () => {
    const sign = vi.fn();
    const items = await resolveFeedItems([achievement], sign);
    expect(sign).not.toHaveBeenCalled();
    expect(items).toHaveLength(1);
  });
});
