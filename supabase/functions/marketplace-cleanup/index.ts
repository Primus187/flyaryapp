// Edge Function: nightly marketplace cleanup (plan 4.9), started by pg_cron (migration 0040).
// The database does the bookkeeping in marketplace_daily_cleanup() and returns the storage paths to delete;
// files can only be removed through the Storage API, which happens here.
// Deployed with verify_jwt = false; only callers with the shared x-push-secret are accepted.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const BUCKET = "marketplace-photos";

Deno.serve(async (req) => {
  const secret = Deno.env.get("PUSH_INTERNAL_SECRET");
  if (!secret || req.headers.get("x-push-secret") !== secret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await admin.rpc("marketplace_daily_cleanup");
  if (error) {
    console.error("marketplace_daily_cleanup failed", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const result = data as { expired: number; reminded: number; deleted_drafts: number; paths: string[] };
  let removed = 0;
  const failed: string[] = [];
  for (let i = 0; i < result.paths.length; i += 100) {
    const batch = result.paths.slice(i, i + 100);
    const { data: gone, error: removeError } = await admin.storage.from(BUCKET).remove(batch);
    if (removeError) failed.push(...batch);
    else removed += gone?.length ?? 0;
  }
  // Paths that could not be removed show up again as orphans in the next run.
  const summary = { expired: result.expired, reminded: result.reminded, deleted_drafts: result.deleted_drafts, removed_files: removed, failed: failed.length };
  console.log("marketplace-cleanup", summary);
  return new Response(JSON.stringify(summary), { headers: { "Content-Type": "application/json" } });
});
