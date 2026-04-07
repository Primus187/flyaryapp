import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CRAWLER_PATTERN = /WhatsApp|TelegramBot|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|Discordbot|bot|crawler|spider|preview/i;
const SPA_ORIGIN = "https://flyaryapp.lovable.app";

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

    const userAgent = req.headers.get("user-agent") || "";
    const accept = req.headers.get("accept") || "";
    const isCrawler = CRAWLER_PATTERN.test(userAgent);
    const wantsJson = accept.includes("application/json");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // For normal browsers (not crawlers, not API calls) → redirect to SPA
    if (!isCrawler && !wantsJson) {
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: `${SPA_ORIGIN}/shared/flights/${token}` },
      });
    }

    // Fetch flight by share_token
    const { data: flight, error: flightErr } = await supabaseAdmin
      .from("flights")
      .select("id, date, glider, duration_minutes, altitude_gain, distance_km, thermals, wind_speed, wind_direction, comments, is_solo_shv, user_id, takeoff_location_id, landing_location_id")
      .eq("share_token", token)
      .single();

    if (flightErr || !flight) {
      if (isCrawler) {
        return new Response("<html><head><title>Flug nicht gefunden</title></head><body>Flug nicht gefunden</body></html>", {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
        });
      }
      return new Response(JSON.stringify({ error: "Flight not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch related data in parallel
    const [locationsRes, photosRes, videosRes, trackRes, profileRes] = await Promise.all([
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

    // If crawler → return HTML with OG tags
    if (isCrawler) {
      const pilotName = profileRes.data?.pilot_name || "Pilot";
      const takeoffName = takeoffRes.data?.name || "";
      const date = flight.date || "";
      const ogTitle = `Flug von ${pilotName}${takeoffName ? ` – ${takeoffName}` : ""} (${date})`;

      const parts: string[] = [];
      if (flight.duration_minutes) parts.push(`${flight.duration_minutes} Min`);
      if (flight.altitude_gain) parts.push(`${flight.altitude_gain}m Höhengewinn`);
      if (flight.distance_km) parts.push(`${flight.distance_km} km`);
      if (flight.glider) parts.push(flight.glider);
      const ogDescription = parts.join(" · ") || "Gleitschirmflug";

      // Try to get a signed photo URL for og:image
      let ogImage = "";
      if (photosRes.data && photosRes.data.length > 0) {
        const { data: signed } = await supabaseAdmin.storage
          .from("flight-photos")
          .createSignedUrl(photosRes.data[0].storage_path, 3600);
        if (signed?.signedUrl) ogImage = signed.signedUrl;
      }

      const spaUrl = `${SPA_ORIGIN}/shared/flights/${token}`;

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(ogTitle)}</title>
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(ogTitle)}">
<meta property="og:description" content="${escapeHtml(ogDescription)}">
<meta property="og:url" content="${spaUrl}">
${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}">` : ""}
<meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${escapeHtml(ogTitle)}">
<meta name="twitter:description" content="${escapeHtml(ogDescription)}">
${ogImage ? `<meta name="twitter:image" content="${escapeHtml(ogImage)}">` : ""}
<meta http-equiv="refresh" content="0;url=${spaUrl}">
</head>
<body>Weiterleitung…</body>
</html>`;

      return new Response(html, {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // JSON response (API calls)
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

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
