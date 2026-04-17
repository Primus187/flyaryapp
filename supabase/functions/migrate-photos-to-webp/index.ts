// Edge Function: Re-encodes existing JPG/PNG photos in the flight-photos bucket to WebP.
// - Idempotent: skips files already ending in .webp
// - Batched via ?limit=N (default 25, max 100) and ?offset=N
// - Updates flight_photos.storage_path, event_photos.storage_path, profile_photos.storage_path,
//   profiles.avatar_url and profiles.cover_photo_url when they reference the renamed file.
// - Requires admin role (checked via has_role).
//
// Invoke (from a logged-in admin):
//   const { data } = await supabase.functions.invoke("migrate-photos-to-webp", {
//     body: { limit: 25, offset: 0, dryRun: false }
//   });
//
// Re-run with increasing offset (or simply re-run with offset 0 — already-converted files are skipped)
// until "processed" returns 0.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { decode as decodeJpeg } from "https://esm.sh/jpeg-js@0.4.4";
import { decode as decodePng } from "https://deno.land/x/pngs@0.1.1/mod.ts";
import encodeWebp from "npm:@jsquash/webp@1.4.0/encode.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "flight-photos";
const WEBP_QUALITY = 82;

interface BatchResult {
  scanned: number;
  processed: number;
  skipped: number;
  failed: number;
  details: Array<{ path: string; status: string; newPath?: string; error?: string }>;
}

async function listAllObjects(
  supabase: ReturnType<typeof createClient>,
  prefix = "",
): Promise<{ name: string; path: string }[]> {
  // Recursively list every object under prefix (Supabase Storage list is shallow per folder)
  const out: { name: string; path: string }[] = [];
  const PAGE = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const item of data) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      // Folders have null id / null metadata
      if (item.id === null) {
        const nested = await listAllObjects(supabase, fullPath);
        out.push(...nested);
      } else {
        out.push({ name: item.name, path: fullPath });
      }
    }

    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

async function reencodeToWebp(
  bytes: Uint8Array,
  ext: string,
): Promise<Uint8Array> {
  let width: number;
  let height: number;
  let rgba: Uint8Array;

  if (ext === "jpg" || ext === "jpeg") {
    const img = decodeJpeg(bytes, { useTArray: true });
    width = img.width;
    height = img.height;
    rgba = img.data as Uint8Array;
  } else if (ext === "png") {
    const img = decodePng(bytes);
    width = img.width;
    height = img.height;
    rgba = img.image;
  } else {
    throw new Error(`Unsupported extension: ${ext}`);
  }

  return await encodeWebp(rgba, width, height, WEBP_QUALITY);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authn / authz: require admin role on the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden — admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Params
    const url = new URL(req.url);
    let body: { limit?: number; offset?: number; dryRun?: boolean } = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { /* empty body */ }
    }
    const limit = Math.min(
      Number(body.limit ?? url.searchParams.get("limit") ?? 25),
      100,
    );
    const offset = Number(body.offset ?? url.searchParams.get("offset") ?? 0);
    const dryRun = Boolean(body.dryRun ?? url.searchParams.get("dryRun") === "true");

    // Discover candidates
    const all = await listAllObjects(admin);
    const candidates = all.filter((o) => /\.(jpe?g|png)$/i.test(o.name));
    const slice = candidates.slice(offset, offset + limit);

    const result: BatchResult = {
      scanned: candidates.length,
      processed: 0,
      skipped: 0,
      failed: 0,
      details: [],
    };

    for (const obj of slice) {
      const oldPath = obj.path;
      const ext = oldPath.split(".").pop()!.toLowerCase();
      const newPath = oldPath.replace(/\.(jpe?g|png)$/i, ".webp");

      try {
        if (dryRun) {
          result.processed++;
          result.details.push({ path: oldPath, status: "would-convert", newPath });
          continue;
        }

        // Download
        const dl = await admin.storage.from(BUCKET).download(oldPath);
        if (dl.error || !dl.data) throw new Error(dl.error?.message ?? "download failed");
        const bytes = new Uint8Array(await dl.data.arrayBuffer());

        // Encode
        const webp = await reencodeToWebp(bytes, ext);

        // Upload (don't overwrite an existing webp)
        const up = await admin.storage.from(BUCKET).upload(newPath, webp, {
          contentType: "image/webp",
          upsert: false,
        });
        if (up.error && !/already exists/i.test(up.error.message)) {
          throw new Error(up.error.message);
        }

        // Update DB references
        const updates = await Promise.all([
          admin.from("flight_photos").update({ storage_path: newPath }).eq("storage_path", oldPath),
          admin.from("event_photos").update({ storage_path: newPath }).eq("storage_path", oldPath),
          admin.from("profile_photos").update({ storage_path: newPath }).eq("storage_path", oldPath),
          admin.from("profiles").update({ avatar_url: newPath }).eq("avatar_url", oldPath),
          admin.from("profiles").update({ cover_photo_url: newPath }).eq("cover_photo_url", oldPath),
        ]);
        const updateErrors = updates.filter((u) => u.error).map((u) => u.error!.message);
        if (updateErrors.length) throw new Error(`DB update failed: ${updateErrors.join("; ")}`);

        // Delete old object
        const rm = await admin.storage.from(BUCKET).remove([oldPath]);
        if (rm.error) throw new Error(`remove old failed: ${rm.error.message}`);

        result.processed++;
        result.details.push({ path: oldPath, status: "converted", newPath });
      } catch (e) {
        result.failed++;
        result.details.push({
          path: oldPath,
          status: "failed",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    result.skipped = candidates.length - offset - slice.length;

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
