import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  takeoff_location: { name: string; altitude: number | null } | null;
  landing_location: { name: string; altitude: number | null } | null;
}

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const s = 0;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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

    // Fetch profile
    const { data: profile } = await supabase.from("profiles").select("pilot_name, glider_info").eq("user_id", user.id).single();
    const pilotName = profile?.pilot_name || "Pilot";
    const email = user.email || "";

    // Fetch locations
    const { data: locations } = await supabase.from("locations").select("id, name, altitude, type, description").eq("user_id", user.id).order("name");

    // Fetch flights with locations
    const { data: flightsRaw } = await supabase
      .from("flights")
      .select("id, date, glider, duration_minutes, altitude_gain, distance_km, comments, takeoff:locations!flights_takeoff_location_id_fkey(name, altitude), landing:locations!flights_landing_location_id_fkey(name, altitude)")
      .eq("user_id", user.id)
      .order("date", { ascending: true });

    const flights: Flight[] = (flightsRaw || []).map((f: any) => ({
      ...f,
      takeoff_location: f.takeoff,
      landing_location: f.landing,
    }));

    const takeoffs = (locations || []).filter((l: Location) => l.type === "takeoff" || l.type === "both");
    const landings = (locations || []).filter((l: Location) => l.type === "landing" || l.type === "both");

    const totalMinutes = flights.reduce((s, f) => s + (f.duration_minutes || 0), 0);

    // Create PDF
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = 297;
    const pageH = 210;
    const marginL = 12;
    const marginR = 12;
    const marginT = 15;
    const contentW = pageW - marginL - marginR;
    let y = marginT;

    const addFooter = (pageNum: number, totalPages: string) => {
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text("Stempel / Unterschrift: _______________________________", marginL, pageH - 12);
      const today = formatDate(new Date().toISOString());
      doc.text(`${pageNum}`, pageW / 2, pageH - 7, { align: "center" });
      doc.text(today, pageW - marginR, pageH - 7, { align: "right" });
      doc.setTextColor(0);
    };

    const ensureSpace = (needed: number): boolean => {
      if (y + needed > pageH - 20) {
        addFooter(doc.getNumberOfPages(), "");
        doc.addPage();
        y = marginT;
        // Add pilot header on new page
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Pilot: ${pilotName}`, marginL, y);
        y += 8;
        doc.setTextColor(0);
        return true;
      }
      return false;
    };

    // ===== PAGE 1: Cover =====
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
    y += 6;

    // Takeoff table
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Startplätze", marginL, y);
    y += 7;

    const colsLoc = [
      { label: "Name", w: 60, x: marginL },
      { label: "Höhe", w: 20, x: marginL + 60 },
      { label: "Notizen", w: 80, x: marginL + 80 },
    ];

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    for (const c of colsLoc) {
      doc.text(c.label, c.x, y);
    }
    y += 1;
    doc.setLineWidth(0.3);
    doc.line(marginL, y, marginL + 160, y);
    y += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    for (const loc of takeoffs) {
      ensureSpace(5);
      doc.text(loc.name, colsLoc[0].x, y);
      doc.text(loc.altitude ? String(loc.altitude) : "", colsLoc[1].x, y);
      doc.text(loc.description || "", colsLoc[2].x, y);
      y += 4.5;
    }
    y += 6;

    // Landing table
    ensureSpace(20);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Landeplätze", marginL, y);
    y += 7;

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    for (const c of colsLoc) {
      doc.text(c.label, c.x, y);
    }
    y += 1;
    doc.line(marginL, y, marginL + 160, y);
    y += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    for (const loc of landings) {
      ensureSpace(5);
      doc.text(loc.name, colsLoc[0].x, y);
      doc.text(loc.altitude ? String(loc.altitude) : "", colsLoc[1].x, y);
      doc.text(loc.description || "", colsLoc[2].x, y);
      y += 4.5;
    }

    addFooter(1, "");

    // ===== FLIGHT PAGES =====
    doc.addPage();
    y = marginT;
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Pilot: ${pilotName}`, marginL, y);
    y += 4;
    doc.setTextColor(0);

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Flüge", marginL, y);
    y += 7;

    // Flight table columns
    const colsF = [
      { label: "Nr", w: 10, x: marginL },
      { label: "Datum", w: 22, x: marginL + 10 },
      { label: "Gleitschirm", w: 35, x: marginL + 32 },
      { label: "Start", w: 40, x: marginL + 67 },
      { label: "Landung", w: 35, x: marginL + 107 },
      { label: "Flugdauer", w: 20, x: marginL + 142 },
      { label: "Km", w: 12, x: marginL + 162 },
      { label: "Diff.", w: 14, x: marginL + 174 },
      { label: "Beschreibung", w: 85, x: marginL + 188 },
    ];

    const drawFlightHeader = () => {
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      for (const c of colsF) {
        doc.text(c.label, c.x, y);
      }
      y += 1;
      doc.setLineWidth(0.3);
      doc.line(marginL, y, pageW - marginR, y);
      y += 4;
      doc.setFont("helvetica", "normal");
    };

    drawFlightHeader();

    doc.setFontSize(7.5);
    for (let i = 0; i < flights.length; i++) {
      const f = flights[i];
      const desc = f.comments || "";
      // Calculate description lines
      const descLines = doc.splitTextToSize(desc, colsF[8].w);
      const rowH = Math.max(4.5, descLines.length * 3.5);

      if (y + rowH > pageH - 20) {
        addFooter(doc.getNumberOfPages(), "");
        doc.addPage();
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

      if (descLines.length > 0) {
        doc.text(descLines, colsF[8].x, y);
      }

      y += rowH + 1;
    }

    addFooter(doc.getNumberOfPages(), "");

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
