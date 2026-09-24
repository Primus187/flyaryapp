import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { WARN_BYTES, bucketsBySize, formatBytes, usageLevel } from "./storage-usage";

describe("storage usage", () => {
  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(157 * 1024 ** 2)).toBe("157 MB");
    expect(formatBytes(1.5 * 1024 ** 3)).toBe("1.5 GB");
  });
  it("warns from 700 MB and caps the percentage", () => {
    expect(usageLevel(200 * 1024 ** 2)).toEqual({ percent: 20, warn: false });
    expect(usageLevel(WARN_BYTES)).toEqual({ percent: 68, warn: true });
    expect(usageLevel(2 * 1024 ** 3)).toEqual({ percent: 100, warn: true });
  });
  it("sorts buckets by size", () => {
    expect(bucketsBySize({ total_bytes: 0, buckets: { a: 1, b: 3, c: 2 } }).map(([k]) => k)).toEqual(["b", "c", "a"]);
  });
});
