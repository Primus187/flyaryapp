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

    // Best-effort cleanup of storage objects owned by the user. Files live in nested
    // folders (`<user>/<flight>/<file>`), so list recursively: list() only returns one level
    // and remove() on a folder name deletes nothing.
    const listRecursive = async (bucket: string, prefix: string): Promise<string[]> => {
      const files: string[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset });
        if (!data?.length) break;
        for (const entry of data) {
          const path = `${prefix}/${entry.name}`;
          // Folders have no id in the storage list API.
          if (entry.id) files.push(path);
          else files.push(...await listRecursive(bucket, path));
        }
        if (data.length < 1000) break;
      }
      return files;
    };
    for (const bucket of ["igc-files", "flight-photos", "flight-videos"]) {
      try {
        const paths = await listRecursive(bucket, user.id);
        for (let i = 0; i < paths.length; i += 500) {
          await admin.storage.from(bucket).remove(paths.slice(i, i + 500));
        }
      } catch (e) {
        console.error(`Storage cleanup failed for ${bucket}`, e);
      }
    }

    // Marketplace photos live under the listing id (marketplace-photos/<listing>/<file>), not the user id:
    // collect them through the user's private listings, which the account deletion removes by cascade.
    // (School listings stay with the school.) Anything missed is removed as an orphan by marketplace-cleanup.
    try {
      const { data: listings } = await admin.from("marketplace_listings").select("id").eq("seller_user_id", user.id);
      const ids = (listings ?? []).map((l: { id: string }) => l.id);
      if (ids.length) {
        const { data: photos } = await admin.from("marketplace_listing_photos").select("path, thumb_path").in("listing_id", ids);
        const paths = (photos ?? []).flatMap((p: { path: string; thumb_path: string }) => [p.path, p.thumb_path]);
        for (let i = 0; i < paths.length; i += 100) await admin.storage.from("marketplace-photos").remove(paths.slice(i, i + 100));
      }
    } catch (e) {
      console.error("Marketplace photo cleanup failed", e);
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) {
      return new Response(JSON.stringify({ error: delErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
