import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Play, Pause, RotateCcw, Crosshair } from "lucide-react";
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

function segmentToPolygon(
  p1: TrackPoint,
  p2: TrackPoint,
  width: number = 0.0002
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

function pointToPolygon(p: TrackPoint, size: number = 0.0004): [number, number][] {
  const s = size;
  return [
    [p.lng - s, p.lat - s],
    [p.lng + s, p.lat - s],
    [p.lng + s, p.lat + s],
    [p.lng - s, p.lat + s],
    [p.lng - s, p.lat - s],
  ];
}

function downsample(pts: TrackPoint[], maxPts: number): TrackPoint[] {
  if (pts.length <= maxPts) return pts;
  const step = pts.length / maxPts;
  const result: TrackPoint[] = [];
  for (let i = 0; i < maxPts; i++) {
    result.push(pts[Math.floor(i * step)]);
  }
  if (result[result.length - 1] !== pts[pts.length - 1]) {
    result.push(pts[pts.length - 1]);
  }
  return result;
}

/** Interpolated baseline: start alt → end alt, so track touches ground at both ends */
function calcBaseline(pts: TrackPoint[], index: number): number {
  const startAlt = pts[0].altitude;
  const endAlt = pts[pts.length - 1].altitude;
  const t = pts.length > 1 ? index / (pts.length - 1) : 0;
  return startAlt + (endAlt - startAlt) * t;
}

const SPEED_STEPS = [
  { label: "1x", value: 0.0004 },
  { label: "2x", value: 0.0008 },
  { label: "5x", value: 0.002 },
  { label: "10x", value: 0.004 },
];

const TRAIL_LENGTH = 1;

export default function Flight3DMap({ points, onHoverIndex, highlightIndex }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  
  const [mapReady, setMapReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [animProgress, setAnimProgress] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [following, setFollowing] = useState(false);
  const animFrameRef = useRef<number>(0);
  const playingRef = useRef(false);
  const progressRef = useRef(0);
  const frameCountRef = useRef(0);
  const speedRef = useRef(SPEED_STEPS[0].value);
  const followRef = useRef(false);
  const extrusionFeaturesRef = useRef<GeoJSON.Feature[]>([]);

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

    // Disable follow on user drag
    map.on("dragstart", () => {
      followRef.current = false;
      setFollowing(false);
    });

    map.on("load", () => {
      const extrusionFeatures: GeoJSON.Feature[] = [];
      const shadowCoords: [number, number][] = [];

      for (let i = 0; i < renderPoints.length - 1; i++) {
        const p1 = renderPoints[i];
        const p2 = renderPoints[i + 1];
        const avgAlt = (p1.altitude + p2.altitude) / 2;
        const baseline = (calcBaseline(renderPoints, i) + calcBaseline(renderPoints, i + 1)) / 2;
        const relHeight = Math.max(0, avgAlt - baseline);

        extrusionFeatures.push({
          type: "Feature",
          properties: {
            color: getColor(avgAlt, minAlt, maxAlt),
            height: relHeight,
            base: Math.max(0, relHeight - 8),
          },
          geometry: {
            type: "Polygon",
            coordinates: [segmentToPolygon(p1, p2, 0.00025)],
          },
        });

        if (i === 0) shadowCoords.push([p1.lng, p1.lat]);
        shadowCoords.push([p2.lng, p2.lat]);
      }

      // Shadow line on ground
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

      // Main 3D track ribbon
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

      // Store features for progressive rendering
      extrusionFeaturesRef.current = extrusionFeatures;

      // Progressive track source/layer (used during animation)
      map.addSource("track-progress", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "track-progress-3d",
        type: "fill-extrusion",
        source: "track-progress",
        paint: {
          "fill-extrusion-color": ["get", "color"],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "base"],
          "fill-extrusion-opacity": 0.92,
        },
      });

      // Animated drop-surface (blue curtain with fade)
      map.addSource("track-animated", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "track-animated-3d",
        type: "fill-extrusion",
        source: "track-animated",
        paint: {
          "fill-extrusion-color": ["get", "color"],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.9,
        },
      });

      // Animated position marker on flight line
      map.addSource("track-pos-marker", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "track-pos-marker-3d",
        type: "fill-extrusion",
        source: "track-pos-marker",
        paint: {
          "fill-extrusion-color": "#ffffff",
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "base"],
          "fill-extrusion-opacity": 1,
        },
      });

      // Start/Landing markers
      new maplibregl.Marker({ color: "#22c55e" })
        .setLngLat([renderPoints[0].lng, renderPoints[0].lat])
        .setPopup(new maplibregl.Popup().setText("Start"))
        .addTo(map);

      new maplibregl.Marker({ color: "#ef4444" })
        .setLngLat([renderPoints[renderPoints.length - 1].lng, renderPoints[renderPoints.length - 1].lat])
        .setPopup(new maplibregl.Popup().setText("Landing"))
        .addTo(map);

      const bounds = new maplibregl.LngLatBounds([minLng, minLat], [maxLng, maxLat]);
      map.fitBounds(bounds, { padding: 60, pitch: 60, duration: 1000 });

      // Highlight marker (for altitude profile hover)
      const marker = new maplibregl.Marker({ color: "#fff", scale: 0.6 })
        .setLngLat(center)
        .addTo(map);
      marker.getElement().style.display = "none";
      markerRef.current = marker;

      // Ground shadow marker for animation (subtle)
      animMarkerRef.current = null;

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
      followRef.current = false;
      setFollowing(false);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [renderPoints]);

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

  const animate = useCallback(() => {
    if (!playingRef.current || !mapRef.current) return;

    progressRef.current += speedRef.current;
    if (progressRef.current >= 1) {
      progressRef.current = 1;
      playingRef.current = false;
      setPlaying(false);
      setAnimProgress(1);
      // Show full track, hide progress
      mapRef.current.setLayoutProperty("track-3d", "visibility", "visible");
      const progSource = mapRef.current.getSource("track-progress") as maplibregl.GeoJSONSource;
      if (progSource) progSource.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    frameCountRef.current++;
    if (frameCountRef.current % 10 === 0) {
      setAnimProgress(progressRef.current);
    }

    const idx = Math.floor(progressRef.current * (renderPoints.length - 1));
    const p = renderPoints[Math.min(idx, renderPoints.length - 1)];
    const baseline = calcBaseline(renderPoints, Math.min(idx, renderPoints.length - 1));

    // Ground marker removed — drop surface is sufficient

    // Update position marker on flight line (white prominent dot)
    const posSource = mapRef.current.getSource("track-pos-marker") as maplibregl.GeoJSONSource;
    if (posSource) {
      const relH = Math.max(0, p.altitude - baseline);
      posSource.setData({
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          properties: { height: relH + 5, base: Math.max(0, relH - 5) },
          geometry: { type: "Polygon", coordinates: [pointToPolygon(p, 0.0003)] },
        }],
      });
    }

    // Update dynamic drop-surface with fade
    const source = mapRef.current.getSource("track-animated") as maplibregl.GeoJSONSource;
    if (source) {
      const features: GeoJSON.Feature[] = [];
      const startIdx = Math.max(0, idx - TRAIL_LENGTH);

      for (let i = startIdx; i <= Math.min(idx, renderPoints.length - 2); i++) {
        const p1 = renderPoints[i];
        const p2 = renderPoints[i + 1];
        const avgAlt = (p1.altitude + p2.altitude) / 2;
        const bl = (calcBaseline(renderPoints, i) + calcBaseline(renderPoints, i + 1)) / 2;
        const relHeight = Math.max(0, avgAlt - bl);
        const age = idx - i;
        const alpha = Math.max(0, 0.25 * (1 - age / TRAIL_LENGTH));

        features.push({
          type: "Feature",
          properties: {
            height: relHeight,
            color: `rgba(135, 206, 250, ${alpha.toFixed(2)})`,
          },
          geometry: {
            type: "Polygon",
            coordinates: [segmentToPolygon(p1, p2, 0.00025)],
          },
        });
      }
      source.setData({ type: "FeatureCollection", features });
    }

    // Progressive track build-up
    const progSource = mapRef.current.getSource("track-progress") as maplibregl.GeoJSONSource;
    if (progSource && extrusionFeaturesRef.current.length > 0) {
      progSource.setData({
        type: "FeatureCollection",
        features: extrusionFeaturesRef.current.slice(0, Math.min(idx, extrusionFeaturesRef.current.length)),
      });
    }

    // Follow mode: smooth camera tracking every ~20 frames
    if (followRef.current && frameCountRef.current % 20 === 0) {
      mapRef.current.easeTo({
        center: [p.lng, p.lat],
        duration: 300,
      });
    }

    animFrameRef.current = requestAnimationFrame(animate);
  }, [renderPoints]);

  const handlePlay = useCallback(() => {
    if (playing) {
      playingRef.current = false;
      setPlaying(false);
      return;
    }
    if (progressRef.current >= 1) {
      progressRef.current = 0;
      setAnimProgress(0);
      const source = mapRef.current?.getSource("track-animated") as maplibregl.GeoJSONSource;
      if (source) source.setData({ type: "FeatureCollection", features: [] });
      const posSource = mapRef.current?.getSource("track-pos-marker") as maplibregl.GeoJSONSource;
      if (posSource) posSource.setData({ type: "FeatureCollection", features: [] });
      const progSource = mapRef.current?.getSource("track-progress") as maplibregl.GeoJSONSource;
      if (progSource) progSource.setData({ type: "FeatureCollection", features: [] });
    }
    // Hide full track, show progressive
    mapRef.current?.setLayoutProperty("track-3d", "visibility", "none");
    playingRef.current = true;
    setPlaying(true);
    animFrameRef.current = requestAnimationFrame(animate);
  }, [playing, animate]);

  const handleReset = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    progressRef.current = 0;
    setAnimProgress(0);
    const source = mapRef.current?.getSource("track-animated") as maplibregl.GeoJSONSource;
    if (source) source.setData({ type: "FeatureCollection", features: [] });
    const posSource = mapRef.current?.getSource("track-pos-marker") as maplibregl.GeoJSONSource;
    if (posSource) posSource.setData({ type: "FeatureCollection", features: [] });
    const progSource = mapRef.current?.getSource("track-progress") as maplibregl.GeoJSONSource;
    if (progSource) progSource.setData({ type: "FeatureCollection", features: [] });
    // Show full track again
    mapRef.current?.setLayoutProperty("track-3d", "visibility", "visible");
  }, []);

  const handleSpeed = useCallback(() => {
    setSpeedIdx(prev => {
      const next = (prev + 1) % SPEED_STEPS.length;
      speedRef.current = SPEED_STEPS[next].value;
      return next;
    });
  }, []);

  const handleFollow = useCallback(() => {
    setFollowing(prev => {
      followRef.current = !prev;
      return !prev;
    });
  }, []);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="w-full rounded-xl overflow-hidden border border-border"
        style={{ height: "55vh", minHeight: 300 }}
      />

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
          <Button
            variant="ghost"
            className="h-8 px-2 text-xs font-mono min-w-[36px]"
            onClick={handleSpeed}
          >
            {SPEED_STEPS[speedIdx].label}
          </Button>
          <Button
            size="icon"
            variant={following ? "default" : "ghost"}
            className="h-8 w-8"
            onClick={handleFollow}
          >
            <Crosshair className="h-4 w-4" />
          </Button>
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
