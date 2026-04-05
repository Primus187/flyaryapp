import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { flightId, fileName, content, trackData } = await req.json();

    if (!flightId || !fileName || typeof content !== "string" || !content.trim()) {
      return jsonResponse({ error: "flightId, fileName und content sind erforderlich" }, 400);
    }

    const { data: flight, error: flightError } = await adminClient
      .from("flights")
      .select("id, user_id")
      .eq("id", flightId)
      .maybeSingle();

    if (flightError) throw flightError;
    if (!flight || flight.user_id !== user.id) {
      return jsonResponse({ error: "Kein Zugriff auf diesen Flug" }, 403);
    }

    const { data: existingTracks, error: existingTracksError } = await adminClient
      .from("igc_tracks")
      .select("id, storage_path")
      .eq("flight_id", flightId);

    if (existingTracksError) throw existingTracksError;

    const oldPaths = (existingTracks || [])
      .map((entry) => entry.storage_path)
      .filter((value): value is string => Boolean(value));

    if (oldPaths.length > 0) {
      const { error: removeOldFilesError } = await adminClient.storage.from("igc-files").remove(oldPaths);
      if (removeOldFilesError) {
        console.error("Failed to remove old IGC files", removeOldFilesError);
      }
    }

    const { error: deleteTrackError } = await adminClient
      .from("igc_tracks")
      .delete()
      .eq("flight_id", flightId);

    if (deleteTrackError) throw deleteTrackError;

    const safeFileName = String(fileName).replace(/[^a-zA-Z0-9._-]+/g, "_");
    const storagePath = `${user.id}/${flightId}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await adminClient.storage.from("igc-files").upload(
      storagePath,
      new Blob([content], { type: "text/plain; charset=utf-8" }),
      {
        contentType: "text/plain; charset=utf-8",
        upsert: false,
      }
    );

    if (uploadError) throw uploadError;

    const { data: track, error: insertTrackError } = await adminClient
      .from("igc_tracks")
      .insert({
        flight_id: flightId,
        storage_path: storagePath,
        track_data: trackData ?? null,
      })
      .select()
      .single();

    if (insertTrackError) {
      await adminClient.storage.from("igc-files").remove([storagePath]);
      throw insertTrackError;
    }

    return jsonResponse({ track, storagePath });
  } catch (error) {
    console.error("upload-igc-track failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});