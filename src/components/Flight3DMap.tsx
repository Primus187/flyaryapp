import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface TrackPoint {
  lat: number;
  lng: number;
  altitude: number;
  time: string;
}

interface Props {
  points: TrackPoint[];
  onHoverIndex?: (index: number | null) => void;
  highlightIndex?: number | null;
}

function getColor(alt: number, min: number, max: number): string {
  const range = max - min || 1;
  const t = (alt - min) / range;
  if (t < 0.5) {
    const s = t * 2;
    const r = Math.round(0 + s * 255);
    const g = Math.round(100 + s * 155);
    const b = Math.round(255 - s * 255);
    return `rgb(${r},${g},${b})`;
  }
  const s = (t - 0.5) * 2;
  const r = 255;
  const g = Math.round(255 - s * 200);
  const b = 0;
  return `rgb(${r},${g},${b})`;
}

/** Create a thin polygon perpendicular to the flight direction */
function segmentToPolygon(
  p1: TrackPoint,
  p2: TrackPoint,
  width: number = 0.00004
): [number, number][] {
  const dx = p2.lng - p1.lng;
  const dy = p2.lat - p1.lat;
  const len = Math.sqrt(dx * dx + dy * dy) || 0.00001;
  // perpendicular unit vector
  const nx = (-dy / len) * width;
  const ny = (dx / len) * width;

  return [
    [p1.lng - nx, p1.lat - ny],
    [p1.lng + nx, p1.lat + ny],
    [p2.lng + nx, p2.lat + ny],
    [p2.lng - nx, p2.lat - ny],
    [p1.lng - nx, p1.lat - ny], // close ring
  ];
}

export default function Flight3DMap({ points, onHoverIndex, highlightIndex }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || points.length < 2) return;

    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    let minAlt = Infinity, maxAlt = -Infinity;
    for (const p of points) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
      if (p.altitude < minAlt) minAlt = p.altitude;
      if (p.altitude > maxAlt) maxAlt = p.altitude;
    }

    const center: [number, number] = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          "satellite": {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            ],
            tileSize: 256,
            attribution: "Esri World Imagery",
            maxzoom: 18,
          },
          "terrain-tiles": {
            type: "raster-dem",
            tiles: [
              "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
            ],
            tileSize: 256,
            encoding: "terrarium",
            maxzoom: 15,
          },
        },
        layers: [
          {
            id: "satellite-layer",
            type: "raster",
            source: "satellite",
            minzoom: 0,
            maxzoom: 18,
          },
        ],
        terrain: {
          source: "terrain-tiles",
          exaggeration: 1.3,
        },
        sky: {
          "sky-color": "#89CFF0",
          "horizon-color": "#ffffff",
          "fog-color": "#ffffff",
          "sky-horizon-blend": 0.5,
        } as any,
      },
      center,
      zoom: 12,
      pitch: 60,
      bearing: 0,
      maxPitch: 85,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

    map.on("load", () => {
      // Build fill-extrusion polygons for elevated track
      const extrusionFeatures: GeoJSON.Feature[] = [];
      // Build ground shadow line
      const shadowCoords: [number, number][] = [];

      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const avgAlt = (p1.altitude + p2.altitude) / 2;
        const height = avgAlt;
        const base = Math.max(0, avgAlt - 8);

        extrusionFeatures.push({
          type: "Feature",
          properties: {
            color: getColor(avgAlt, minAlt, maxAlt),
            height,
            base,
          },
          geometry: {
            type: "Polygon",
            coordinates: [segmentToPolygon(p1, p2)],
          },
        });

        if (i === 0) shadowCoords.push([p1.lng, p1.lat]);
        shadowCoords.push([p2.lng, p2.lat]);
      }

      // Ground shadow line
      map.addSource("track-shadow", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: shadowCoords },
        },
      });

      map.addLayer({
        id: "track-shadow-line",
        type: "line",
        source: "track-shadow",
        paint: {
          "line-color": "rgba(0,0,0,0.3)",
          "line-width": 2,
          "line-dasharray": [2, 4],
        },
      });

      // Elevated track as fill-extrusion
      map.addSource("track-extrusion", {
        type: "geojson",
        data: { type: "FeatureCollection", features: extrusionFeatures },
      });

      map.addLayer({
        id: "track-3d",
        type: "fill-extrusion",
        source: "track-extrusion",
        paint: {
          "fill-extrusion-color": ["get", "color"],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "base"],
          "fill-extrusion-opacity": 0.9,
        },
      });

      // Start/end markers
      new maplibregl.Marker({ color: "#22c55e" })
        .setLngLat([points[0].lng, points[0].lat])
        .setPopup(new maplibregl.Popup().setText("Start"))
        .addTo(map);

      new maplibregl.Marker({ color: "#ef4444" })
        .setLngLat([points[points.length - 1].lng, points[points.length - 1].lat])
        .setPopup(new maplibregl.Popup().setText("Landing"))
        .addTo(map);

      // Fit bounds
      const bounds = new maplibregl.LngLatBounds([minLng, minLat], [maxLng, maxLat]);
      map.fitBounds(bounds, { padding: 60, pitch: 60, duration: 1000 });

      // Hover marker
      const marker = new maplibregl.Marker({ color: "#fff", scale: 0.6 })
        .setLngLat(center)
        .addTo(map);
      marker.getElement().style.display = "none";
      markerRef.current = marker;

      setMapReady(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      setMapReady(false);
    };
  }, [points]);

  // Sync highlight marker
  useEffect(() => {
    if (!mapReady || !markerRef.current || !points.length) return;
    if (highlightIndex != null && highlightIndex >= 0 && highlightIndex < points.length) {
      const p = points[highlightIndex];
      markerRef.current.setLngLat([p.lng, p.lat]);
      markerRef.current.getElement().style.display = "block";
    } else {
      markerRef.current.getElement().style.display = "none";
    }
  }, [highlightIndex, mapReady, points]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-xl overflow-hidden border border-border"
      style={{ height: "55vh", minHeight: 300 }}
    />
  );
}
