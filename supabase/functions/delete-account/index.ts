// Edge Function: Permanently delete the authenticated user's account.
// Cascades remove all owned rows (flights, profiles, etc.) via FK ON DELETE CASCADE on auth.users.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Service-role client to delete the auth user (cascades to public tables)
    const admin = createClient(supabaseUrl, serviceKey);

    // Best-effort cleanup of storage objects owned by the user
    try {
      const { data: igc } = await admin.storage.from("igc-files").list(user.id, { limit: 1000 });
      if (igc?.length) {
        await admin.storage.from("igc-files").remove(igc.map(o => `${user.id}/${o.name}`));
      }
    } catch (_) {}
    try {
      const { data: photos } = await admin.storage.from("flight-photos").list(user.id, { limit: 1000 });
      if (photos?.length) {
        await admin.storage.from("flight-photos").remove(photos.map(o => `${user.id}/${o.name}`));
      }
    } catch (_) {}

    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) {
      return new Response(JSON.stringify({ error: delErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
