import { describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

import { banUntil, fetchModerationQueue, moderateListing, reportListing, setBan, sortQueue, type QueueItem } from "./marketplace-moderation";

const item = (over: Partial<QueueItem>): QueueItem => ({
  listing_id: "l", title: "t", status: "active", removed_reason: null, is_school: false, seller_id: "s", seller_name: "S",
  open_reports: 1, reasons: ["scam"], notes: [], first_reported_at: "2026-09-20T10:00:00Z", seller_banned: false, ...over,
});

describe("queue", () => {
  it("puts hidden listings first, then oldest reports first", () => {
    const sorted = sortQueue([
      item({ listing_id: "new", first_reported_at: "2026-09-23T10:00:00Z" }),
      item({ listing_id: "old", first_reported_at: "2026-09-21T10:00:00Z" }),
      item({ listing_id: "hidden", status: "removed", first_reported_at: "2026-09-22T10:00:00Z" }),
    ]);
    expect(sorted.map((i) => i.listing_id)).toEqual(["hidden", "old", "new"]);
  });
  it("loads and sorts the queue", async () => {
    rpc.mockResolvedValueOnce({ data: [item({ listing_id: "b", first_reported_at: "2026-09-22" }), item({ listing_id: "a", first_reported_at: "2026-09-21" })], error: null });
    expect((await fetchModerationQueue()).map((i) => i.listing_id)).toEqual(["a", "b"]);
  });
});

describe("calls", () => {
  it("sends reports and moderation actions with trimmed text", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await reportListing("l", "unsafe", "  ");
    await moderateListing("l", "hide", " Nicht flugtauglich ");
    expect(rpc.mock.calls.slice(-2)).toEqual([
      ["marketplace_report", { _listing: "l", _reason: "unsafe", _note: null }],
      ["marketplace_moderate", { _listing: "l", _action: "hide", _reason: "Nicht flugtauglich" }],
    ]);
  });
  it("bans for a number of days or until lifted", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await setBan("u", true, null, "Betrug");
    await setBan("u", false);
    expect(rpc.mock.calls.slice(-2)).toEqual([
      ["marketplace_set_ban", { _user: "u", _banned: true, _until: null, _reason: "Betrug" }],
      ["marketplace_set_ban", { _user: "u", _banned: false, _until: null, _reason: null }],
    ]);
    expect(banUntil(7, new Date("2026-09-24T12:00:00Z"))).toBe("2026-10-01T12:00:00.000Z");
  });
  it("passes errors on", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "marketplace:already_reported" } });
    await expect(reportListing("l", "scam", "")).rejects.toMatchObject({ message: "marketplace:already_reported" });
  });
});

describe("translations of plan 4.8", async () => {
  const { REPORT_REASONS } = await import("./marketplace-moderation");
  const locales = {
    de: (await import("@/i18n/locales/de.json")).default,
    en: (await import("@/i18n/locales/en.json")).default,
    fr: (await import("@/i18n/locales/fr.json")).default,
  };
  const keys = [
    ...REPORT_REASONS.map((r) => `market.report.reasons.${r}`),
    ...["hide", "restore", "dismiss", "ban", "unban", "delete"].flatMap((a) => [`market.moderation.${a}`, `market.moderation.done.${a}`]),
    "market.report.title", "market.report.thanks", "market.moderation.title", "market.moderation.reports_one", "market.moderation.reports_other",
    "market.moderation.hideReason", "market.moderation.banDays", "market.moderation.hiddenNotice", "market.moderation.notification",
    "market.errors.already_reported", "market.errors.reason_required",
  ];
  const lookup = (obj: unknown, path: string) =>
    path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
  it.each(Object.entries(locales))("%s has every text", (_lang, locale) => {
    expect(keys.filter((k) => typeof lookup(locale, k) !== "string")).toEqual([]);
  });
});
