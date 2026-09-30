import { describe, expect, it } from "vitest";
import { allowedWithoutAccess, inviteMailto, parseInviteInput, personalInviteLink } from "./app-access";

const code = "0b1c2d3e-0000-4000-8000-000000000000";
const token = "a".repeat(64);

describe("pilot phase access", () => {
  it("reads group codes and links, personal links and tokens", () => {
    expect(parseInviteInput(` ${code.toUpperCase()} `)).toEqual({ kind: "group", code });
    expect(parseInviteInput(`https://app.flyary.ch/groups?invite=${code}`)).toEqual({ kind: "group", code });
    expect(parseInviteInput(token)).toEqual({ kind: "personal", token });
    expect(parseInviteInput(`https://app.flyary.ch/welcome/${token}`)).toEqual({ kind: "personal", token });
    expect(parseInviteInput(`https://app.flyary.ch/welcome/lead/${token}`)).toEqual({ kind: "lead", token });
    expect(parseInviteInput("hallo")).toBeNull();
    expect(parseInviteInput("https://app.flyary.ch/groups?invite=nope")).toBeNull();
    expect(parseInviteInput("https://app.flyary.ch/welcome/short")).toBeNull();
  });

  it("builds the personal link and a prepared e-mail in the entry's language", () => {
    const link = personalInviteLink("https://app.flyary.ch", token);
    expect(link).toBe(`https://app.flyary.ch/welcome/${token}`);
    const mail = decodeURIComponent(inviteMailto("petra@example.ch", "Petra Pilotin", "fr", link));
    expect(mail).toContain("mailto:petra@example.ch?subject=Votre invitation à Flyary");
    expect(mail).toContain("Bonjour Petra");
    expect(mail).toContain(link);
    expect(decodeURIComponent(inviteMailto("x@example.ch", "X", "it", link))).toContain("Deine Einladung zu Flyary");
  });

  it("lets waiting accounts open only the redeem page", () => {
    expect(allowedWithoutAccess(`/welcome/${token}`)).toBe(true);
    expect(allowedWithoutAccess("/flights")).toBe(false);
  });
});
