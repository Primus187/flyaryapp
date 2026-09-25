import { describe, expect, it } from "vitest";
import { attachPilotNames } from "./group-members";

describe("attachPilotNames", () => {
  it("attaches the pilot name of each member", () => {
    const rows = attachPilotNames(
      [{ id: "m1", user_id: "u1", role: "admin" }, { id: "m2", user_id: "u2", role: "member" }],
      [{ user_id: "u2", pilot_name: "Anna" }, { user_id: "u1", pilot_name: "Tobias" }],
    );
    expect(rows.map((r) => r.profiles?.pilot_name)).toEqual(["Tobias", "Anna"]);
  });

  it("keeps members whose profile is not readable", () => {
    const rows = attachPilotNames([{ id: "m1", user_id: "u1", role: "member" }], []);
    expect(rows).toEqual([{ id: "m1", user_id: "u1", role: "member", profiles: null }]);
  });
});
