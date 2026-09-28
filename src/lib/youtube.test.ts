import { describe, expect, it } from "vitest";
import { isYoutubeUrl, youtubeEmbedUrl, youtubeLink, youtubeVideoId } from "./youtube";
import { escapeHtml } from "./html-escape";

describe("YouTube links", () => {
  it("reads the video id of the usual forms", () => {
    expect(youtubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10")).toBe("dQw4w9WgXcQ");
    expect(youtubeVideoId("https://youtu.be/dQw4w9WgXcQ?si=x")).toBe("dQw4w9WgXcQ");
    expect(youtubeVideoId(" https://m.youtube.com/shorts/abcDEF_123 ")).toBe("abcDEF_123");
    expect(youtubeVideoId("https://youtube.com/live/abcDEF-123")).toBe("abcDEF-123");
    expect(youtubeEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("refuses anything that is not a YouTube address", () => {
    for (const bad of ["javascript:alert(1)//youtube.com/watch?v=dQw4w9WgXcQ", "https://evil.example/watch?v=dQw4w9WgXcQ",
      "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ", "data:text/html,youtube.com", "youtube.com/watch?v=dQw4w9WgXcQ", ""]) {
      expect(isYoutubeUrl(bad)).toBe(false);
      expect(youtubeEmbedUrl(bad)).toBeNull();
      expect(youtubeLink(bad)).toBeUndefined();
    }
    expect(youtubeVideoId('https://youtu.be/"><script>')).toBeNull();
  });

  it("links a YouTube address that has no embeddable id", () => {
    expect(youtubeLink("https://www.youtube.com/@flyary")).toBe("https://www.youtube.com/@flyary");
    expect(youtubeEmbedUrl("https://www.youtube.com/@flyary")).toBeNull();
  });
});

describe("escapeHtml", () => {
  it("neutralises markup in names written into print windows", () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe("&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;");
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(12.5)).toBe("12.5");
  });
});
