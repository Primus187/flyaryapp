import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const caller = userData?.user;
    if (userError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const eventId = typeof body.event_id === "string" ? body.event_id : "";
    const title = typeof body.title === "string" ? body.title.slice(0, 120) : "";
    const message = typeof body.message === "string" ? body.message.slice(0, 4000) : "";
    const audience = body.audience === "group" ? "group" : "participants";
    if (!eventId || !title || !message) {
      return new Response(JSON.stringify({ error: "event_id, title and message are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: event } = await admin.from("flight_events").select("id, group_id").eq("id", eventId).single();
    if (!event) {
      return new Response(JSON.stringify({ error: "Event not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Authorize: group admin, instructor or school lead
    const { data: membership } = await admin.from("group_members").select("role").eq("group_id", event.group_id).eq("user_id", caller.id).maybeSingle();
    const { data: funcs } = await admin.from("group_member_functions").select("function").eq("group_id", event.group_id).eq("user_id", caller.id);
    const roles = (funcs || []).map((f: any) => f.function);
    const isStaff = membership?.role === "admin" || roles.includes("instructor") || roles.includes("school_lead");
    if (!isStaff) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Recipients
    let recipientIds: string[] = [];
    if (audience === "group") {
      const { data: members } = await admin.from("group_members").select("user_id").eq("group_id", event.group_id);
      recipientIds = (members || []).map((m: any) => m.user_id);
    } else {
      const { data: sups } = await admin.from("event_signups").select("user_id").eq("event_id", eventId).eq("signed_up", true);
      recipientIds = (sups || []).map((s: any) => s.user_id);
    }
    recipientIds = [...new Set(recipientIds)].filter((uid) => uid !== caller.id);

    // Persist the announcement in the event chat so it stays readable
    await admin.from("event_messages").insert({ event_id: eventId, user_id: caller.id, message });

    let sent = 0;
    for (const userId of recipientIds) {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ user_id: userId, title, body: message, url: `/events/${eventId}` }),
      });
      if (res.ok) {
        const json = await res.json().catch(() => ({ sent: 0 }));
        sent += json.sent || 0;
      } else {
        console.error(`send-push failed [${res.status}]: ${await res.text()}`);
      }
    }

    return new Response(JSON.stringify({ recipients: recipientIds.length, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notify-event-participants error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
