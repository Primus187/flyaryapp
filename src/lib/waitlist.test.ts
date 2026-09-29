import { describe, expect, it } from "vitest";
import { WAITLIST_HEADERS, waitlistCsv } from "./waitlist";

describe("waitlist CSV", () => {
  it("writes one escaped row per sign-up", () => {
    const csv = waitlistCsv([{
      id: "1", name: "Petra, Pilotin", email: "p@example.ch", language: "de", role: "pilot", disciplines: ["paraglider", "hangglider"],
      school: null, comment: 'Sagt "hallo"', consent_at: "2026-09-29T10:00:00Z", created_at: "2026-09-29T10:00:00Z", updated_at: "2026-09-29T10:00:00Z", handled_at: null,
    }]);
    const [header, row] = csv.slice(1).split("\n");
    expect(header.split(",")).toEqual(WAITLIST_HEADERS);
    expect(row).toBe('2026-09-29T10:00:00Z,"Petra, Pilotin",p@example.ch,de,pilot,paraglider hangglider,,"Sagt ""hallo""",2026-09-29T10:00:00Z,');
  });
});
