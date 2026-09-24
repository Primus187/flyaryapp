import { describe, expect, it } from "vitest";
import { audienceSummary, availableFilters, channelTitle, filterChannels, formatUnread, totalUnread, type ChatChannel } from "./chat";

const base: ChatChannel = {
  id: "x", kind: "group", name: "Allgemein", description: null, group_id: "g", group_name: "Vertical", group_type: "school",
  event_id: null, event_title: null, event_date: null, audience: "all", audience_levels: null, staff_only_posting: false,
  is_default: true, archived_at: null, created_at: "2026-09-01T10:00:00Z", last_message_at: null, can_manage: false,
  can_post: true, last_message: null, unread: 0,
};
const ch = (over: Partial<ChatChannel>): ChatChannel => ({ ...base, ...over });

const school = ch({ id: "s", name: "Allgemein", last_message_at: "2026-09-20T10:00:00Z", unread: 3 });
const team = ch({ id: "t", name: "Team", audience: "team", last_message_at: "2026-09-22T10:00:00Z", unread: 1 });
const friends = ch({ id: "f", name: "Allgemein", group_name: "Freunde", group_type: "pilot_group", last_message_at: "2026-09-23T10:00:00Z" });
const event = ch({ id: "e", kind: "event", name: null, event_title: "Höhenflugtag", last_message_at: "2026-09-21T10:00:00Z", unread: 2 });
const archived = ch({ id: "a", name: "Camp 2025", archived_at: "2026-09-01T00:00:00Z", last_message_at: "2026-09-24T10:00:00Z", unread: 5 });
const all = [school, team, friends, event, archived];

describe("chat helpers", () => {
  it("titles event channels by the event", () => {
    expect(channelTitle(event)).toBe("Höhenflugtag");
    expect(channelTitle(team)).toBe("Team");
  });

  it("filters by kind and sorts active channels by activity, archived last", () => {
    expect(filterChannels(all, "all").map((c) => c.id)).toEqual(["f", "t", "e", "s", "a"]);
    expect(filterChannels(all, "school").map((c) => c.id)).toEqual(["t", "s", "a"]);
    expect(filterChannels(all, "groups").map((c) => c.id)).toEqual(["f"]);
    expect(filterChannels(all, "events").map((c) => c.id)).toEqual(["e"]);
    expect(filterChannels(all, "all", "freunde").map((c) => c.id)).toEqual(["f"]);
  });

  it("counts unread messages without archived channels and caps the badge", () => {
    expect(totalUnread(all)).toBe(6);
    expect(formatUnread(7)).toBe("7");
    expect(formatUnread(150)).toBe("99+");
  });

  it("offers only filters that have channels", () => {
    expect(availableFilters([school, event])).toEqual(["all", "school", "events"]);
  });

  it("describes the audience", () => {
    const t = (key: string) => ({ "chat.audience.students": "Schüler", "chat.levels.ground": "Grundkurs", "chat.levels.altitude": "Höhenflug", "chat.audience.event": "Termin" } as Record<string, string>)[key] ?? key;
    expect(audienceSummary(ch({ audience: "students", audience_levels: ["ground", "altitude"] }), t)).toBe("Schüler · Grundkurs, Höhenflug");
    expect(audienceSummary(event, t)).toBe("Termin");
  });
});

describe("managedGroups", () => {
  it("lists each group once where the user manages channels", async () => {
    const { managedGroups } = await import("./chat");
    expect(managedGroups([ch({ can_manage: true }), ch({ id: "t2", can_manage: true }), ch({ group_id: "h", group_name: "Freunde", can_manage: false }),
      ch({ kind: "event", group_id: "z", can_manage: true })])).toEqual([{ id: "g", name: "Vertical", group_type: "school" }]);
  });
});
