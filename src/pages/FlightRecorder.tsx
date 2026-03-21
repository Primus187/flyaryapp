import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from "react-leaflet";
import { Button } from "@/components/ui/button";
import { Play, Square, Pause, Volume2, VolumeX, ArrowLeft } from "lucide-react";
import { VarioAudio } from "@/lib/vario-audio";
import { BarometerService } from "@/lib/barometer";
import { generateIGC, type RecordedPoint } from "@/lib/igc-writer";
import "leaflet/dist/leaflet.css";

// ---- helpers ----
function smoothedVario(altitudes: number[], timestamps: number[], windowSize = 5): number {
  if (altitudes.length < 2) return 0;
  const n = Math.min(windowSize, altitudes.length);
  const recentAlt = altitudes.slice(-n);
  const recentTime = timestamps.slice(-n);
  const dt = (recentTime[recentTime.length - 1] - recentTime[0]) / 1000;
  if (dt <= 0) return 0;
  const dAlt = recentAlt[recentAlt.length - 1] - recentAlt[0];
  return dAlt / dt;
}

function formatTime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ---- map follower component ----
function MapFollower({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, map.getZoom());
  }, [position, map]);
  return null;
}

// All map children rendered directly inside MapContainer (no wrapper component)
// to avoid react-leaflet context consumer issues with React 18

type RecordingState = "idle" | "recording" | "paused" | "done";

export default function FlightRecorder() {
  const navigate = useNavigate();
  const [state, setState] = useState<RecordingState>("idle");
  const [points, setPoints] = useState<RecordedPoint[]>([]);
  const [currentPos, setCurrentPos] = useState<[number, number] | null>(null);
  const [vario, setVario] = useState(0);
  const [altitude, setAltitude] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [maxAlt, setMaxAlt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [altSource, setAltSource] = useState<'gps' | 'barometer'>('gps');

  const varioAudio = useRef<VarioAudio | null>(null);
  const barometerService = useRef<BarometerService | null>(null);
  const watchId = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const altitudesRef = useRef<number[]>([]);
  const timestampsRef = useRef<number[]>([]);
  const pointsRef = useRef<RecordedPoint[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      if (timerRef.current) clearInterval(timerRef.current);
      varioAudio.current?.destroy();
    };
  }, []);

  const handleGPSPosition = useCallback((pos: GeolocationPosition) => {
    const { latitude, longitude, altitude: alt, speed: spd } = pos.coords;
    const now = Date.now();
    const gpsAlt = alt ?? 0;

    setCurrentPos([latitude, longitude]);
    setAltitude(Math.round(gpsAlt));
    if (spd !== null && spd >= 0) setSpeed(Math.round(spd * 3.6)); // m/s → km/h

    altitudesRef.current.push(gpsAlt);
    timestampsRef.current.push(now);
    if (altitudesRef.current.length > 20) {
      altitudesRef.current = altitudesRef.current.slice(-20);
      timestampsRef.current = timestampsRef.current.slice(-20);
    }

    const v = smoothedVario(altitudesRef.current, timestampsRef.current);
    setVario(v);
    varioAudio.current?.update(v);

    if (gpsAlt > maxAlt) setMaxAlt(Math.round(gpsAlt));

    const point: RecordedPoint = { lat: latitude, lng: longitude, altitude: gpsAlt, timestamp: now };
    pointsRef.current = [...pointsRef.current, point];
    setPoints([...pointsRef.current]);
  }, [maxAlt]);

  const startRecording = async () => {
    // Init audio (needs user gesture)
    if (!varioAudio.current) {
      varioAudio.current = new VarioAudio();
    }
    await varioAudio.current.init();

    pointsRef.current = [];
    altitudesRef.current = [];
    timestampsRef.current = [];
    setPoints([]);
    setMaxAlt(0);
    setElapsed(0);
    setGpsError(null);
    startTimeRef.current = Date.now();

    watchId.current = navigator.geolocation.watchPosition(
      handleGPSPosition,
      (err) => setGpsError(err.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    setState("recording");
  };

  const pauseRecording = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    varioAudio.current?.update(0);
    setState("paused");
  };

  const resumeRecording = () => {
    startTimeRef.current = Date.now() - elapsed * 1000;
    watchId.current = navigator.geolocation.watchPosition(
      handleGPSPosition,
      (err) => setGpsError(err.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    setState("recording");
  };

  const stopRecording = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    varioAudio.current?.destroy();
    varioAudio.current = null;
    setState("done");
  };

  const toggleAudio = () => {
    varioAudio.current?.toggle();
    setAudioEnabled((p) => !p);
  };

  const saveAndContinue = () => {
    const igcContent = generateIGC(pointsRef.current);
    const blob = new Blob([igcContent], { type: "application/octet-stream" });
    const file = new File([blob], `flight-${new Date().toISOString().slice(0, 10)}.igc`, { type: "application/octet-stream" });

    // Navigate to FlightForm with the generated IGC data via state
    navigate("/flights/new", {
      state: {
        igcFile: file,
        igcContent,
        recordedPoints: pointsRef.current,
      },
    });
  };

  const trackPositions = points.map((p) => [p.lat, p.lng] as [number, number]);
  const varioColor = vario >= 0.2 ? "text-emerald-400" : vario <= -1.5 ? "text-red-400" : "text-muted-foreground";
  const defaultCenter: [number, number] = currentPos || [46.8, 8.2]; // Switzerland fallback

  return (
    <div className="relative h-screen w-full">
      {/* Map */}
      <MapContainer center={defaultCenter} zoom={14} className="h-full w-full z-0" zoomControl={false}>
        <TileLayer url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" attribution="OpenTopoMap" maxZoom={17} />
        <MapFollower position={currentPos} />
        {trackPositions.length > 1 && (
          <Polyline positions={trackPositions} pathOptions={{ color: "#3b82f6", weight: 3 }} />
        )}
        {currentPos && (
          <CircleMarker center={currentPos} radius={8} pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 1, weight: 2 }} />
        )}
      </MapContainer>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-[1000] safe-area-top">
        <div className="flex items-center justify-between px-3 pt-3">
          <Button variant="ghost" size="icon" className="bg-background/80 backdrop-blur-sm rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="bg-background/80 backdrop-blur-sm rounded-full px-3 py-1.5 text-sm font-mono font-bold">
            {formatTime(elapsed)}
          </div>
          <Button variant="ghost" size="icon" className="bg-background/80 backdrop-blur-sm rounded-full" onClick={toggleAudio}>
            {audioEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* HUD overlay */}
      <div className="absolute bottom-24 left-0 right-0 z-[1000] px-3">
        <div className="bg-background/85 backdrop-blur-md rounded-2xl p-4 space-y-3">
          {gpsError && (
            <p className="text-xs text-destructive text-center">{gpsError}</p>
          )}

          {/* Vario display */}
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Vario</p>
              <p className={`text-3xl font-mono font-bold ${varioColor}`}>
                {vario >= 0 ? "+" : ""}{vario.toFixed(1)}
              </p>
              <p className="text-[10px] text-muted-foreground">m/s</p>
            </div>
            <div className="h-12 w-px bg-border" />
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Höhe</p>
              <p className="text-2xl font-mono font-bold">{altitude}</p>
              <p className="text-[10px] text-muted-foreground">m</p>
            </div>
            <div className="h-12 w-px bg-border" />
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Speed</p>
              <p className="text-2xl font-mono font-bold">{speed}</p>
              <p className="text-[10px] text-muted-foreground">km/h</p>
            </div>
          </div>

          {/* Secondary stats */}
          <div className="flex justify-around text-center text-xs text-muted-foreground">
            <div>
              <p className="font-medium text-foreground">{maxAlt} m</p>
              <p>Max Höhe</p>
            </div>
            <div>
              <p className="font-medium text-foreground">{points.length}</p>
              <p>Punkte</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            {state === "idle" && (
              <Button onClick={startRecording} size="lg" className="rounded-full px-8 gap-2">
                <Play className="h-5 w-5" /> Aufzeichnung starten
              </Button>
            )}
            {state === "recording" && (
              <>
                <Button onClick={pauseRecording} variant="outline" size="icon" className="rounded-full h-12 w-12">
                  <Pause className="h-5 w-5" />
                </Button>
                <Button onClick={stopRecording} variant="destructive" size="icon" className="rounded-full h-14 w-14">
                  <Square className="h-6 w-6" />
                </Button>
              </>
            )}
            {state === "paused" && (
              <>
                <Button onClick={resumeRecording} size="icon" className="rounded-full h-12 w-12">
                  <Play className="h-5 w-5" />
                </Button>
                <Button onClick={stopRecording} variant="destructive" size="icon" className="rounded-full h-14 w-14">
                  <Square className="h-6 w-6" />
                </Button>
              </>
            )}
            {state === "done" && (
              <div className="flex gap-3 w-full">
                <Button variant="outline" className="flex-1" onClick={() => setState("idle")}>
                  Verwerfen
                </Button>
                <Button className="flex-1" onClick={saveAndContinue}>
                  Flug speichern
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
