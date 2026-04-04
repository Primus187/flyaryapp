import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  width: number = 0.00015
): [number, number][] {
  const dx = p2.lng - p1.lng;
  const dy = p2.lat - p1.lat;
  const len = Math.sqrt(dx * dx + dy * dy) || 0.00001;
  const nx = (-dy / len) * width;
  const ny = (dx / len) * width;

  return [
    [p1.lng - nx, p1.lat - ny],
    [p1.lng + nx, p1.lat + ny],
    [p2.lng + nx, p2.lat + ny],
    [p2.lng - nx, p2.lat - ny],
    [p1.lng - nx, p1.lat - ny],
  ];
}

/** Downsample points for performance – keep every Nth point */
function downsample(pts: TrackPoint[], maxPts: number): TrackPoint[] {
  if (pts.length <= maxPts) return pts;
  const step = pts.length / maxPts;
  const result: TrackPoint[] = [];
  for (let i = 0; i < maxPts; i++) {
    result.push(pts[Math.floor(i * step)]);
  }
  // always include last point
  if (result[result.length - 1] !== pts[pts.length - 1]) {
    result.push(pts[pts.length - 1]);
  }
  return result;
}

export default function Flight3DMap({ points, onHoverIndex, highlightIndex }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const animMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [animProgress, setAnimProgress] = useState(0);
  const animFrameRef = useRef<number>(0);
  const playingRef = useRef(false);
  const progressRef = useRef(0);
  const frameCountRef = useRef(0);
  const altRangeRef = useRef({ min: 0, max: 1 });

  // Stabilize renderPoints with useMemo to prevent map re-init on re-render
  const renderPoints = useMemo(() => downsample(points, 800), [points]);

  useEffect(() => {
    if (!containerRef.current || renderPoints.length < 2) return;

    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    let minAlt = Infinity, maxAlt = -Infinity;
    for (const p of renderPoints) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
      if (p.altitude < minAlt) minAlt = p.altitude;
      if (p.altitude > maxAlt) maxAlt = p.altitude;
    }
    altRangeRef.current = { min: minAlt, max: maxAlt };
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
          exaggeration: 1.0,
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
      // Build vertical drop-lines for spatial reference (every Nth segment)
      const dropFeatures: GeoJSON.Feature[] = [];

      for (let i = 0; i < renderPoints.length - 1; i++) {
        const p1 = renderPoints[i];
        const p2 = renderPoints[i + 1];
        const avgAlt = (p1.altitude + p2.altitude) / 2;

        extrusionFeatures.push({
          type: "Feature",
          properties: {
            color: getColor(avgAlt, minAlt, maxAlt),
            height: avgAlt,
            base: Math.max(0, avgAlt - 12),
          },
          geometry: {
            type: "Polygon",
            coordinates: [segmentToPolygon(p1, p2)],
          },
        });

        if (i === 0) shadowCoords.push([p1.lng, p1.lat]);
        shadowCoords.push([p2.lng, p2.lat]);

        // Add vertical reference lines every 30 segments
        if (i % 30 === 0) {
          dropFeatures.push({
            type: "Feature",
            properties: { height: p1.altitude, base: 0 },
            geometry: {
              type: "Polygon",
              coordinates: [segmentToPolygon(
                p1,
                { ...p1, lng: p1.lng + 0.00002, lat: p1.lat + 0.00002 },
                0.00003
              )],
            },
          });
        }
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
          "line-color": "rgba(0,0,0,0.25)",
          "line-width": 2,
          "line-dasharray": [2, 4],
        },
      });

      // Vertical drop-lines
      if (dropFeatures.length > 0) {
        map.addSource("drop-lines", {
          type: "geojson",
          data: { type: "FeatureCollection", features: dropFeatures },
        });
        map.addLayer({
          id: "drop-lines-layer",
          type: "fill-extrusion",
          source: "drop-lines",
          paint: {
            "fill-extrusion-color": "rgba(255,255,255,0.3)",
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": ["get", "base"],
            "fill-extrusion-opacity": 0.4,
          },
        });
      }

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
          "fill-extrusion-opacity": 0.92,
        },
      });

      // Animated track source (starts empty, filled during playback)
      map.addSource("track-animated", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "track-animated-3d",
        type: "fill-extrusion",
        source: "track-animated",
        paint: {
          "fill-extrusion-color": "#ffffff",
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "base"],
          "fill-extrusion-opacity": 0.95,
        },
      });

      // Start/end markers
      new maplibregl.Marker({ color: "#22c55e" })
        .setLngLat([renderPoints[0].lng, renderPoints[0].lat])
        .setPopup(new maplibregl.Popup().setText("Start"))
        .addTo(map);

      new maplibregl.Marker({ color: "#ef4444" })
        .setLngLat([renderPoints[renderPoints.length - 1].lng, renderPoints[renderPoints.length - 1].lat])
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

      // Animation marker (larger, visible during playback)
      const animMarker = new maplibregl.Marker({ color: "#facc15", scale: 0.8 })
        .setLngLat(center)
        .addTo(map);
      animMarker.getElement().style.display = "none";
      animMarkerRef.current = animMarker;

      setMapReady(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      animMarkerRef.current = null;
      setMapReady(false);
      setPlaying(false);
      playingRef.current = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [renderPoints]);

  // Sync highlight marker
  useEffect(() => {
    if (!mapReady || !markerRef.current || !renderPoints.length) return;
    if (highlightIndex != null && highlightIndex >= 0 && highlightIndex < points.length) {
      const p = points[highlightIndex];
      markerRef.current.setLngLat([p.lng, p.lat]);
      markerRef.current.getElement().style.display = "block";
    } else {
      markerRef.current.getElement().style.display = "none";
    }
  }, [highlightIndex, mapReady, points, renderPoints]);

  // Animation loop
  const animate = useCallback(() => {
    if (!playingRef.current || !mapRef.current || !animMarkerRef.current) return;

    progressRef.current += 0.002; // ~8 seconds for full flight at 60fps
    if (progressRef.current >= 1) {
      progressRef.current = 1;
      playingRef.current = false;
      setPlaying(false);
      setAnimProgress(1);
      return;
    }

    setAnimProgress(progressRef.current);

    const idx = Math.floor(progressRef.current * (renderPoints.length - 1));
    const p = renderPoints[Math.min(idx, renderPoints.length - 1)];
    
    // Move animation marker
    animMarkerRef.current.setLngLat([p.lng, p.lat]);
    animMarkerRef.current.getElement().style.display = "block";

    // Update animated track (white overlay showing progress)
    const map = mapRef.current;
    const source = map.getSource("track-animated") as maplibregl.GeoJSONSource;
    if (source) {
      let minAlt = Infinity, maxAlt = -Infinity;
      for (const pt of renderPoints) {
        if (pt.altitude < minAlt) minAlt = pt.altitude;
        if (pt.altitude > maxAlt) maxAlt = pt.altitude;
      }
      
      const features: GeoJSON.Feature[] = [];
      for (let i = 0; i < Math.min(idx, renderPoints.length - 1); i++) {
        const p1 = renderPoints[i];
        const p2 = renderPoints[i + 1];
        const avgAlt = (p1.altitude + p2.altitude) / 2;
        features.push({
          type: "Feature",
          properties: {
            height: avgAlt + 2, // slightly above the main track
            base: avgAlt - 2,
          },
          geometry: {
            type: "Polygon",
            coordinates: [segmentToPolygon(p1, p2, 0.0002)],
          },
        });
      }
      source.setData({ type: "FeatureCollection", features });
    }

    animFrameRef.current = requestAnimationFrame(animate);
  }, [renderPoints]);

  const handlePlay = useCallback(() => {
    if (playing) {
      playingRef.current = false;
      setPlaying(false);
      return;
    }
    // Reset if at end
    if (progressRef.current >= 1) {
      progressRef.current = 0;
      setAnimProgress(0);
      // Clear animated track
      const source = mapRef.current?.getSource("track-animated") as maplibregl.GeoJSONSource;
      if (source) source.setData({ type: "FeatureCollection", features: [] });
    }
    playingRef.current = true;
    setPlaying(true);
    animFrameRef.current = requestAnimationFrame(animate);
  }, [playing, animate]);

  const handleReset = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    progressRef.current = 0;
    setAnimProgress(0);
    if (animMarkerRef.current) {
      animMarkerRef.current.getElement().style.display = "none";
    }
    const source = mapRef.current?.getSource("track-animated") as maplibregl.GeoJSONSource;
    if (source) source.setData({ type: "FeatureCollection", features: [] });
  }, []);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="w-full rounded-xl overflow-hidden border border-border"
        style={{ height: "55vh", minHeight: 300 }}
      />
      
      {/* Playback controls */}
      {mapReady && (
        <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-background/80 backdrop-blur rounded-lg p-1.5 shadow-lg border border-border">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={handlePlay}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={handleReset}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          {/* Progress bar */}
          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-[width] duration-100"
              style={{ width: `${animProgress * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
