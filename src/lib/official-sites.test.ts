import { describe, expect, it } from "vitest";
import { parseDhvDirections, parseDhvXml } from "./dhv-sites";
import { localizeSiteName, normalizeSiteName } from "./site-names";
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
    expect(rows.map((r) => [r.source_id, r.name_de, r.type])).toEqual([
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

describe("site names in the app language", () => {
  it("translates only the site word and what follows it", () => {
    expect(localizeSiteName("Kronberg Startplatz 2", "fr")).toBe("Kronberg Décollage 2");
    expect(localizeSiteName("La Berneuse Landeplatz", "en")).toBe("La Berneuse Landing");
    expect(localizeSiteName("Belalp Startplatz 1 (Sommer)", "fr")).toBe("Belalp Décollage 1 (été)");
    expect(localizeSiteName("Startplatz Mostelegg", "en")).toBe("Takeoff Mostelegg");
    expect(localizeSiteName("Oberrieden Start-/Landeplatz", "fr")).toBe("Oberrieden Décollage/atterrissage");
    expect(localizeSiteName("Sommer Startplatz", "en")).toBe("Sommer Takeoff");
    expect(localizeSiteName("Abendberg", "fr")).toBe("Abendberg");
    expect(localizeSiteName("Kronberg Startplatz 2", "de")).toBe("Kronberg Startplatz 2");
    expect(localizeSiteName("Startberg Startplatz", "en")).toBe("Startberg Takeoff");
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
