import { describe, expect, it } from "vitest";
import { backupStatus, openItems, type OpsOverview } from "./ops-overview";

const now = new Date("2026-09-30T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();
const base: OpsOverview = {
  waitlist_open: 0, errors_open: 0, errors_new_24h: 0, market_reports_open: 0,
  backup_last_at: hoursAgo(5), backup_last_ok: true, backup_last_success_at: hoursAgo(5), storage_bytes: 0,
};

describe("backupStatus", () => {
  it("is ok after a recent successful run", () => {
    expect(backupStatus(base, now)).toBe("ok");
  });

  it("reports a failed last run while an older one is still recent", () => {
    expect(backupStatus({ ...base, backup_last_ok: false, backup_last_success_at: hoursAgo(30) }, now)).toBe("failed");
  });

  it("is stale after 48 hours without a successful run", () => {
    expect(backupStatus({ ...base, backup_last_success_at: hoursAgo(49) }, now)).toBe("stale");
    expect(backupStatus({ ...base, backup_last_ok: false, backup_last_success_at: null }, now)).toBe("stale");
    expect(backupStatus({ ...base, backup_last_success_at: hoursAgo(47) }, now)).toBe("ok");
  });

  it("is none when no backup ever reported", () => {
    expect(backupStatus({ ...base, backup_last_at: null, backup_last_ok: null, backup_last_success_at: null }, now)).toBe("none");
  });
});

describe("openItems", () => {
  it("adds open entries and a backup that needs attention", () => {
    expect(openItems(base, now)).toBe(0);
    expect(openItems({ ...base, waitlist_open: 2, errors_open: 3, market_reports_open: 1 }, now)).toBe(6);
    expect(openItems({ ...base, backup_last_success_at: hoursAgo(60) }, now)).toBe(1);
  });
});
