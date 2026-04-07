import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CRAWLER_PATTERN = /WhatsApp|TelegramBot|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|Discordbot|bot|crawler|spider|preview/i;
const SPA_ORIGIN = "https://flyaryapp.lovable.app";
const TILE_SIZE = 256;
const IMG_W = 600;
const IMG_H = 400;

// ── Tile math ──────────────────────────────────────────────
function lngToTileX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * Math.pow(2, zoom);
}

function latToTileY(lat: number, zoom: number): number {
  const latRad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom);
}

function getBoundsZoom(minLat: number, maxLat: number, minLng: number, maxLng: number): number {
  for (let z = 16; z >= 1; z--) {
    const x0 = lngToTileX(minLng, z) * TILE_SIZE;
    const x1 = lngToTileX(maxLng, z) * TILE_SIZE;
    const y0 = latToTileY(maxLat, z) * TILE_SIZE;
    const y1 = latToTileY(minLat, z) * TILE_SIZE;
    if ((x1 - x0) < IMG_W * 0.8 && (y1 - y0) < IMG_H * 0.8) return z;
  }
  return 1;
}

async function fetchTile(tx: number, ty: number, zoom: number): Promise<Image | null> {
  try {
    const url = `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;
    const res = await fetch(url, {
      headers: { "User-Agent": "FlyAry-App/1.0 (OG-Image-Generator)" },
    });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return await Image.decode(buf);
  } catch {
    return null;
  }
}

function drawThickLine(img: Image, x0: number, y0: number, x1: number, y1: number, thickness: number, color: number) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(Math.ceil(len), 1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = Math.round(x0 + dx * t);
    const cy = Math.round(y0 + dy * t);
    for (let oy = -thickness; oy <= thickness; oy++) {
      for (let ox = -thickness; ox <= thickness; ox++) {
        if (ox * ox + oy * oy <= thickness * thickness) {
          const px = cx + ox;
          const py = cy + oy;
          if (px >= 1 && px <= img.width && py >= 1 && py <= img.height) {
            img.setPixelAt(px, py, color);
          }
        }
      }
    }
  }
}

function drawCircle(img: Image, cx: number, cy: number, radius: number, fillColor: number, borderColor: number, borderWidth: number) {
  for (let oy = -(radius + borderWidth); oy <= radius + borderWidth; oy++) {
    for (let ox = -(radius + borderWidth); ox <= radius + borderWidth; ox++) {
      const dist = Math.sqrt(ox * ox + oy * oy);
      const px = cx + ox;
      const py = cy + oy;
      if (px < 1 || px > img.width || py < 1 || py > img.height) continue;
      if (dist <= radius) {
        img.setPixelAt(px, py, fillColor);
      } else if (dist <= radius + borderWidth) {
        img.setPixelAt(px, py, borderColor);
      }
    }
  }
}

async function generateMapImage(rawPoints: any[]): Promise<Uint8Array> {
  // Extract coordinates
  const coords = rawPoints
    .filter((p: any) => typeof p.lat === "number" && typeof p.lng === "number")
    .map((p: any) => ({ lat: p.lat, lng: p.lng }));

  if (coords.length < 2) throw new Error("Not enough points");

  // Sample to max 300 points
  const step = Math.max(1, Math.floor(coords.length / 300));
  const sampled = coords.filter((_: any, i: number) => i % step === 0);

  // Bounding box
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of sampled) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }

  const latPad = (maxLat - minLat) * 0.2 || 0.005;
  const lngPad = (maxLng - minLng) * 0.2 || 0.005;
  minLat -= latPad; maxLat += latPad;
  minLng -= lngPad; maxLng += lngPad;

  const zoom = getBoundsZoom(minLat, maxLat, minLng, maxLng);

  // Center in world pixels
  const centerPxX = (lngToTileX(minLng, zoom) + lngToTileX(maxLng, zoom)) / 2 * TILE_SIZE;
  const centerPxY = (latToTileY(maxLat, zoom) + latToTileY(minLat, zoom)) / 2 * TILE_SIZE;

  // Which tiles to fetch
  const originPxX = centerPxX - IMG_W / 2;
  const originPxY = centerPxY - IMG_H / 2;

  const tileMinX = Math.floor(originPxX / TILE_SIZE);
  const tileMinY = Math.floor(originPxY / TILE_SIZE);
  const tileMaxX = Math.floor((originPxX + IMG_W) / TILE_SIZE);
  const tileMaxY = Math.floor((originPxY + IMG_H) / TILE_SIZE);

  // Create output image
  const img = new Image(IMG_W, IMG_H);
  img.fill(0xE8E4DFFF); // warm gray fallback

  // Fetch tiles in parallel
  const tileJobs: Promise<void>[] = [];
  for (let tx = tileMinX; tx <= tileMaxX; tx++) {
    for (let ty = tileMinY; ty <= tileMaxY; ty++) {
      tileJobs.push(
        fetchTile(tx, ty, zoom).then((tile) => {
          if (!tile) return;
          const destX = Math.round(tx * TILE_SIZE - originPxX);
          const destY = Math.round(ty * TILE_SIZE - originPxY);
          img.composite(tile, destX, destY);
        })
      );
    }
  }
  await Promise.all(tileJobs);

  // Project track points to pixel coords and draw
  const pixelPts = sampled.map((p: any) => ({
    x: Math.round(lngToTileX(p.lng, zoom) * TILE_SIZE - originPxX),
    y: Math.round(latToTileY(p.lat, zoom) * TILE_SIZE - originPxY),
  }));

  // Draw white outline first (thickness 4), then red track (thickness 2)
  for (let i = 1; i < pixelPts.length; i++) {
    drawThickLine(img, pixelPts[i - 1].x, pixelPts[i - 1].y, pixelPts[i].x, pixelPts[i].y, 4, 0xFFFFFFCC);
  }
  for (let i = 1; i < pixelPts.length; i++) {
    drawThickLine(img, pixelPts[i - 1].x, pixelPts[i - 1].y, pixelPts[i].x, pixelPts[i].y, 2, 0x2266FFFF);
  }

  // Draw start (green) and landing (red) markers
  const startPt = pixelPts[0];
  const endPt = pixelPts[pixelPts.length - 1];
  drawCircle(img, startPt.x, startPt.y, 6, 0x22CC44FF, 0xFFFFFFFF, 2);
  drawCircle(img, endPt.x, endPt.y, 6, 0xDD2222FF, 0xFFFFFFFF, 2);

  return await img.encode();
}

// ── Main handler ──────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const format = url.searchParams.get("format");

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

    // For normal browsers (not crawlers, not API calls, not image requests) → redirect to SPA
    if (!isCrawler && !wantsJson && format !== "image") {
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
      if (isCrawler || format === "image") {
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

    // ── format=image → generate map PNG ──
    if (format === "image") {
      const trackData = trackRes.data?.track_data;
      if (trackData && typeof trackData === "object" && "points" in (trackData as any)) {
        try {
          const pngBytes = await generateMapImage((trackData as any).points);
          return new Response(pngBytes, {
            headers: {
              ...corsHeaders,
              "Content-Type": "image/png",
              "Cache-Control": "public, max-age=604800", // 7 days
            },
          });
        } catch (e) {
          console.error("Map image generation failed:", e);
        }
      }
      // Fallback: redirect to a photo if available
      if (photosRes.data && photosRes.data.length > 0) {
        const { data: signed } = await supabaseAdmin.storage
          .from("flight-photos")
          .createSignedUrl(photosRes.data[0].storage_path, 3600);
        if (signed?.signedUrl) {
          return new Response(null, {
            status: 302,
            headers: { ...corsHeaders, Location: signed.signedUrl },
          });
        }
      }
      // 1x1 transparent PNG fallback
      return new Response(
        new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,6,0,0,0,31,21,196,137,0,0,0,10,73,68,65,84,120,156,98,0,0,0,6,0,5,0,1,13,10,45,180,0,0,0,0,73,69,78,68,174,66,96,130]),
        { headers: { ...corsHeaders, "Content-Type": "image/png" } }
      );
    }

    // ── Crawler → HTML with OG tags ──
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

      // Build og:image URL – prefer map image (generated from track), fallback to photo
      const funcBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1/get-shared-flight`;
      let ogImage = `${funcBase}?token=${token}&format=image`;

      // Check if track data exists; if not, try photo
      const hasTrack = trackRes.data?.track_data && typeof trackRes.data.track_data === "object" && "points" in (trackRes.data.track_data as any);
      if (!hasTrack) {
        ogImage = "";
        if (photosRes.data && photosRes.data.length > 0) {
          const { data: signed } = await supabaseAdmin.storage
            .from("flight-photos")
            .createSignedUrl(photosRes.data[0].storage_path, 3600);
          if (signed?.signedUrl) ogImage = signed.signedUrl;
        }
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
${ogImage ? `<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="600">
<meta property="og:image:height" content="400">` : ""}
<meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${escapeHtml(ogTitle)}">
<meta name="twitter:description" content="${escapeHtml(ogDescription)}">
${ogImage ? `<meta name="twitter:image" content="${ogImage}">` : ""}
<meta http-equiv="refresh" content="0;url=${spaUrl}">
</head>
<body>Weiterleitung…</body>
</html>`;

      return new Response(html, {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // ── JSON response (API calls) ──
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
    console.error("get-shared-flight error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
