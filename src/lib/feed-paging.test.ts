import { describe, expect, it } from "vitest";
import { feedPageCutoff } from "./feed-paging";

describe("feedPageCutoff", () => {
  it("returns null when every source is exhausted", () => {
    expect(feedPageCutoff([{ full: false, oldest: "2026-09-01T00:00:00+00:00" }, { full: false, oldest: null }])).toBeNull();
  });

  it("ignores an exhausted source with older items (old achievement must not skip flights)", () => {
    const flights = { full: true, oldest: "2026-09-20T10:00:00+00:00" };
    const achievements = { full: false, oldest: "2026-03-01T10:00:00+00:00" };
    expect(feedPageCutoff([flights, achievements])).toBe(flights.oldest);
  });

  it("cuts at the newest of the full sources' oldest items", () => {
    const flights = { full: true, oldest: "2026-09-10T10:00:00+00:00" };
    const achievements = { full: true, oldest: "2026-09-15T10:00:00+00:00" };
    expect(feedPageCutoff([flights, achievements])).toBe(achievements.oldest);
  });

  it("compares instants, not strings", () => {
    const a = { full: true, oldest: "2026-09-15T12:00:00+02:00" }; // 10:00 UTC
    const b = { full: true, oldest: "2026-09-15T11:00:00+00:00" };
    expect(feedPageCutoff([a, b])).toBe(b.oldest);
  });
});
