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
    expect(totalUnread([...all, { ...base, id: "muted", unread: 9, notify_level: "none" }])).toBe(6);
    expect(formatUnread(7)).toBe("7");
    expect(formatUnread(150)).toBe("99+");
  });

  it("offers only filters that have channels", () => {
    expect(availableFilters([school, event])).toEqual(["all", "school", "events"]);
    expect(availableFilters([school, ch({ id: "d", kind: "direct", name: null, group_id: null })])).toEqual(["all", "direct", "school"]);
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

describe("mentions", () => {
  const people = [
    { user_id: "r", name: "Reto" }, { user_id: "rb", name: "Reto Brunner" }, { user_id: "l", name: "Lea Schmid" }, { user_id: "m", name: "Mia" },
  ];
  it("detects a mention being typed", async () => {
    const { mentionQuery } = await import("./chat");
    expect(mentionQuery("Hallo @Re")).toBe("Re");
    expect(mentionQuery("@")).toBe("");
    expect(mentionQuery("mail@example")).toBeNull();
    expect(mentionQuery("Hallo @Reto ")).toBeNull();
  });
  it("suggests matching people without the author", async () => {
    const { mentionSuggestions } = await import("./chat");
    expect(mentionSuggestions(people, "ret", "r").map((p) => p.user_id)).toEqual(["rb"]);
  });
  it("inserts the full name and moves the cursor behind it", async () => {
    const { insertMention } = await import("./chat");
    expect(insertMention("Hi @le, bis bald", 6, "Lea Schmid")).toEqual({ text: "Hi @Lea Schmid , bis bald", cursor: 15 });
  });
  it("extracts mentioned people, preferring the longest name", async () => {
    const { extractMentions } = await import("./chat");
    expect(extractMentions("@Reto Brunner und @Mia, bitte melden", people).sort()).toEqual(["m", "rb"]);
    expect(extractMentions("@Reto kurz", people)).toEqual(["r"]);
    expect(extractMentions("kein Name", people)).toEqual([]);
  });
  it("splits text for highlighting", async () => {
    const { splitMentions } = await import("./chat");
    expect(splitMentions("Hallo @Lea Schmid!", ["Lea Schmid", "Mia"])).toEqual([
      { text: "Hallo ", mention: false }, { text: "@Lea Schmid", mention: true }, { text: "!", mention: false },
    ]);
  });
});

describe("direct messages, reactions, replies", () => {
  const dm = ch({ id: "d", kind: "direct", name: null, group_id: null, group_name: null, group_type: null, peer: { user_id: "u", pilot_name: "Lea Schmid" } });
  it("titles direct channels by the other person and filters them", async () => {
    const { channelTitle, filterChannels } = await import("./chat");
    expect(channelTitle(dm)).toBe("Lea Schmid");
    expect(channelTitle({ ...dm, peer: null })).toBe("Pilot");
    expect(filterChannels([dm, school], "direct").map((c) => c.id)).toEqual(["d"]);
    expect(filterChannels([dm, school], "all", "lea").map((c) => c.id)).toEqual(["d"]);
  });
  it("builds initials", async () => {
    const { initials } = await import("./chat");
    expect(initials("Lea Schmid")).toBe("LS");
    expect(initials("mia")).toBe("M");
    expect(initials("  ")).toBe("?");
  });
  it("groups reactions by emoji", async () => {
    const { groupReactions } = await import("./chat");
    expect(groupReactions([
      { message_id: "m", user_id: "a", emoji: "👍" }, { message_id: "m", user_id: "b", emoji: "❤️" }, { message_id: "m", user_id: "b", emoji: "👍" },
    ], "b")).toEqual([
      { emoji: "👍", count: 2, mine: true, userIds: ["a", "b"] }, { emoji: "❤️", count: 1, mine: true, userIds: ["b"] },
    ]);
  });
  it("shortens reply previews", async () => {
    const { replySnippet } = await import("./chat");
    expect(replySnippet("  Hallo\n  Welt ", false)).toBe("Hallo Welt");
    expect(replySnippet("", true)).toBe("📎");
    expect(replySnippet("abcdefghij", false, 5)).toBe("abcd…");
  });
});
