import { supabase } from "@/integrations/supabase/client";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function exportFlightsCsv(userId: string): Promise<{ rows: number; blob: Blob }> {
  const { data, error } = await supabase
    .from("flights")
    .select(`
      date, duration_minutes, distance_km, altitude_gain, glider, thermals,
      wind_speed, wind_direction, comments, is_solo_shv,
      takeoff_location:takeoff_location_id ( name, latitude, longitude ),
      landing_location:landing_location_id ( name, latitude, longitude )
    `)
    .eq("user_id", userId)
    .order("date", { ascending: false });

  if (error) throw error;

  const headers = [
    "date", "takeoff", "takeoff_lat", "takeoff_lng",
    "landing", "landing_lat", "landing_lng",
    "duration_minutes", "distance_km", "altitude_gain_m",
    "glider", "thermals", "wind_speed_kmh", "wind_direction",
    "is_solo_shv", "comments",
  ];

  const lines = [headers.join(",")];
  for (const f of data ?? []) {
    const t: any = (f as any).takeoff_location;
    const l: any = (f as any).landing_location;
    lines.push([
      f.date,
      t?.name ?? "", t?.latitude ?? "", t?.longitude ?? "",
      l?.name ?? "", l?.latitude ?? "", l?.longitude ?? "",
      f.duration_minutes ?? "", f.distance_km ?? "", f.altitude_gain ?? "",
      f.glider ?? "", f.thermals ?? "", f.wind_speed ?? "", f.wind_direction ?? "",
      f.is_solo_shv ? "true" : "false",
      f.comments ?? "",
    ].map(csvEscape).join(","));
  }

  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  return { rows: data?.length ?? 0, blob };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
