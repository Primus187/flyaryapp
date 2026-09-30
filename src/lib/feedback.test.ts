import { describe, expect, it } from "vitest";
import { acceptScreenshots, feedbackMailto, feedbackMessageValid, filterFeedback, MESSAGE_MAX, replyMailto, screenshotPath, type FeedbackRow } from "./feedback";

const file = (name: string, type = "image/png") => new File(["x"], name, { type });

describe("feedback input", () => {
  it("needs a message within the limit", () => {
    expect(feedbackMessageValid("  Karte lädt nicht ")).toBe(true);
    expect(feedbackMessageValid("   ")).toBe(false);
    expect(feedbackMessageValid("x".repeat(MESSAGE_MAX + 1))).toBe(false);
  });

  it("keeps at most three images", () => {
    const kept = acceptScreenshots([file("a.png")], [file("b.png"), file("notes.txt", "text/plain"), file("c.jpg", "image/jpeg"), file("d.png")]);
    expect(kept.map((f) => f.name)).toEqual(["a.png", "b.png", "c.jpg"]);
  });

  it("builds the path the database accepts", () => {
    expect(screenshotPath("u", "f", 0, "image/webp")).toBe("u/f/0.webp");
    expect(screenshotPath("u", "f", 2, "image/jpeg")).toBe("u/f/2.jpg");
  });

  it("keeps the e-mail fallback with context", () => {
    const mail = decodeURIComponent(feedbackMailto({ path: "/map", appVersion: "1.2", userAgent: "Pixel", mode: "pilot" }));
    expect(mail).toContain("mailto:info@flyary.ch?subject=Flyary Feedback");
    expect(mail).toContain("Seite: /map");
  });
});

describe("admin list", () => {
  const row = (over: Partial<FeedbackRow>): FeedbackRow => ({
    id: "1", kind: "problem", message: "Karte\nlädt nicht", path: null, app_version: null, user_agent: null, screenshot_paths: [],
    created_at: "2026-09-30T08:00:00Z", status: "new", admin_note: null, handled_at: null, user_id: "u", name: "Petra", email: "petra@example.ch", ...over,
  });
  const rows = [row({ id: "a" }), row({ id: "b", status: "in_progress", kind: "idea" }), row({ id: "c", status: "done" })];

  it("filters open, by status and by kind", () => {
    expect(filterFeedback(rows, "open", "all").map((r) => r.id)).toEqual(["a", "b"]);
    expect(filterFeedback(rows, "done", "all").map((r) => r.id)).toEqual(["c"]);
    expect(filterFeedback(rows, "all", "idea").map((r) => r.id)).toEqual(["b"]);
  });

  it("replies by e-mail with the quoted feedback", () => {
    const mail = decodeURIComponent(replyMailto(rows[0], "de-CH")!);
    expect(mail).toContain("mailto:petra@example.ch?subject=Dein Feedback zu Flyary");
    expect(mail).toContain("> Karte\n> lädt nicht");
    expect(replyMailto({ ...rows[0], email: null }, "de-CH")).toBeNull();
  });
});
