import { describe, expect, it, vi } from "vitest";
import { canSharePublicly, fetchSharedListing, sharedListingUrl } from "./marketplace-share";

describe("public share link", () => {
  it("points to the Edge Function with the token", () => {
    expect(sharedListingUrl("t1", "https://x.supabase.co/")).toBe("https://x.supabase.co/functions/v1/get-shared-listing?token=t1");
  });
  it("is offered only for listed listings visible to everyone", () => {
    const now = new Date("2026-09-25T12:00:00Z");
    expect(canSharePublicly({ status: "active", expires_at: null, visibility: "all" }, now)).toBe(true);
    expect(canSharePublicly({ status: "reserved", expires_at: "2026-10-01T00:00:00Z", visibility: "all" }, now)).toBe(true);
    expect(canSharePublicly({ status: "active", expires_at: "2026-09-24T00:00:00Z", visibility: "all" }, now)).toBe(false);
    expect(canSharePublicly({ status: "draft", expires_at: null, visibility: "all" }, now)).toBe(false);
    expect(canSharePublicly({ status: "active", expires_at: null, visibility: "school_students" }, now)).toBe(false);
  });
  it("asks for JSON and treats 404 as not available", async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify({ id: "l", title: "Helm" })));
    expect(await fetchSharedListing("t", "https://x.supabase.co", ok as unknown as typeof fetch)).toMatchObject({ title: "Helm" });
    expect((ok.mock.calls[0] as unknown[])[1]).toEqual({ headers: { Accept: "application/json" } });
    const gone = vi.fn(async () => new Response("{}", { status: 404 }));
    expect(await fetchSharedListing("t", "https://x.supabase.co", gone as unknown as typeof fetch)).toBeNull();
    const broken = vi.fn(async () => new Response("{}", { status: 500 }));
    await expect(fetchSharedListing("t", "https://x.supabase.co", broken as unknown as typeof fetch)).rejects.toThrow("HTTP 500");
  });
});

describe("translations of plan 8.4", async () => {
  const locales = {
    de: (await import("@/i18n/locales/de.json")).default,
    en: (await import("@/i18n/locales/en.json")).default,
    fr: (await import("@/i18n/locales/fr.json")).default,
  };
  const keys = ["title", "notAvailable", "openInApp", "discover", "privateSeller", "shareText", "linkCopied"].map((k) => `market.shared.${k}`);
  const lookup = (obj: unknown, path: string) =>
    path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
  it.each(Object.entries(locales))("%s has every text", (_lang, locale) => {
    expect(keys.filter((k) => typeof lookup(locale, k) !== "string")).toEqual([]);
  });
});
