import { describe, expect, it } from "vitest";
import { parseDhvDirections, parseDhvXml } from "./dhv-sites";
import { normalizeSiteName, officialSiteNames, type NamingInput } from "./site-names";
import { distanceMeters, nearestSite, searchSites, suggestSiteLinks, type OfficialSite } from "./official-sites";

const xml = `<?xml version="1.0" encoding="UTF-8"?><DhvXml><FlyingSites>
<FlyingSite><SiteID>1</SiteID><SiteName><![CDATA[Kronberg]]></SiteName><SiteUrl><![CDATA[https://service.dhv.de/x?item=1]]></SiteUrl>
  <Location><LocationName><![CDATA[Kronberg Startplatz 1]]></LocationName><Coordinates>9.33,47.29</Coordinates><LocationID>10</LocationID>
    <LocationType>1</LocationType><Altitude>1640</Altitude><LocationCountry>CH</LocationCountry><Region><![CDATA[Appenzell Innerrhoden]]></Region>
    <Municipality><![CDATA[Jakobsbad]]></Municipality><DirectionsText>NO-S</DirectionsText><Hanggliding>false</Hanggliding><Paragliding>true</Paragliding></Location>
  <Location><LocationName><![CDATA[Kronberg Landelatz]]></LocationName><Coordinates>9.35,47.31</Coordinates><LocationID>11</LocationID>
    <LocationType>2</LocationType><Altitude></Altitude><LocationCountry>CH</LocationCountry><DirectionsText></DirectionsText></Location>
</FlyingSite>
<FlyingSite><SiteID>2</SiteID><SiteName><![CDATA[Nachbar]]></SiteName>
  <Location><LocationName><![CDATA[Kronberg Landelatz]]></LocationName><Coordinates>9.35,47.31</Coordinates><LocationID>11</LocationID><LocationType>2</LocationType></Location>
  <Location><LocationName><![CDATA[Oberrieden Start-/Landeplatz]]></LocationName><Coordinates>8.58,47.27</Coordinates><LocationID>12</LocationID><LocationType>1</LocationType></Location>
</FlyingSite></FlyingSites></DhvXml>`;

describe("DHV import", () => {
  it("reads every place once with its area, type and data", () => {
    const rows = parseDhvXml(xml, normalizeSiteName);
    expect(rows.map((r) => [r.source_id, r.source_name, r.type])).toEqual([
      ["10", "Kronberg Startplatz 1", "takeoff"],
      ["11", "Kronberg Landeplatz", "landing"],
      ["12", "Oberrieden Start-/Landeplatz", "both"],
    ]);
    expect(rows[0]).toMatchObject({ area_name: "Kronberg", latitude: 47.29, longitude: 9.33, altitude: 1640, country_code: "CH", region: "Appenzell Innerrhoden",
      municipality: "Jakobsbad", wind_directions: ["NE", "E", "SE", "S"], paragliding: true, hanggliding: false, source_url: "https://service.dhv.de/x?item=1" });
    expect(rows[1]).toMatchObject({ altitude: null, wind_directions: [], area_name: "Kronberg" });
  });

  it("turns DHV directions into app compass points", () => {
    expect(parseDhvDirections("SW-W")).toEqual(["SW", "W"]);
    expect(parseDhvDirections("NW-NO")).toEqual(["N", "NE", "NW"]);
    expect(parseDhvDirections("S, NO")).toEqual(["NE", "S"]);
    expect(parseDhvDirections("W-WNW")).toEqual(["W"]);
    expect(parseDhvDirections("WNW")).toEqual(["W", "NW"]);
    expect(parseDhvDirections("")).toEqual([]);
    expect(parseDhvDirections("xyz")).toEqual([]);
  });
});

const place = (source_id: string, source_name: string, type: NamingInput["type"], municipality: string | null, latitude: number, area_name: string | null = null): NamingInput =>
  ({ source_id, source_name, type, municipality, area_name, latitude, longitude: 8 });

describe("official site names", () => {
  const names = (rows: NamingInput[]) => Object.fromEntries([...officialSiteNames(rows)].map(([id, n]) => [id, n]));

  it("drops the site word; takeoffs keep their area, landings take their municipality", () => {
    const n = names([
      place("1", "Kronberg Startplatz 2", "takeoff", "Jakobsbad", 47.1),
      place("2", "Kronberg Landeplatz", "landing", "Jakobsbad", 47.2),
      place("3", "Startplatz Mostelegg", "takeoff", "Sattel", 47.3),
      place("4", "Oberrieden Start-/Landeplatz", "both", "Oberrieden", 47.4),
      place("5", "Brändlen Landeplatz", "landing", "Wolfenschießen", 47.5),
      place("6", "Abendberg", "takeoff", null, 47.6),
    ]);
    expect([n[1].de, n[2].de, n[3].de, n[4].de, n[5].de, n[6].de]).toEqual(["Kronberg 2", "Jakobsbad", "Mostelegg", "Oberrieden", "Wolfenschiessen", "Abendberg"]);
  });

  it("translates only extras like Winter", () => {
    const n = names([place("1", "Belalp Startplatz 2 (Winter)", "takeoff", "Blatten", 46.4), place("2", "Sommer Startplatz", "takeoff", null, 46.5)]);
    expect(n[1]).toEqual({ de: "Belalp 2 (Winter)", fr: "Belalp 2 (hiver)", en: "Belalp 2 (winter)" });
    expect(n[2].en).toBe("Sommer");
  });

  it("tells landings of one municipality apart only when they are at different spots", () => {
    const n = names([
      place("1", "Metsch Landeplatz", "landing", "Lenk", 46.44),
      place("2", "Schatthorn Landeplatz", "landing", "Lenk", 46.45, "Schatthorn"),
      place("3", "Flöschhorn Landeplatz", "landing", "Lenk", 46.46, "Schatthorn"),
      place("4", "Linderenalp Landeplatz 2", "landing", "Sarnen", 46.8984),
      place("5", "Ruedlen Landeplatz 2", "landing", "Sarnen", 46.89841),
      place("6", "Hoch-Ybrig Landeplatz", "landing", "Hoch-Ybrig", 47.02),
      place("7", "Klein Sternen Landeplatz", "landing", "Hoch-Ybrig", 47.02001),
    ]);
    expect([n[1].de, n[2].de, n[3].de]).toEqual(["Lenk (Metsch)", "Lenk (Schatthorn)", "Lenk (Flöschhorn)"]);
    expect(n[4].de).toBe("Sarnen 2");
    expect(n[5].de).toBe("Sarnen 2");
    expect([n[6].de, n[7].de]).toEqual(["Hoch-Ybrig", "Hoch-Ybrig"]);
  });

  it("writes Swiss German and fixes source typos", () => {
    expect(normalizeSiteName("Grosse  Scheidegg Landelatz ß")).toBe("Grosse Scheidegg Landeplatz ss");
  });
});

const site = (id: string, type: OfficialSite["type"], latitude: number, longitude: number): OfficialSite => ({
  id, name_de: `${id} Startplatz`, name_fr: `${id} Décollage`, name_en: `${id} Takeoff`, area_name: id, type, latitude, longitude,
  altitude: null, country_code: "CH", region: "Bern", wind_directions: [],
});

describe("finding sites by position", () => {
  const sites = [site("A", "takeoff", 46.5, 7.5), site("B", "landing", 46.501, 7.5), site("C", "both", 46.6, 7.5)];

  it("measures distances", () => {
    expect(Math.round(distanceMeters(46.5, 7.5, 46.501, 7.5))).toBe(111);
  });

  it("picks the nearest site of a fitting type within the radius", () => {
    expect(nearestSite(sites, 46.5005, 7.5, "landing", 300)?.site.id).toBe("B");
    expect(nearestSite(sites, 46.5005, 7.5, "takeoff", 300)?.site.id).toBe("A");
    expect(nearestSite(sites, 46.55, 7.5, "takeoff", 300)).toBeNull();
    expect(nearestSite(sites, 46.6001, 7.5, "landing", 300)?.site.id).toBe("C");
  });

  it("suggests links only for unlinked own places with a position", () => {
    const own = [
      { id: "1", name: "Mein A", type: "takeoff", latitude: 46.5001, longitude: 7.5 },
      { id: "2", name: "Schon verknüpft", type: "takeoff", latitude: 46.5, longitude: 7.5, official_site_id: "A" },
      { id: "3", name: "Ohne Position", type: "both", latitude: 0, longitude: 0 },
      { id: "4", name: "Weit weg", type: "both", latitude: 47, longitude: 8 },
    ];
    expect(suggestSiteLinks(own, sites).map((s) => [s.location.id, s.site.id, s.meters])).toEqual([["1", "A", 11]]);
  });

  it("searches names in every language and the region", () => {
    expect(searchSites(sites, "a decol", "takeoff").map((s) => s.id)).toEqual(["A"]);
    expect(searchSites(sites, "Start", "takeoff").map((s) => s.id)).toEqual(["A", "C"]);
    expect(searchSites(sites, "bern", "landing").map((s) => s.id)).toEqual(["B", "C"]);
    expect(searchSites(sites, " ", "both")).toEqual([]);
  });
});
