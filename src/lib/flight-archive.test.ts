import { describe, expect, it } from "vitest";
import { strFromU8, strToU8, unzipSync } from "fflate";
import * as XLSX from "xlsx";
import { assertComplete, igcPath, packArchive, sha256Hex } from "./flight-archive";
import { CSV_HEADERS, flightsXlsx, type CsvFlight } from "./csv-export";

const flight = (no: number, extra: Partial<CsvFlight> = {}): CsvFlight => ({
  id: `f${no}`, flight_no: no, date: "2026-09-22", takeoff_at: null, landing_at: null, duration_minutes: 48, distance_km: 12.4,
  altitude_gain: 820, glider: "Advance Alpha", discipline: "paraglider", is_tandem: false, flight_kind: "altitude", is_solo_shv: false,
  source: "manual", source_ref: null, thermals: null, wind_speed: null, wind_direction: null, comments: "Ruhig, ein Satz; mit Komma",
  takeoff_location: { name: "Niederbauen", latitude: 46.9, longitude: 8.5, altitude: 1575 },
  landing_location: { name: "Emmetten", latitude: 46.95, longitude: 8.51, altitude: 770 }, ...extra,
});

describe("flight archive", () => {
  it("names IGC files by flight number and date, without collisions", () => {
    const taken = new Set<string>();
    expect(igcPath(42, "2026-09-22", taken)).toBe("igc/0042_2026-09-22.igc");
    expect(igcPath(42, "2026-09-22", taken)).toBe("igc/0042_2026-09-22_2.igc");
    expect(igcPath(null, null, taken)).toBe("igc/0000_ohne-datum.igc");
  });

  it("refuses an export with fewer flights than the server holds", () => {
    expect(() => assertComplete(1500, 1500)).not.toThrow();
    expect(() => assertComplete(1500, 1000)).toThrow(/1000 of 1500/);
    expect(() => assertComplete(null, 3)).toThrow(/incomplete/);
  });

  it("packs every file with a checksum in the manifest", async () => {
    const igc = strToU8("AXCT001\nHFDTE220926\n");
    const { zip, manifest } = await packArchive(
      [{ path: "README.txt", data: strToU8("Hallo") }, { path: "igc/0001_2026-09-22.igc", data: igc }],
      { exported_at: "2026-09-30T10:00:00Z", counts: { flights: 1 } },
    );
    const files = unzipSync(zip);
    expect(Object.keys(files).sort()).toEqual(["README.txt", "igc/0001_2026-09-22.igc", "manifest.json"]);
    const read = JSON.parse(strFromU8(files["manifest.json"]));
    expect(read.format).toBe("flyary-archive/1");
    expect(read.counts).toEqual({ flights: 1 });
    expect(read.files).toEqual(manifest.files);
    expect(read.files[1]).toEqual({ path: "igc/0001_2026-09-22.igc", bytes: igc.byteLength, sha256: await sha256Hex(igc) });
    expect(strFromU8(files["igc/0001_2026-09-22.igc"])).toBe(strFromU8(igc));
  });

  it("writes the same columns to Excel as to CSV, in flight number order, numbers as numbers", async () => {
    const book = XLSX.read(await flightsXlsx([flight(2), flight(1, { comments: null })]), { type: "array" });
    expect(book.SheetNames).toEqual(["Flüge"]);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets["Flüge"], { header: 1 });
    expect(rows[0]).toEqual(CSV_HEADERS);
    expect(rows.slice(1).map((r) => r[0])).toEqual([1, 2]);
    const diff = rows[1][CSV_HEADERS.indexOf("height_difference_m")];
    expect(diff).toBe(805);
    expect(rows[2][CSV_HEADERS.indexOf("comments")]).toBe("Ruhig, ein Satz; mit Komma");
  });
});
