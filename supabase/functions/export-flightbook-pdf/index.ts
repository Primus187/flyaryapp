import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Location {
  id: string;
  name: string;
  altitude: number | null;
  type: string;
  description: string | null;
}

interface Flight {
  id: string;
  date: string;
  glider: string | null;
  duration_minutes: number | null;
  altitude_gain: number | null;
  distance_km: number | null;
  comments: string | null;
  group_id: string | null;
  takeoff_location: { name: string; altitude: number | null } | null;
  landing_location: { name: string; altitude: number | null } | null;
}

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    // Parse filter params
    const url = new URL(req.url);
    const groupIdsParam = url.searchParams.get("group_ids");
    const includeNoGroupParam = url.searchParams.get("include_no_group");
    const hasFilter = groupIdsParam !== null || includeNoGroupParam !== null;
    const groupIds = groupIdsParam ? groupIdsParam.split(",").filter(Boolean) : [];
    const includeNoGroup = includeNoGroupParam !== "false";

    const { data: profile } = await supabase.from("profiles").select("pilot_name, glider_info").eq("user_id", user.id).single();
    const pilotName = profile?.pilot_name || "Pilot";
    const email = user.email || "";

    const { data: locations } = await supabase.from("locations").select("id, name, altitude, type, description").eq("user_id", user.id).order("name");

    let flightsQuery = supabase
      .from("flights")
      .select("id, date, glider, duration_minutes, altitude_gain, distance_km, comments, group_id, takeoff:locations!flights_takeoff_location_id_fkey(name, altitude), landing:locations!flights_landing_location_id_fkey(name, altitude)")
      .eq("user_id", user.id)
      .order("date", { ascending: true });

    const { data: flightsRaw } = await flightsQuery;

    let allFlights: Flight[] = (flightsRaw || []).map((f: any) => ({
      ...f,
      takeoff_location: f.takeoff,
      landing_location: f.landing,
    }));

    // Apply group filter client-side
    if (hasFilter) {
      allFlights = allFlights.filter((f) => {
        if (f.group_id === null) return includeNoGroup;
        return groupIds.includes(f.group_id);
      });
    }

    const flights = allFlights;
    const takeoffs = (locations || []).filter((l: Location) => l.type === "takeoff" || l.type === "both");
    const landings = (locations || []).filter((l: Location) => l.type === "landing" || l.type === "both");
    const totalMinutes = flights.reduce((s, f) => s + (f.duration_minutes || 0), 0);
    const today = formatDate(new Date().toISOString());

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const marginL = 12;
    const marginR = 12;
    const marginT = 15;
    const pW = 210;
    const pH = 297;

    let y = marginT;

    const addPortraitFooter = () => {
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text("Stempel / Unterschrift: _______________________________", marginL, pH - 18);
      doc.text(`${doc.getNumberOfPages()}`, pW / 2, pH - 10, { align: "center" });
      doc.text(today, pW - marginR, pH - 10, { align: "right" });
      doc.setTextColor(0);
    };

    const ensurePortraitSpace = (needed: number): boolean => {
      if (y + needed > pH - 25) {
        addPortraitFooter();
        doc.addPage("a4", "p");
        y = marginT;
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Pilot: ${pilotName}`, marginL, y);
        y += 8;
        doc.setTextColor(0);
        return true;
      }
      return false;
    };

    // Cover page
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("Flugbuch", marginL, y + 5);
    y += 18;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const infoLines = [
      `Name: ${pilotName}`,
      `E-Mail: ${email}`,
      `Anzahl Startplätze: ${takeoffs.length}`,
      `Anzahl Landeplätze: ${landings.length}`,
      `Anzahl Flüge: ${flights.length}`,
      `Flugstunden: ${formatDuration(totalMinutes)}`,
    ];
    for (const line of infoLines) {
      doc.text(line, marginL, y);
      y += 6;
    }
    y += 8;

    const drawLocTable = (title: string, locs: Location[]) => {
      ensurePortraitSpace(20);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(title, marginL, y);
      y += 7;

      const cols = [
        { label: "Name", x: marginL },
        { label: "Höhe", x: marginL + 70 },
        { label: "Notizen", x: marginL + 95 },
      ];

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      for (const c of cols) doc.text(c.label, c.x, y);
      y += 1;
      doc.setLineWidth(0.3);
      doc.line(marginL, y, pW - marginR, y);
      y += 4;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      for (const loc of locs) {
        ensurePortraitSpace(5);
        doc.text(loc.name, cols[0].x, y);
        doc.text(loc.altitude ? String(loc.altitude) : "", cols[1].x, y);
        doc.text(loc.description || "", cols[2].x, y);
        y += 4.5;
      }
      y += 6;
    };

    drawLocTable("Startplätze", takeoffs);
    drawLocTable("Landeplätze", landings);

    addPortraitFooter();

    // Flight pages (Landscape)
    const lW = 297;
    const lH = 210;

    doc.addPage("a4", "l");
    y = marginT;

    const addLandscapeFooter = () => {
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text("Stempel / Unterschrift: _______________________________", marginL, lH - 12);
      doc.text(`${doc.getNumberOfPages()}`, lW / 2, lH - 7, { align: "center" });
      doc.text(today, lW - marginR, lH - 7, { align: "right" });
      doc.setTextColor(0);
    };

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Pilot: ${pilotName}`, marginL, y);
    y += 4;
    doc.setTextColor(0);

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Flüge", marginL, y);
    y += 7;

    const colsF = [
      { label: "Nr", x: marginL },
      { label: "Datum", x: marginL + 10 },
      { label: "Gleitschirm", x: marginL + 32 },
      { label: "Start", x: marginL + 67 },
      { label: "Landung", x: marginL + 107 },
      { label: "Flugdauer", x: marginL + 142 },
      { label: "Km", x: marginL + 162 },
      { label: "Diff.", x: marginL + 174 },
      { label: "Beschreibung", x: marginL + 188 },
    ];
    const descW = lW - marginR - colsF[8].x;

    const drawFlightHeader = () => {
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      for (const c of colsF) doc.text(c.label, c.x, y);
      y += 1;
      doc.setLineWidth(0.3);
      doc.line(marginL, y, lW - marginR, y);
      y += 4;
      doc.setFont("helvetica", "normal");
    };

    drawFlightHeader();

    doc.setFontSize(7.5);
    for (let i = 0; i < flights.length; i++) {
      const f = flights[i];
      const desc = f.comments || "";
      const descLines = doc.splitTextToSize(desc, descW);
      const rowH = Math.max(4.5, descLines.length * 3.5);

      if (y + rowH > lH - 20) {
        addLandscapeFooter();
        doc.addPage("a4", "l");
        y = marginT;
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Pilot: ${pilotName}`, marginL, y);
        y += 8;
        doc.setTextColor(0);
        drawFlightHeader();
        doc.setFontSize(7.5);
      }

      doc.text(String(i + 1), colsF[0].x, y);
      doc.text(formatDate(f.date), colsF[1].x, y);
      doc.text(f.glider || "", colsF[2].x, y);
      doc.text(f.takeoff_location?.name || "", colsF[3].x, y);
      doc.text(f.landing_location?.name || "", colsF[4].x, y);
      doc.text(f.duration_minutes ? formatDuration(f.duration_minutes) : "", colsF[5].x, y);
      doc.text(f.distance_km ? String(Number(f.distance_km).toFixed(1)) : "", colsF[6].x, y);
      doc.text(f.altitude_gain ? String(f.altitude_gain) : "", colsF[7].x, y);
      if (descLines.length > 0) doc.text(descLines, colsF[8].x, y);

      y += rowH + 1;
    }

    addLandscapeFooter();

    const pdfBytes = doc.output("arraybuffer");

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="flugbuch_${pilotName.replace(/\s/g, "_")}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF export error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
