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
  is_solo_shv: boolean;
  takeoff_location: { name: string; altitude: number | null } | null;
  landing_location: { name: string; altitude: number | null } | null;
}

interface Glider {
  manufacturer: string;
  model: string;
  size: string | null;
  is_default: boolean;
  last_check_date: string | null;
  next_check_date: string | null;
  reserve_repack_date: string | null;
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

function drawZebraRow(doc: jsPDF, rowIndex: number, x: number, yPos: number, width: number, height: number) {
  if (rowIndex % 2 === 0) {
    doc.setFillColor(245, 245, 250);
    doc.rect(x, yPos - height + 1, width, height, "F");
  }
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

    const url = new URL(req.url);
    const groupIdsParam = url.searchParams.get("group_ids");
    const includeNoGroupParam = url.searchParams.get("include_no_group");
    const hasFilter = groupIdsParam !== null || includeNoGroupParam !== null;
    const groupIds = groupIdsParam ? groupIdsParam.split(",").filter(Boolean) : [];
    const includeNoGroup = includeNoGroupParam !== "false";

    // Fetch all data in parallel
    const [profileRes, locationsRes, flightsRes, glidersRes] = await Promise.all([
      supabase.from("profiles").select("pilot_name, glider_info, flight_school").eq("user_id", user.id).single(),
      supabase.from("locations").select("id, name, altitude, type, description").eq("user_id", user.id).order("name"),
      supabase.from("flights")
        .select("id, date, glider, duration_minutes, altitude_gain, distance_km, comments, group_id, is_solo_shv, takeoff:locations!flights_takeoff_location_id_fkey(name, altitude), landing:locations!flights_landing_location_id_fkey(name, altitude)")
        .eq("user_id", user.id)
        .order("date", { ascending: true }),
      supabase.from("pilot_gliders")
        .select("manufacturer, model, size, is_default, last_check_date, next_check_date, reserve_repack_date")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false }),
    ]);

    const profile = profileRes.data;
    const locations = locationsRes.data;
    const pilotName = profile?.pilot_name || "Pilot";
    const flightSchool = profile?.flight_school || "";
    const email = user.email || "";

    let allFlights: Flight[] = (flightsRes.data || []).map((f: any) => ({
      ...f,
      takeoff_location: f.takeoff,
      landing_location: f.landing,
    }));

    if (hasFilter) {
      allFlights = allFlights.filter((f) => {
        if (f.group_id === null) return includeNoGroup;
        return groupIds.includes(f.group_id);
      });
    }

    const flights = allFlights;
    const gliders: Glider[] = glidersRes.data || [];
    const soloFlights = flights.filter((f) => f.is_solo_shv);
    const takeoffs = (locations || []).filter((l: Location) => l.type === "takeoff" || l.type === "both");
    const landings = (locations || []).filter((l: Location) => l.type === "landing" || l.type === "both");
    const totalMinutes = flights.reduce((s, f) => s + (f.duration_minutes || 0), 0);
    const totalAltitude = flights.reduce((s, f) => s + (f.altitude_gain || 0), 0);
    const totalDistance = flights.reduce((s, f) => s + (f.distance_km ? Number(f.distance_km) : 0), 0);
    const today = formatDate(new Date().toISOString());

    // Build yearly stats
    const yearlyStats: Record<number, { flights: number; minutes: number; altitude: number; distance: number }> = {};
    for (const f of flights) {
      const yr = new Date(f.date).getFullYear();
      if (!yearlyStats[yr]) yearlyStats[yr] = { flights: 0, minutes: 0, altitude: 0, distance: 0 };
      yearlyStats[yr].flights++;
      yearlyStats[yr].minutes += f.duration_minutes || 0;
      yearlyStats[yr].altitude += f.altitude_gain || 0;
      yearlyStats[yr].distance += f.distance_km ? Number(f.distance_km) : 0;
    }
    const years = Object.keys(yearlyStats).map(Number).sort();

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

    // ── Cover page ──
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("Flugbuch", marginL, y + 5);
    y += 18;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const infoLines = [
      `Name: ${pilotName}`,
      `E-Mail: ${email}`,
      ...(flightSchool ? [`Flugschule: ${flightSchool}`] : []),
      `Anzahl Startplätze: ${takeoffs.length}`,
      `Anzahl Landeplätze: ${landings.length}`,
      `Anzahl Flüge: ${flights.length}`,
      `Flugstunden: ${formatDuration(totalMinutes)}`,
      `Höhenmeter: ${totalAltitude.toLocaleString("de-CH")} m`,
      `Strecke: ${totalDistance.toFixed(1)} km`,
    ];
    for (const line of infoLines) {
      doc.text(line, marginL, y);
      y += 6;
    }
    y += 8;

    // ── Glider table ──
    if (gliders.length > 0) {
      ensurePortraitSpace(20);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Gleitschirme", marginL, y);
      y += 7;

      const gliderCols = [
        { label: "Hersteller", x: marginL },
        { label: "Modell", x: marginL + 35 },
        { label: "Grösse", x: marginL + 75 },
        { label: "Letzter Check", x: marginL + 95 },
        { label: "Nächster Check", x: marginL + 125 },
        { label: "Rettung", x: marginL + 158 },
      ];

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      for (const c of gliderCols) doc.text(c.label, c.x, y);
      y += 1;
      doc.setLineWidth(0.3);
      doc.line(marginL, y, pW - marginR, y);
      y += 4;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      for (let i = 0; i < gliders.length; i++) {
        const g = gliders[i];
        ensurePortraitSpace(5);
        drawZebraRow(doc, i, marginL, y, pW - marginL - marginR, 4.5);
        const name = g.is_default ? `${g.manufacturer} ★` : g.manufacturer;
        doc.text(name, gliderCols[0].x, y);
        doc.text(g.model, gliderCols[1].x, y);
        doc.text(g.size || "", gliderCols[2].x, y);
        doc.text(g.last_check_date ? formatDate(g.last_check_date) : "–", gliderCols[3].x, y);
        doc.text(g.next_check_date ? formatDate(g.next_check_date) : "–", gliderCols[4].x, y);
        doc.text(g.reserve_repack_date ? formatDate(g.reserve_repack_date) : "–", gliderCols[5].x, y);
        y += 4.5;
      }
      y += 6;
    }

    // ── Location tables (with zebra) ──
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
      for (let i = 0; i < locs.length; i++) {
        const loc = locs[i];
        ensurePortraitSpace(5);
        drawZebraRow(doc, i, marginL, y, pW - marginL - marginR, 4.5);
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

    // ── Yearly statistics page (Portrait) ──
    if (years.length > 0) {
      doc.addPage("a4", "p");
      y = marginT;

      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Pilot: ${pilotName}`, marginL, y);
      y += 8;
      doc.setTextColor(0);

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Jahresstatistik", marginL, y);
      y += 10;

      const statCols = [
        { label: "Jahr", x: marginL },
        { label: "Flüge", x: marginL + 25 },
        { label: "Flugzeit", x: marginL + 50 },
        { label: "Höhenmeter", x: marginL + 85 },
        { label: "Distanz (km)", x: marginL + 120 },
      ];

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      for (const c of statCols) doc.text(c.label, c.x, y);
      y += 1;
      doc.setLineWidth(0.4);
      doc.line(marginL, y, pW - marginR, y);
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      for (let i = 0; i < years.length; i++) {
        const yr = years[i];
        const s = yearlyStats[yr];
        ensurePortraitSpace(6);
        drawZebraRow(doc, i, marginL, y, pW - marginL - marginR, 5.5);
        doc.text(String(yr), statCols[0].x, y);
        doc.text(String(s.flights), statCols[1].x, y);
        doc.text(formatDuration(s.minutes), statCols[2].x, y);
        doc.text(s.altitude.toLocaleString("de-CH"), statCols[3].x, y);
        doc.text(s.distance.toFixed(1), statCols[4].x, y);
        y += 5.5;
      }

      // Totals row
      y += 2;
      doc.setLineWidth(0.3);
      doc.line(marginL, y - 1, pW - marginR, y - 1);
      doc.setFont("helvetica", "bold");
      doc.text("Total", statCols[0].x, y + 3);
      doc.text(String(flights.length), statCols[1].x, y + 3);
      doc.text(formatDuration(totalMinutes), statCols[2].x, y + 3);
      doc.text(totalAltitude.toLocaleString("de-CH"), statCols[3].x, y + 3);
      doc.text(totalDistance.toFixed(1), statCols[4].x, y + 3);

      addPortraitFooter();
    }

    // ── Flight pages (Landscape) with zebra ──
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
      const desc = (f.comments || "") + (f.is_solo_shv ? " ★ SHV SOLO" : "");
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

      // Zebra striping
      drawZebraRow(doc, i, marginL, y, lW - marginL - marginR, rowH + 1);

      if (f.is_solo_shv) {
        doc.setFont("helvetica", "bold");
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

      if (f.is_solo_shv) {
        doc.setFont("helvetica", "normal");
      }

      y += rowH + 1;
    }

    addLandscapeFooter();

    // ── Solo flights confirmation page (Portrait) ──
    if (soloFlights.length > 0) {
      doc.addPage("a4", "p");
      y = marginT;

      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Pilot: ${pilotName}`, marginL, y);
      y += 8;
      doc.setTextColor(0);

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("SHV Soloflug-Bestätigung", marginL, y);
      y += 10;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Die folgenden Soloflüge wurden unter Aufsicht der Flugschule durchgeführt:", marginL, y);
      y += 8;

      const soloCols = [
        { label: "Nr", x: marginL },
        { label: "Datum", x: marginL + 10 },
        { label: "Gleitschirm", x: marginL + 35 },
        { label: "Start", x: marginL + 70 },
        { label: "Landung", x: marginL + 110 },
        { label: "Flugdauer", x: marginL + 150 },
      ];

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      for (const c of soloCols) doc.text(c.label, c.x, y);
      y += 1;
      doc.setLineWidth(0.3);
      doc.line(marginL, y, pW - marginR, y);
      y += 4;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      for (let i = 0; i < soloFlights.length; i++) {
        const f = soloFlights[i];
        ensurePortraitSpace(5);
        drawZebraRow(doc, i, marginL, y, pW - marginL - marginR, 5);
        doc.text(String(i + 1), soloCols[0].x, y);
        doc.text(formatDate(f.date), soloCols[1].x, y);
        doc.text(f.glider || "", soloCols[2].x, y);
        doc.text(f.takeoff_location?.name || "", soloCols[3].x, y);
        doc.text(f.landing_location?.name || "", soloCols[4].x, y);
        doc.text(f.duration_minutes ? formatDuration(f.duration_minutes) : "", soloCols[5].x, y);
        y += 5;
      }

      y += 15;
      doc.setFontSize(9);
      doc.text("Hiermit bestätige ich, dass die oben aufgeführten Soloflüge unter", marginL, y);
      y += 5;
      doc.text("Aufsicht der Flugschule durchgeführt wurden.", marginL, y);
      y += 20;

      doc.text("Ort, Datum: ___________________________________", marginL, y);
      y += 15;
      doc.text("Fluglehrer: ___________________________________", marginL, y);
      y += 15;
      doc.text("Unterschrift / Stempel: ___________________________________", marginL, y);

      addPortraitFooter();
    }

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
