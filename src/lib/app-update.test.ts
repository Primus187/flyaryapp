import { describe, expect, it } from "vitest";
import { RECOVERY_INTERVAL_MS, isAppAsset, mayRecover } from "./app-update";

describe("stale app recovery", () => {
  it("recognises the app's own build files", () => {
    expect(isAppAsset("https://flyaryapp.vercel.app/assets/index-CxakBR0Y.css")).toBe(true);
    expect(isAppAsset("https://flyaryapp.vercel.app/assets/More-a1b2.js?v=1")).toBe(true);
    expect(isAppAsset("https://fonts.googleapis.com/css2?family=Inter")).toBe(false);
    expect(isAppAsset("https://flyaryapp.vercel.app/icons/flyary-192.png")).toBe(false);
  });
  it("repairs at most once a minute", () => {
    expect(mayRecover(0, 1_000_000)).toBe(true);
    expect(mayRecover(1_000_000, 1_000_000 + RECOVERY_INTERVAL_MS - 1)).toBe(false);
    expect(mayRecover(1_000_000, 1_000_000 + RECOVERY_INTERVAL_MS)).toBe(true);
  });
});
