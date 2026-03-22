import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const XCONTEST_BASE = "https://www.xcontest.org";
const MAX_FLIGHTS = 50;
const RATE_DELAY = 600; // ms between requests

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Simple XOR-based encryption/decryption with a key
function decryptPassword(encrypted: string, key: string): string {
  const data = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const keyBytes = new TextEncoder().encode(key);
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  return new TextDecoder().decode(result);
}

export function encryptPassword(password: string, key: string): string {
  const data = new TextEncoder().encode(password);
  const keyBytes = new TextEncoder().encode(key);
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  return btoa(String.fromCharCode(...result));
}

async function loginToXContest(
  username: string,
  password: string
): Promise<string | null> {
  // First GET the login page to get any CSRF tokens/cookies
  const initRes = await fetch(`${XCONTEST_BASE}/world/en/`, {
    redirect: "manual",
  });
  const initCookies = initRes.headers.getSetCookie?.() || [];
  const cookieStr = initCookies.map((c: string) => c.split(";")[0]).join("; ");
  await initRes.text();

  // POST login
  const formData = new URLSearchParams();
  formData.set("login[username]", username);
  formData.set("login[password]", password);
  formData.set("login[persist]", "1");

  const loginRes = await fetch(`${XCONTEST_BASE}/world/en/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieStr,
    },
    body: formData.toString(),
    redirect: "manual",
  });

  const loginCookies = loginRes.headers.getSetCookie?.() || [];
  await loginRes.text();

  // Merge cookies
  const allCookies = [...initCookies, ...loginCookies]
    .map((c: string) => c.split(";")[0])
    .join("; ");

  // Verify login by checking if we have a session cookie
  if (!allCookies.includes("xcontest")) {
    return null;
  }
  return allCookies;
}

interface ParsedFlight {
  url: string;
  date: string;
  launch: string;
  launchLat?: number;
  launchLng?: number;
  distanceKm?: number;
  durationMinutes?: number;
  glider?: string;
}

function parseFlightList(html: string): ParsedFlight[] {
  const flights: ParsedFlight[] = [];
  // Match flight rows - XContest uses table rows with flight data
  const rowRegex =
    /<tr[^>]*id="flight-(\d+)"[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  while ((match = rowRegex.exec(html)) !== null && flights.length < MAX_FLIGHTS) {
    const row = match[2];
    const flightId = match[1];

    // Extract flight detail URL
    const urlMatch = row.match(/href="(\/world\/en\/flights\/detail:[^"]+)"/);
    const url = urlMatch ? `${XCONTEST_BASE}${urlMatch[1]}` : "";

    // Extract date
    const dateMatch = row.match(
      /(\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2})/
    );
    let date = "";
    if (dateMatch) {
      const d = dateMatch[1];
      if (d.includes(".")) {
        const [day, month, year] = d.split(".");
        date = `${year}-${month}-${day}`;
      } else {
        date = d;
      }
    }

    // Extract launch location and coordinates
    const launchMatch = row.match(
      /class="[^"]*launch[^"]*"[^>]*>([^<]+)/i
    );
    const launch = launchMatch ? launchMatch[1].trim() : "";

    // Coordinates from launch link
    const coordMatch = row.match(
      /lat=([-\d.]+)&amp;lon=([-\d.]+)/
    );
    const launchLat = coordMatch ? parseFloat(coordMatch[1]) : undefined;
    const launchLng = coordMatch ? parseFloat(coordMatch[2]) : undefined;

    // Distance
    const distMatch = row.match(/([\d.]+)\s*km/);
    const distanceKm = distMatch ? parseFloat(distMatch[1]) : undefined;

    // Duration - format like "1:23" or "01:23:45"
    const durMatch = row.match(
      /(\d{1,2}):(\d{2})(?::(\d{2}))?/
    );
    let durationMinutes: number | undefined;
    if (durMatch) {
      const h = parseInt(durMatch[1]);
      const m = parseInt(durMatch[2]);
      durationMinutes = h * 60 + m;
    }

    if (url) {
      flights.push({
        url,
        date,
        launch,
        launchLat,
        launchLng,
        distanceKm,
        durationMinutes,
      });
    }
  }
  return flights;
}

function findIgcDownloadUrl(html: string): string | null {
  // Look for IGC download link patterns
  const patterns = [
    /href="([^"]*\.igc[^"]*)"/i,
    /href="([^"]*download-igc[^"]*)"/i,
    /href="([^"]*\/igc\/[^"]*)"/i,
    /href="(\/world\/en\/flights\/download[^"]*)"/i,
  ];
  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m) {
      const url = m[1].startsWith("http")
        ? m[1]
        : `${XCONTEST_BASE}${m[1]}`;
      return url;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encryptionKey = Deno.env.get("XCONTEST_ENCRYPTION_KEY")!;

    // Verify user JWT
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin client for DB operations
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get user's XContest credentials
    const { data: profile } = await supabase
      .from("profiles")
      .select("xcontest_username, xcontest_password_encrypted")
      .eq("user_id", user.id)
      .single();

    if (!profile?.xcontest_username || !profile?.xcontest_password_encrypted) {
      return new Response(
        JSON.stringify({ error: "No XContest credentials configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const password = decryptPassword(profile.xcontest_password_encrypted, encryptionKey);

    // Login to XContest
    const cookies = await loginToXContest(profile.xcontest_username, password);
    if (!cookies) {
      return new Response(
        JSON.stringify({ error: "XContest login failed. Check your credentials." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch flight list
    const flightsUrl = `${XCONTEST_BASE}/world/en/flights/?filter[pilot]=${encodeURIComponent(profile.xcontest_username)}`;
    const listRes = await fetch(flightsUrl, {
      headers: { Cookie: cookies },
    });
    const listHtml = await listRes.text();
    const parsedFlights = parseFlightList(listHtml);

    if (parsedFlights.length === 0) {
      return new Response(
        JSON.stringify({ imported: 0, message: "No flights found on XContest" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get already imported flights
    const { data: existingImports } = await supabase
      .from("xcontest_imports")
      .select("xcontest_flight_url")
      .eq("user_id", user.id);

    const importedUrls = new Set(
      (existingImports || []).map((i: any) => i.xcontest_flight_url)
    );

    let importedCount = 0;

    for (const flight of parsedFlights) {
      if (importedUrls.has(flight.url)) continue;

      await sleep(RATE_DELAY);

      // Try to download IGC from flight detail page
      let igcContent: string | null = null;
      let igcStoragePath: string | null = null;

      try {
        const detailRes = await fetch(flight.url, {
          headers: { Cookie: cookies },
        });
        const detailHtml = await detailRes.text();

        // Extract glider info from detail page
        const gliderMatch = detailHtml.match(
          /class="[^"]*glider[^"]*"[^>]*>([^<]+)/i
        );
        if (gliderMatch) flight.glider = gliderMatch[1].trim();

        const igcUrl = findIgcDownloadUrl(detailHtml);
        if (igcUrl) {
          await sleep(RATE_DELAY);
          const igcRes = await fetch(igcUrl, {
            headers: { Cookie: cookies },
          });
          if (igcRes.ok) {
            igcContent = await igcRes.text();
          } else {
            await igcRes.text();
          }
        }
      } catch {
        // Continue without IGC
      }

      // Create the flight entry
      const { data: newFlight, error: flightError } = await supabase
        .from("flights")
        .insert({
          user_id: user.id,
          date: flight.date || new Date().toISOString().split("T")[0],
          duration_minutes: flight.durationMinutes || null,
          distance_km: flight.distanceKm || null,
          glider: flight.glider || null,
          comments: `Imported from XContest: ${flight.launch}`,
        })
        .select("id")
        .single();

      if (flightError || !newFlight) continue;

      // Upload IGC if available
      if (igcContent) {
        const fileName = `${user.id}/${newFlight.id}.igc`;
        const { error: uploadError } = await supabase.storage
          .from("igc-files")
          .upload(fileName, new Blob([igcContent], { type: "text/plain" }), {
            upsert: true,
          });

        if (!uploadError) {
          // Parse basic IGC data for track
          const trackPoints: any[] = [];
          const lines = igcContent.split("\n");
          for (const line of lines) {
            if (line.startsWith("B")) {
              const timeStr = line.substring(1, 7);
              const latDeg = parseInt(line.substring(7, 9));
              const latMin = parseInt(line.substring(9, 14)) / 1000;
              const latDir = line[14];
              const lngDeg = parseInt(line.substring(15, 18));
              const lngMin = parseInt(line.substring(18, 23)) / 1000;
              const lngDir = line[23];
              const altPress = parseInt(line.substring(25, 30));
              const altGps = parseInt(line.substring(30, 35));

              let lat = latDeg + latMin / 60;
              if (latDir === "S") lat = -lat;
              let lng = lngDeg + lngMin / 60;
              if (lngDir === "W") lng = -lng;

              trackPoints.push({
                time: `${timeStr.substring(0, 2)}:${timeStr.substring(2, 4)}:${timeStr.substring(4, 6)}`,
                lat,
                lng,
                altPress,
                altGps,
              });
            }
          }

          await supabase.from("igc_tracks").insert({
            flight_id: newFlight.id,
            storage_path: fileName,
            track_data: trackPoints.length > 0 ? trackPoints : null,
          });

          igcStoragePath = fileName;
        }
      }

      // Record the import
      await supabase.from("xcontest_imports").insert({
        user_id: user.id,
        xcontest_flight_url: flight.url,
        flight_id: newFlight.id,
      });

      importedCount++;
    }

    return new Response(
      JSON.stringify({ imported: importedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
