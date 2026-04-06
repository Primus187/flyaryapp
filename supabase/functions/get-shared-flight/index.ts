import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch flight by share_token
    const { data: flight, error: flightErr } = await supabaseAdmin
      .from("flights")
      .select("id, date, glider, duration_minutes, altitude_gain, distance_km, thermals, wind_speed, wind_direction, comments, is_solo_shv, user_id, takeoff_location_id, landing_location_id")
      .eq("share_token", token)
      .single();

    if (flightErr || !flight) {
      return new Response(JSON.stringify({ error: "Flight not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch related data in parallel
    const [locationsRes, photosRes, videosRes, trackRes, profileRes] = await Promise.all([
      // Locations
      Promise.all([
        flight.takeoff_location_id
          ? supabaseAdmin.from("locations").select("name, latitude, longitude").eq("id", flight.takeoff_location_id).single()
          : Promise.resolve({ data: null }),
        flight.landing_location_id
          ? supabaseAdmin.from("locations").select("name, latitude, longitude").eq("id", flight.landing_location_id).single()
          : Promise.resolve({ data: null }),
      ]),
      supabaseAdmin.from("flight_photos").select("id, storage_path").eq("flight_id", flight.id),
      supabaseAdmin.from("flight_videos").select("id, youtube_url").eq("flight_id", flight.id),
      supabaseAdmin.from("igc_tracks").select("track_data").eq("flight_id", flight.id).maybeSingle(),
      supabaseAdmin.from("profiles").select("pilot_name, avatar_url").eq("user_id", flight.user_id).single(),
    ]);

    const [takeoffRes, landingRes] = locationsRes;

    // Generate signed URLs for photos
    const photoUrls: { id: string; url: string }[] = [];
    if (photosRes.data) {
      for (const photo of photosRes.data) {
        const { data: signed } = await supabaseAdmin.storage
          .from("flight-photos")
          .createSignedUrl(photo.storage_path, 3600);
        if (signed?.signedUrl) {
          photoUrls.push({ id: photo.id, url: signed.signedUrl });
        }
      }
    }

    // Signed URL for avatar if needed
    let avatarUrl = profileRes.data?.avatar_url || "";
    if (avatarUrl && !avatarUrl.startsWith("http")) {
      const { data: signed } = await supabaseAdmin.storage
        .from("flight-photos")
        .createSignedUrl(avatarUrl, 3600);
      if (signed?.signedUrl) avatarUrl = signed.signedUrl;
    }

    const result = {
      date: flight.date,
      glider: flight.glider,
      duration_minutes: flight.duration_minutes,
      altitude_gain: flight.altitude_gain,
      distance_km: flight.distance_km,
      thermals: flight.thermals,
      wind_speed: flight.wind_speed,
      wind_direction: flight.wind_direction,
      comments: flight.comments,
      is_solo_shv: flight.is_solo_shv,
      takeoff: takeoffRes.data || null,
      landing: landingRes.data || null,
      photos: photoUrls,
      videos: (videosRes.data || []).map((v: any) => ({ id: v.id, youtube_url: v.youtube_url })),
      track_data: trackRes.data?.track_data || null,
      pilot_name: profileRes.data?.pilot_name || "",
      avatar_url: avatarUrl,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
