// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Isolated PostgreSQL fixture with real RLS for migration 0025 (chat channels). Only the columns,
// helper functions and the storage/realtime objects the migration touches are represented.
let db: PGlite;
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const admin = id(1), instructor = id(2), helper = id(3), groundStudent = id(4), altStudent = id(5),
  licensed = id(6), outsider = id(7), pilotMember = id(8);
const school = id(101), pilotGroup = id(102);
const eventId = id(201);

async function asUser(uid: string) {
  await db.exec(`RESET ROLE; SET app.user_id = '${uid}'; SET ROLE authenticated;`);
}
async function asAdminDb() { await db.exec("RESET ROLE"); }
const sorted = (names: string[]) => [...names].sort((a, b) => a.localeCompare(b, "de"));
async function visibleChannelNames(uid: string) {
  await asUser(uid);
  const rows = (await db.query<{ label: string }>(`SELECT coalesce(name, 'event') AS label FROM public.chat_channels`)).rows;
  return sorted(rows.map((r) => r.label));
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon;
    CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA extensions; CREATE PUBLICATION supabase_realtime;
    GRANT USAGE ON SCHEMA auth, storage TO authenticated;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE TABLE storage.objects (id uuid DEFAULT gen_random_uuid(), bucket_id text, name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
    CREATE TYPE public.group_type AS ENUM ('school', 'pilot_group');
    CREATE TABLE public.groups (id uuid PRIMARY KEY, name text, group_type public.group_type, created_by uuid, created_at timestamptz DEFAULT now());
    CREATE TABLE public.group_members (group_id uuid, user_id uuid, role text, joined_at timestamptz DEFAULT now());
    CREATE TABLE public.group_member_functions (group_id uuid, user_id uuid, function text);
    CREATE TABLE public.profiles (user_id uuid PRIMARY KEY, pilot_name text, training_level text, avatar_url text, created_at timestamptz DEFAULT now());
    CREATE TABLE public.flight_events (id uuid PRIMARY KEY, group_id uuid, title text, event_date timestamptz, created_by uuid);
    CREATE TABLE public.event_signups (event_id uuid, user_id uuid, signed_up boolean);
    CREATE TABLE public.event_staff (event_id uuid, user_id uuid);
    CREATE TABLE public.group_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid, user_id uuid, message text,
      attachment_path text, is_announcement boolean, is_team_only boolean, requires_confirmation boolean, created_at timestamptz DEFAULT now());
    CREATE TABLE public.event_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid, user_id uuid, message text, created_at timestamptz DEFAULT now());
    CREATE TABLE public.announcement_read_receipts (message_id uuid, user_id uuid, confirmed_at timestamptz DEFAULT now());
    CREATE TABLE public.pushes (user_id uuid, title text);
    CREATE TABLE public.notifications (id uuid DEFAULT gen_random_uuid(), user_id uuid, actor_id uuid, type text, reference_id uuid,
      reference_type text, read boolean DEFAULT false, created_at timestamptz DEFAULT now());
    CREATE FUNCTION public.send_push_notification(u uuid, t text, b text, url text) RETURNS void LANGUAGE sql AS $$ INSERT INTO public.pushes VALUES (u, t) $$;
    CREATE FUNCTION public.is_group_member(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
      SELECT EXISTS (SELECT 1 FROM public.group_members WHERE user_id = u AND group_id = g) $$;
    CREATE FUNCTION public.is_group_admin(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
      SELECT EXISTS (SELECT 1 FROM public.group_members WHERE user_id = u AND group_id = g AND role = 'admin') $$;
    CREATE FUNCTION public.is_group_staff(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
      SELECT public.is_group_admin(u, g) OR EXISTS (SELECT 1 FROM public.group_member_functions WHERE user_id = u AND group_id = g AND function IN ('instructor', 'school_lead')) $$;
    CREATE FUNCTION public.is_group_team_member(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
      SELECT public.is_group_admin(u, g) OR EXISTS (SELECT 1 FROM public.group_member_functions WHERE user_id = u AND group_id = g AND function IN ('instructor', 'school_lead', 'launch_helper')) $$;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT SELECT, INSERT, DELETE ON storage.objects TO authenticated;

    INSERT INTO auth.users SELECT ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid FROM generate_series(1, 8) n;
    INSERT INTO public.groups VALUES ('${school}', 'Vertical', 'school', '${admin}'), ('${pilotGroup}', 'Freunde', 'pilot_group', '${pilotMember}');
    INSERT INTO public.group_members (group_id, user_id, role) VALUES
      ('${school}', '${admin}', 'admin'), ('${school}', '${instructor}', 'member'), ('${school}', '${helper}', 'member'),
      ('${school}', '${groundStudent}', 'member'), ('${school}', '${altStudent}', 'member'), ('${school}', '${licensed}', 'member'),
      ('${pilotGroup}', '${pilotMember}', 'admin'), ('${pilotGroup}', '${groundStudent}', 'member');
    INSERT INTO public.group_member_functions VALUES ('${school}', '${instructor}', 'instructor'), ('${school}', '${helper}', 'launch_helper'),
      ('${school}', '${groundStudent}', 'student'), ('${school}', '${licensed}', 'licensed');
    INSERT INTO public.profiles VALUES ('${admin}', 'Admin', null), ('${instructor}', 'Instruktor', null), ('${helper}', 'Helfer', null),
      ('${groundStudent}', 'Mia', 'ground'), ('${altStudent}', 'Jonas', 'altitude'), ('${licensed}', 'Tim', 'licensed');
    INSERT INTO public.flight_events VALUES ('${eventId}', '${school}', 'Höhenflugtag', now() + interval '3 days', '${admin}');
    INSERT INTO public.event_signups VALUES ('${eventId}', '${altStudent}', true), ('${eventId}', '${groundStudent}', false);
    -- existing chats before the migration
    INSERT INTO public.group_messages (id, group_id, user_id, message, is_announcement, is_team_only, requires_confirmation) VALUES
      ('${id(301)}', '${school}', '${admin}', 'Willkommen!', true, false, true),
      ('${id(302)}', '${school}', '${instructor}', 'Team intern', false, true, false);
    INSERT INTO public.announcement_read_receipts VALUES ('${id(301)}', '${groundStudent}', now());
    INSERT INTO public.event_messages (id, event_id, user_id, message) VALUES ('${id(303)}', '${eventId}', '${altStudent}', 'Fahre ab Bern');
  `);
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0025_chat_channels.sql", import.meta.url), "utf8").replace("NOTIFY pgrst, 'reload schema';", ""));
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0026_chat_channel_returning.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0028_chat_notifications.sql", import.meta.url), "utf8").replace("NOTIFY pgrst, 'reload schema';", ""));
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0029_chat_direct_replies_reactions.sql", import.meta.url), "utf8").replace("NOTIFY pgrst, 'reload schema';", ""));
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0030_chat_edit_message.sql", import.meta.url), "utf8").replace("NOTIFY pgrst, 'reload schema';", ""));
  // Marketplace up to the listing chat (0036), which changes chat_can_read/_post, the channel JSON, inbox and push.
  // Everything above keeps running against the changed functions.
  await db.exec(`
    CREATE TYPE public.group_function AS ENUM ('student', 'licensed', 'launch_helper', 'instructor', 'school_lead');
    CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
    CREATE TABLE public.user_roles (user_id uuid, role public.app_role);
    CREATE TABLE public.flights (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid);
    CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
      SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
    CREATE FUNCTION public.has_group_function(_user_id uuid, _group_id uuid, _function public.group_function)
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
      SELECT EXISTS (SELECT 1 FROM public.group_member_functions WHERE user_id = _user_id AND group_id = _group_id AND function = _function::text) $$;
  `);
  for (const name of ["0031_marketplace_group_functions", "0032_marketplace_listings", "0033_marketplace_photos",
    "0034_marketplace_listing_status", "0035_marketplace_search", "0036_marketplace_listing_chat", "0037_school_shop", "0038_marketplace_moderation", "0039_marketplace_cleanup", "0041_marketplace_terms"]) {
    await db.exec(readFileSync(new URL(`../../drizzle/migrations/${name}.sql`, import.meta.url), "utf8").replace("NOTIFY pgrst, 'reload schema';", ""));
  }
  // Channels created by staff after the migration
  await asAdminDb();
  await db.exec(`
    INSERT INTO public.chat_channels (id, kind, group_id, name, audience, audience_levels, created_by) VALUES
      ('${id(401)}', 'group', '${school}', 'Grundkurs', 'students', ARRAY['ground'], '${instructor}'),
      ('${id(402)}', 'group', '${school}', 'Alle Schüler', 'students', NULL, '${instructor}'),
      ('${id(403)}', 'group', '${school}', 'Experienced', 'custom', NULL, '${admin}');
    INSERT INTO public.chat_channel_members (channel_id, user_id) VALUES ('${id(403)}', '${licensed}');
  `);
});

afterAll(async () => { await db.close(); });

describe("chat channels: who sees what", () => {
  it("creates default channels and one channel per event, and copies the old chats", async () => {
    await asAdminDb();
    const channels = (await db.query<{ kind: string; name: string | null; group_id: string }>(
      `SELECT kind, name, group_id FROM public.chat_channels WHERE is_default OR kind = 'event' ORDER BY kind, name`)).rows;
    expect(channels).toEqual([
      { kind: "event", name: null, group_id: school },
      { kind: "group", name: "Allgemein", group_id: pilotGroup },
      { kind: "group", name: "Allgemein", group_id: school },
      { kind: "group", name: "Team", group_id: school },
    ]);
    const copied = (await db.query<{ id: string; name: string }>(`SELECT m.id, coalesce(c.name, 'event') AS name FROM public.chat_messages m
      JOIN public.chat_channels c ON c.id = m.channel_id ORDER BY m.id`)).rows;
    expect(copied).toEqual([{ id: id(301), name: "Allgemein" }, { id: id(302), name: "Team" }, { id: id(303), name: "event" }]);
    expect((await db.query(`SELECT 1 FROM public.chat_message_receipts WHERE message_id = '${id(301)}'`)).rows).toHaveLength(1);
  });

  it("gives every role exactly its channels", async () => {
    // staff (admin, instructor) see every channel of the school
    expect(await visibleChannelNames(admin)).toEqual(sorted(["Allgemein", "Alle Schüler", "event", "Experienced", "Grundkurs", "Team"]));
    expect(await visibleChannelNames(instructor)).toEqual(sorted(["Allgemein", "Alle Schüler", "event", "Experienced", "Grundkurs", "Team"]));
    // launch helper: team + event, not the student channels
    expect(await visibleChannelNames(helper)).toEqual(sorted(["Allgemein", "event", "Team"]));
    // ground student: student channels incl. level "ground"; not signed up for the event; plus own pilot group
    expect(await visibleChannelNames(groundStudent)).toEqual(sorted(["Allgemein", "Allgemein", "Alle Schüler", "Grundkurs"]));
    // altitude student: not in the ground-level channel, but signed up for the event
    expect(await visibleChannelNames(altStudent)).toEqual(sorted(["Allgemein", "Alle Schüler", "event"]));
    // licensed pilot: not a student; explicitly added to Experienced
    expect(await visibleChannelNames(licensed)).toEqual(sorted(["Allgemein", "Experienced"]));
    expect(await visibleChannelNames(outsider)).toEqual(sorted([]));
  });

  it("hides messages of channels one cannot read", async () => {
    await asUser(groundStudent);
    const texts = (await db.query<{ message: string }>(`SELECT message FROM public.chat_messages ORDER BY message`)).rows.map((r) => r.message);
    expect(texts).toEqual(["Willkommen!"]);
  });
});

describe("chat channels: writing and managing", () => {
  it("lets members post but only staff announce; archived channels are read-only", async () => {
    const allgemein = (await db.query<{ id: string }>(`SELECT id FROM public.chat_channels WHERE group_id = '${school}' AND name = 'Allgemein'`)).rows[0].id;
    await asUser(altStudent);
    await db.exec(`INSERT INTO public.chat_messages (channel_id, user_id, message) VALUES ('${allgemein}', '${altStudent}', 'Hallo')`);
    await expect(db.exec(`INSERT INTO public.chat_messages (channel_id, user_id, message, is_announcement) VALUES ('${allgemein}', '${altStudent}', 'Wichtig', true)`)).rejects.toThrow();
    await expect(db.exec(`INSERT INTO public.chat_messages (channel_id, user_id, message) VALUES ('${id(401)}', '${altStudent}', 'darf nicht')`)).rejects.toThrow();
    await asUser(instructor);
    await db.exec(`INSERT INTO public.chat_messages (channel_id, user_id, message, is_announcement) VALUES ('${allgemein}', '${instructor}', 'Treffpunkt 8 Uhr', true)`);
    await asAdminDb();
    const pushed = (await db.query<{ user_id: string }>(`SELECT user_id FROM public.pushes WHERE title LIKE 'Ankündigung: Allgemein' ORDER BY user_id`)).rows.map((r) => r.user_id);
    expect(pushed).toEqual([admin, helper, groundStudent, altStudent, licensed]); // everyone who can read, except the author
    await db.exec(`UPDATE public.chat_channels SET archived_at = now() WHERE id = '${id(402)}'`);
    await asUser(groundStudent);
    await expect(db.exec(`INSERT INTO public.chat_messages (channel_id, user_id, message) VALUES ('${id(402)}', '${groundStudent}', 'zu spät')`)).rejects.toThrow();
  });

  it("lets instructors create channels, but not students or other schools' staff", async () => {
    await asUser(instructor);
    // Like the app: insert and read the new row back in one statement (INSERT ... RETURNING).
    const created = await db.query<{ id: string }>(`INSERT INTO public.chat_channels (kind, group_id, name, audience, created_by)
      VALUES ('group', '${school}', 'Camp Tessin', 'custom', '${instructor}') RETURNING id`);
    expect(created.rows).toHaveLength(1);
    await asUser(altStudent);
    await expect(db.exec(`INSERT INTO public.chat_channels (kind, group_id, name, created_by) VALUES ('group', '${school}', 'Meins', '${altStudent}')`)).rejects.toThrow();
    await asUser(pilotMember);
    await expect(db.exec(`INSERT INTO public.chat_channels (kind, group_id, name, created_by) VALUES ('group', '${school}', 'Fremd', '${pilotMember}')`)).rejects.toThrow();
    // default channels cannot be deleted
    await asUser(admin);
    await db.exec(`DELETE FROM public.chat_channels WHERE group_id = '${school}' AND is_default`);
    await asAdminDb();
    expect((await db.query(`SELECT 1 FROM public.chat_channels WHERE group_id = '${school}' AND is_default`)).rows).toHaveLength(2);
  });

  it("forwards messages written by old app versions and creates channels for new groups/events", async () => {
    await asAdminDb();
    await db.exec(`INSERT INTO public.group_messages (id, group_id, user_id, message, is_team_only) VALUES ('${id(501)}', '${school}', '${helper}', 'alte App', true);
      INSERT INTO public.groups VALUES ('${id(103)}', 'Neue Schule', 'school', '${admin}');
      INSERT INTO public.flight_events VALUES ('${id(202)}', '${school}', 'Neuer Tag', now() + interval '9 days', '${admin}');`);
    expect((await db.query(`SELECT 1 FROM public.chat_messages m JOIN public.chat_channels c ON c.id = m.channel_id WHERE m.id = '${id(501)}' AND c.name = 'Team'`)).rows).toHaveLength(1);
    expect((await db.query(`SELECT name FROM public.chat_channels WHERE group_id = '${id(103)}' ORDER BY name`)).rows).toEqual([{ name: "Allgemein" }, { name: "Team" }]);
    expect((await db.query(`SELECT 1 FROM public.chat_channels WHERE event_id = '${id(202)}'`)).rows).toHaveLength(1);
  });

  it("reports unread counts in the inbox and resets them on read", async () => {
    await asUser(groundStudent);
    const inbox = (await db.query<{ chat_inbox: Array<{ name: string | null; unread: number; group_name: string }> }>(`SELECT public.chat_inbox()`)).rows[0].chat_inbox;
    const allgemein = inbox.find((c) => c.name === "Allgemein" && c.group_name === "Vertical")!;
    expect(allgemein.unread).toBe(2); // Hallo, Treffpunkt (Willkommen predates the fixture join time)
    const channelId = (await db.query<{ id: string }>(`SELECT id FROM public.chat_channels WHERE group_id = '${school}' AND name = 'Allgemein'`)).rows[0].id;
    await db.exec(`SELECT public.chat_mark_read('${channelId}')`);
    const after = (await db.query<{ chat_inbox: Array<{ id: string; unread: number }> }>(`SELECT public.chat_inbox()`)).rows[0].chat_inbox;
    expect(after.find((c) => c.id === channelId)!.unread).toBe(0);
  });

  it("returns the event chat only to signed-up pilots and the team", async () => {
    const eventChannel = async (uid: string) => {
      await asUser(uid);
      return (await db.query<{ c: { kind: string; event_title: string; can_post: boolean } | null }>(`SELECT public.chat_event_channel('${eventId}') AS c`)).rows[0].c;
    };
    expect(await eventChannel(groundStudent)).toBeNull(); // signed off
    expect(await eventChannel(altStudent)).toMatchObject({ kind: "event", event_title: "Höhenflugtag", can_post: true });
    expect(await eventChannel(helper)).toMatchObject({ kind: "event" });
  });

  it("protects channel attachments like the channel itself", async () => {
    await asAdminDb();
    await db.exec(`INSERT INTO storage.objects (bucket_id, name) VALUES ('chat-attachments', 'channel/${id(401)}/${instructor}/plan.pdf')`);
    await asUser(groundStudent);
    expect((await db.query(`SELECT name FROM storage.objects`)).rows).toHaveLength(1);
    await asUser(altStudent);
    expect((await db.query(`SELECT name FROM storage.objects`)).rows).toHaveLength(0);
  });
});

describe("chat notifications (stage 2)", () => {
  let team: string;
  const pushesFor = async (uid: string) => {
    await asAdminDb();
    return (await db.query<{ title: string }>(`SELECT title FROM public.pushes WHERE user_id = '${uid}' ORDER BY title`)).rows.map((r) => r.title);
  };
  const post = async (author: string, message: string, mentions: string[] = [], announcement = false) => {
    await asUser(author);
    const list = mentions.map((m) => `'${m}'`).join(",");
    await db.exec(`INSERT INTO public.chat_messages (channel_id, user_id, message, mentions, is_announcement)
      VALUES ('${team}', '${author}', '${message}', ARRAY[${list}]::uuid[], ${announcement})`);
  };
  const setLevel = async (uid: string, level: string) => {
    await asUser(uid);
    await db.exec(`SELECT public.chat_set_notify_level('${team}', '${level}')`);
  };

  beforeAll(async () => {
    await asAdminDb();
    team = (await db.query<{ id: string }>(`SELECT id FROM public.chat_channels WHERE group_id = '${school}' AND name = 'Team'`)).rows[0].id;
    await db.exec("DELETE FROM public.pushes; DELETE FROM public.notifications;");
  });

  it("pushes only mentions by default and records them in the bell", async () => {
    await post(instructor, "Wer macht Samstag Startleiter?");
    expect(await pushesFor(helper)).toEqual([]);
    await post(instructor, "@Helfer kannst du?", [helper]);
    expect(await pushesFor(helper)).toEqual(["Instruktor hat dich erwähnt · Team"]);
    expect((await db.query(`SELECT 1 FROM public.notifications WHERE user_id = '${helper}' AND type = 'chat_mention' AND reference_id = '${team}'`)).rows).toHaveLength(1);
  });

  it("bundles 'all messages' to one push per channel within five minutes", async () => {
    await setLevel(admin, "all");
    await post(instructor, "Erste");
    await post(instructor, "Zweite");
    expect((await pushesFor(admin)).filter((title) => title === "Team")).toHaveLength(1);
  });

  it("mutes mentions but never announcements", async () => {
    await setLevel(helper, "none");
    await asAdminDb();
    await db.exec("DELETE FROM public.pushes");
    await post(instructor, "@Helfer nochmals", [helper]);
    expect(await pushesFor(helper)).toEqual([]);
    await post(instructor, "Briefing 7 Uhr", [], true);
    expect(await pushesFor(helper)).toEqual(["Ankündigung: Team"]);
  });

  it("ignores mentions of people who cannot read the channel", async () => {
    await asAdminDb();
    await db.exec("DELETE FROM public.pushes; DELETE FROM public.notifications;");
    await post(instructor, "@Mia ist nicht im Team", [groundStudent]);
    expect(await pushesFor(groundStudent)).toEqual([]);
    expect((await db.query(`SELECT 1 FROM public.notifications WHERE user_id = '${groundStudent}'`)).rows).toHaveLength(0);
  });

  it("reports the caller's push level in the channel JSON", async () => {
    await asUser(helper);
    expect((await db.query<{ c: { notify_level: string } }>(`SELECT public.chat_channel_json('${team}') AS c`)).rows[0].c.notify_level).toBe("none");
    await asUser(instructor);
    expect((await db.query<{ c: { notify_level: string } }>(`SELECT public.chat_channel_json('${team}') AS c`)).rows[0].c.notify_level).toBe("mentions");
  });
});

describe("direct messages, replies, reactions, search (stage 3)", () => {
  const openDirect = async (me: string, other: string) => {
    await asUser(me);
    return (await db.query<{ id: string }>(`SELECT public.chat_open_direct('${other}') AS id`)).rows[0].id;
  };
  const pushesFor = async (uid: string) => {
    await asAdminDb();
    return (await db.query<{ title: string }>(`SELECT title FROM public.pushes WHERE user_id = '${uid}'`)).rows.map((r) => r.title);
  };
  const channelNamed = async (name: string) => {
    await asAdminDb();
    return (await db.query<{ id: string }>(`SELECT id FROM public.chat_channels WHERE group_id = '${school}' AND name = '${name}'`)).rows[0].id;
  };
  const firstMessageIn = async (channel: string) => {
    await asAdminDb();
    return (await db.query<{ id: string }>(`SELECT id FROM public.chat_messages WHERE channel_id = '${channel}' LIMIT 1`)).rows[0].id;
  };

  it("opens one direct channel per pair, only for people sharing a group", async () => {
    const dm = await openDirect(groundStudent, pilotMember);
    expect(await openDirect(pilotMember, groundStudent)).toBe(dm);
    await asUser(outsider);
    await expect(db.query(`SELECT public.chat_open_direct('${groundStudent}')`)).rejects.toThrow(/shared group/);
    await asUser(groundStudent);
    await expect(db.query(`SELECT public.chat_open_direct('${groundStudent}')`)).rejects.toThrow(/invalid person/);
    await asUser(altStudent);
    expect((await db.query(`SELECT 1 FROM public.chat_channels WHERE id = '${dm}'`)).rows).toHaveLength(0);
    expect((await db.query(`SELECT 1 FROM public.chat_messages WHERE channel_id = '${dm}'`)).rows).toHaveLength(0);
  });

  it("lists people to write to and names the peer in the channel JSON", async () => {
    await asUser(pilotMember);
    const people = (await db.query<{ user_id: string; groups: string[] }>("SELECT * FROM public.chat_direct_candidates()")).rows;
    expect(people.map((p) => p.user_id)).toEqual([groundStudent]);
    expect(people[0].groups).toEqual(["Freunde"]);
    const dm = await openDirect(pilotMember, groundStudent);
    const json = (await db.query<{ c: { kind: string; peer: { pilot_name: string }; can_post: boolean } }>(`SELECT public.chat_channel_json('${dm}') AS c`)).rows[0].c;
    expect(json).toMatchObject({ kind: "direct", peer: { pilot_name: "Mia" }, can_post: true });
  });

  it("keeps empty direct channels out of the inbox and pushes direct messages bundled", async () => {
    const dm = await openDirect(pilotMember, groundStudent);
    const inboxIds = async (uid: string) => {
      await asUser(uid);
      return (await db.query<{ i: { id: string }[] }>("SELECT public.chat_inbox() AS i")).rows[0].i.map((c) => c.id);
    };
    expect(await inboxIds(groundStudent)).not.toContain(dm);
    await asAdminDb();
    await db.exec("DELETE FROM public.pushes");
    await asUser(pilotMember);
    await db.exec(`INSERT INTO public.chat_messages (channel_id, user_id, message) VALUES ('${dm}', '${pilotMember}', 'Fliegen wir morgen?')`);
    await db.exec(`INSERT INTO public.chat_messages (channel_id, user_id, message) VALUES ('${dm}', '${pilotMember}', 'Hallo?')`);
    expect(await pushesFor(groundStudent)).toHaveLength(1);
    expect(await inboxIds(groundStudent)).toContain(dm);
    // Reading restarts the bundling window
    await asUser(groundStudent);
    await db.exec(`SELECT public.chat_mark_read('${dm}')`);
    await asUser(pilotMember);
    await db.exec(`INSERT INTO public.chat_messages (channel_id, user_id, message) VALUES ('${dm}', '${pilotMember}', 'Noch da?')`);
    expect(await pushesFor(groundStudent)).toHaveLength(2);
  });

  it("accepts replies only within the same channel", async () => {
    const general = await channelNamed("Allgemein");
    const teamMessage = await firstMessageIn(await channelNamed("Team"));
    const generalMessage = await firstMessageIn(general);
    await asUser(instructor);
    await db.exec(`INSERT INTO public.chat_messages (channel_id, user_id, message, reply_to) VALUES ('${general}', '${instructor}', 'Genau', '${generalMessage}')`);
    await expect(db.exec(`INSERT INTO public.chat_messages (channel_id, user_id, message, reply_to) VALUES ('${general}', '${instructor}', 'Leak', '${teamMessage}')`))
      .rejects.toThrow(/row-level security/);
  });

  it("lets readers react once per emoji and remove only their own reactions", async () => {
    const msg = await firstMessageIn(await channelNamed("Allgemein"));
    await asUser(groundStudent);
    await db.exec(`INSERT INTO public.chat_message_reactions (message_id, user_id, emoji) VALUES ('${msg}', '${groundStudent}', '👍')`);
    await expect(db.exec(`INSERT INTO public.chat_message_reactions (message_id, user_id, emoji) VALUES ('${msg}', '${groundStudent}', '👍')`)).rejects.toThrow(/duplicate/);
    await asUser(outsider);
    await expect(db.exec(`INSERT INTO public.chat_message_reactions (message_id, user_id, emoji) VALUES ('${msg}', '${outsider}', '👍')`)).rejects.toThrow(/row-level security/);
    expect((await db.query("SELECT 1 FROM public.chat_message_reactions")).rows).toHaveLength(0);
    await asUser(altStudent);
    await db.exec(`DELETE FROM public.chat_message_reactions WHERE message_id = '${msg}'`);
    await asUser(groundStudent);
    expect((await db.query(`SELECT 1 FROM public.chat_message_reactions WHERE message_id = '${msg}'`)).rows).toHaveLength(1);
  });

  it("searches only messages the caller can read", async () => {
    const search = async (uid: string, q: string) => {
      await asUser(uid);
      return (await db.query<{ r: { message: string }[] }>(`SELECT public.chat_search('${q}') AS r`)).rows[0].r.map((m) => m.message);
    };
    expect(await search(instructor, "intern")).toContain("Team intern");
    expect(await search(groundStudent, "intern")).toEqual([]);
    expect(await search(groundStudent, "morgen")).toEqual(["Fliegen wir morgen?"]);
    expect(await search(groundStudent, "%%")).toEqual([]);
    expect(await search(groundStudent, "m")).toEqual([]);
  });
});

describe("editing messages", () => {
  it("lets only the author edit the text and marks it as edited", async () => {
    await asAdminDb();
    const general = (await db.query<{ id: string }>(`SELECT id FROM public.chat_channels WHERE group_id = '${school}' AND name = 'Allgemein'`)).rows[0].id;
    await asUser(altStudent);
    const msg = (await db.query<{ id: string }>(`INSERT INTO public.chat_messages (channel_id, user_id, message) VALUES ('${general}', '${altStudent}', 'Tippfeler') RETURNING id`)).rows[0].id;
    await db.exec(`SELECT public.chat_edit_message('${msg}', ' Tippfehler ')`);
    const row = (await db.query<{ message: string; edited_at: string | null }>(`SELECT message, edited_at FROM public.chat_messages WHERE id = '${msg}'`)).rows[0];
    expect(row.message).toBe("Tippfehler");
    expect(row.edited_at).not.toBeNull();
    await expect(db.exec(`SELECT public.chat_edit_message('${msg}', '   ')`)).rejects.toThrow(/cannot be edited/);
    await asUser(admin);
    await expect(db.exec(`SELECT public.chat_edit_message('${msg}', 'Admin war hier')`)).rejects.toThrow(/cannot be edited/);
    await expect(db.exec(`UPDATE public.chat_messages SET message = 'direkt' WHERE id = '${msg}'`)).resolves.toBeDefined();
    await asAdminDb();
    expect((await db.query<{ message: string }>(`SELECT message FROM public.chat_messages WHERE id = '${msg}'`)).rows[0].message).toBe("Tippfehler");
  });
});

describe("listing chats (marketplace 4.6)", () => {
  // licensed runs the school shop; outsider shares no group with anyone and still may ask about listings
  const shopMember = licensed;
  let privateListing: string, schoolListing: string, draftListing: string;
  const listing = async (seller: string | null, group: string | null, title: string, status = "active") => {
    await asAdminDb();
    return (await db.query<{ id: string }>(`INSERT INTO public.marketplace_listings (seller_user_id, seller_group_id, created_by, category, title,
      price_cents, status, published_at, bumped_at, expires_at) VALUES ($1, $2, $3, 'glider', $4, 150000, $5, now(), now(), now() + interval '60 days')
      RETURNING id`, [seller, group, seller ?? admin, title, status])).rows[0].id;
  };
  const openChat = async (uid: string, l: string) => {
    await asUser(uid);
    return (await db.query<{ id: string }>(`SELECT public.marketplace_open_chat('${l}') AS id`)).rows[0].id;
  };
  const post = async (uid: string, channel: string, message: string) => {
    await asUser(uid);
    await db.exec(`INSERT INTO public.chat_messages (channel_id, user_id, message) VALUES ('${channel}', '${uid}', '${message}')`);
  };
  const canRead = async (uid: string, channel: string) => {
    await asUser(uid);
    return (await db.query(`SELECT 1 FROM public.chat_messages WHERE channel_id = '${channel}'`)).rows.length > 0;
  };
  const json = async (uid: string, channel: string) => {
    await asUser(uid);
    return (await db.query<{ c: { kind: string; can_post: boolean; listing: Record<string, unknown> | null } }>(
      `SELECT public.chat_channel_json('${channel}') AS c`)).rows[0].c;
  };

  beforeAll(async () => {
    await asAdminDb();
    await db.exec(`
      INSERT INTO public.profiles (user_id, pilot_name) VALUES ('${outsider}', 'Olivia'), ('${pilotMember}', 'Paula')
        ON CONFLICT (user_id) DO UPDATE SET pilot_name = excluded.pilot_name;
      INSERT INTO public.group_member_functions VALUES ('${school}', '${shopMember}', 'shop');
      INSERT INTO public.school_shop_profiles (group_id, legal_name, street, postal_code, locality, email, warranty_text, active)
      VALUES ('${school}', 'Vertical GmbH', 'Hauptstrasse 1', '3800', 'Interlaken', 'shop@vertical.ch', 'Gewährleistung 2 Jahre', true);
      DELETE FROM public.pushes;
    `);
    privateListing = await listing(pilotMember, null, "Advance Alpha 7");
    schoolListing = await listing(null, school, "Schulschirm Occasion");
    draftListing = await listing(pilotMember, null, "Entwurf", "draft");
  });

  it("opens one chat per listing and buyer, without a shared group", async () => {
    const chat = await openChat(outsider, privateListing);
    expect(await openChat(outsider, privateListing)).toBe(chat);
    await asUser(pilotMember);
    await expect(db.query(`SELECT public.marketplace_open_chat('${privateListing}')`)).rejects.toThrow("marketplace:own_listing");
    await asUser(outsider);
    await expect(db.query(`SELECT public.marketplace_open_chat('${draftListing}')`)).rejects.toThrow("marketplace:not_found");
    await asUser(outsider);
    await expect(db.exec(`INSERT INTO public.chat_channels (kind, name, listing_id, buyer_id) VALUES ('listing', 'x', '${privateListing}', '${outsider}')`)).rejects.toThrow();
  });

  it("private listing: buyer and seller talk, nobody else reads; pushes like a direct message", async () => {
    const chat = await openChat(outsider, privateListing);
    await post(outsider, chat, "Ist der Schirm noch da?");
    await post(pilotMember, chat, "Ja, gerne vorbeikommen");
    expect(await canRead(outsider, chat)).toBe(true);
    expect(await canRead(pilotMember, chat)).toBe(true);
    expect(await canRead(groundStudent, chat)).toBe(false);
    expect(await canRead(admin, chat)).toBe(false);
    await asAdminDb();
    expect((await db.query<{ title: string }>(`SELECT title FROM public.pushes WHERE user_id = '${pilotMember}'`)).rows.map((r) => r.title))
      .toEqual(["Advance Alpha 7"]);
    expect(await json(outsider, chat)).toMatchObject({ kind: "listing", can_post: true,
      listing: { title: "Advance Alpha 7", i_am_buyer: true, peer_name: "Paula", status: "active", is_school: false } });
    expect((await json(pilotMember, chat)).listing).toMatchObject({ i_am_buyer: false, peer_name: "Olivia" });
  });

  it("school listing: the shop team answers; instructors and students do not see the chat", async () => {
    const chat = await openChat(outsider, schoolListing);
    await post(outsider, chat, "Welche Grösse?");
    await post(shopMember, chat, "Grösse M");
    expect(await canRead(admin, chat)).toBe(true);
    expect(await canRead(instructor, chat)).toBe(false);
    expect(await canRead(groundStudent, chat)).toBe(false);
    await asUser(instructor);
    expect((await db.query(`SELECT 1 FROM public.chat_channels WHERE id = '${chat}'`)).rows).toHaveLength(0);
    expect((await json(outsider, chat)).listing).toMatchObject({ peer_name: "Vertical", is_school: true });
    await asUser(shopMember);
    const readers = (await db.query<{ pilot_name: string }>(`SELECT pilot_name FROM public.chat_channel_readers('${chat}') ORDER BY pilot_name`)).rows;
    expect(readers.map((r) => r.pilot_name)).toEqual(["Admin", "Olivia", "Tim"]);
  });

  it("keeps empty listing chats out of the inbox", async () => {
    const empty = await openChat(groundStudent, privateListing);
    const inbox = async (uid: string) => {
      await asUser(uid);
      return (await db.query<{ i: { id: string; kind: string }[] }>("SELECT public.chat_inbox() AS i")).rows[0].i.filter((c) => c.kind === "listing").map((c) => c.id);
    };
    expect(await inbox(groundStudent)).not.toContain(empty);
    expect(await inbox(pilotMember)).toHaveLength(1);
  });

  it("banned people cannot write; the chat outlives the listing", async () => {
    const chat = await openChat(outsider, privateListing);
    await asAdminDb();
    await db.exec(`INSERT INTO public.marketplace_bans (user_id) VALUES ('${outsider}')`);
    await expect(post(outsider, chat, "Hallo?")).rejects.toThrow();
    expect((await json(outsider, chat)).can_post).toBe(false);
    await asAdminDb();
    await db.exec(`DELETE FROM public.marketplace_bans; DELETE FROM public.marketplace_listings WHERE id = '${privateListing}'`);
    expect(await canRead(pilotMember, chat)).toBe(true);
    expect((await json(pilotMember, chat)).listing).toMatchObject({ title: "Advance Alpha 7", status: "removed", listing_id: null });
  });
});
