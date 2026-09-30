import { describe, expect, it } from "vitest";
import { leadInviteLink, leadInviteMailto, schoolFormValid, schoolState } from "./ops-schools";

const token = "b".repeat(64);

describe("schoolFormValid", () => {
  it("needs a name and a plausible e-mail address", () => {
    expect(schoolFormValid("Vertical", "lead@example.ch")).toBe(true);
    expect(schoolFormValid(" V ", "lead@example.ch")).toBe(false);
    expect(schoolFormValid("x".repeat(101), "lead@example.ch")).toBe(false);
    expect(schoolFormValid("Vertical", "lead@example")).toBe(false);
  });
});

describe("schoolState", () => {
  const base = { admins: [] as string[], i_am_member: false, other_admins: 0, open_invite: null };
  const invite = { email: "l@example.ch", language: "de", created_at: "", expires_at: "" };

  it("tells what is missing for the handover", () => {
    expect(schoolState(base)).toBe("needs_lead");
    expect(schoolState({ ...base, open_invite: invite })).toBe("invited");
    expect(schoolState({ ...base, admins: ["Laura"], other_admins: 1 })).toBe("handed_over");
  });

  it("asks the admin to leave once a lead is in place", () => {
    expect(schoolState({ ...base, admins: ["Tobias"], i_am_member: true })).toBe("needs_lead");
    expect(schoolState({ ...base, admins: ["Tobias"], i_am_member: true, open_invite: invite })).toBe("invited");
    expect(schoolState({ ...base, admins: ["Tobias", "Laura"], i_am_member: true, other_admins: 1 })).toBe("admin_still_member");
  });
});

describe("lead invitation", () => {
  it("builds the link and a prepared e-mail in the chosen language", () => {
    const link = leadInviteLink("https://app.flyary.ch", token);
    expect(link).toBe(`https://app.flyary.ch/welcome/lead/${token}`);
    const fr = decodeURIComponent(leadInviteMailto("lead@example.ch", "Vertical", "fr", link));
    expect(fr).toContain("mailto:lead@example.ch?subject=Vertical sur Flyary");
    expect(fr).toContain(link);
    expect(decodeURIComponent(leadInviteMailto("x@example.ch", "Vertical", "it", link))).toContain("Vertical auf Flyary");
  });
});
