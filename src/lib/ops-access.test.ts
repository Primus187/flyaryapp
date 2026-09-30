import { describe, expect, it } from "vitest";
import { accountStatus, cleanRevokeReason, countByStatus, filterAccounts, REVOKE_REASON_MAX, type AccountRow } from "./ops-access";

const row = (over: Partial<AccountRow>): AccountRow => ({
  user_id: "u", name: "Petra Pilotin", email: "petra@example.ch", created_at: "2026-09-01T00:00:00Z", last_sign_in_at: null,
  granted_via: "group", granted_at: "2026-09-01T00:00:00Z", revoked_at: null, revoke_reason: null, is_admin: false, schools: [],
  ...over,
});

describe("accountStatus", () => {
  it("tells active, paused and no access apart", () => {
    expect(accountStatus(row({}))).toBe("active");
    expect(accountStatus(row({ revoked_at: "2026-09-30T08:00:00Z" }))).toBe("paused");
    expect(accountStatus(row({ granted_via: null }))).toBe("none");
  });
});

describe("filterAccounts", () => {
  const rows = [
    row({ user_id: "a", name: "Anna", email: "anna@example.ch", schools: ["Vertical"] }),
    row({ user_id: "b", name: "Beat", email: "beat@example.ch", revoked_at: "2026-09-30T08:00:00Z" }),
    row({ user_id: "c", name: "Carla", email: null, granted_via: null }),
  ];

  it("filters by status", () => {
    expect(filterAccounts(rows, "paused", "").map((r) => r.user_id)).toEqual(["b"]);
    expect(filterAccounts(rows, "none", "").map((r) => r.user_id)).toEqual(["c"]);
    expect(filterAccounts(rows, "all", "").length).toBe(3);
  });

  it("searches name, e-mail and schools without case", () => {
    expect(filterAccounts(rows, "all", "VERTICAL").map((r) => r.user_id)).toEqual(["a"]);
    expect(filterAccounts(rows, "all", " beat@ ").map((r) => r.user_id)).toEqual(["b"]);
    expect(filterAccounts(rows, "active", "carla")).toEqual([]);
  });

  it("counts per status", () => {
    expect(countByStatus(rows)).toEqual({ all: 3, active: 1, paused: 1, none: 1 });
  });
});

describe("cleanRevokeReason", () => {
  it("requires a reason within the limit", () => {
    expect(cleanRevokeReason("  Testphase beendet ")).toBe("Testphase beendet");
    expect(cleanRevokeReason("   ")).toBeNull();
    expect(cleanRevokeReason("x".repeat(REVOKE_REASON_MAX + 1))).toBeNull();
  });
});
