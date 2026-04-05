import { useEffect, useState, useRef, lazy, Suspense } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ArrowLeft, Edit, Trash2, Youtube, MapPin, Upload, Copy, Plus, X, Share2, CheckCircle, Mountain } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { parseIGC } from "@/lib/igc-parser";
import { compressImage } from "@/lib/image-compress";
import FlightDetailMap from "@/components/FlightDetailMap";
import PublishPreviewDialog from "@/components/PublishPreviewDialog";
import CoachFeedback from "@/components/CoachFeedback";

const Flight3DMap = lazy(() => import("@/components/Flight3DMap"));
const FlightAltitudeProfile = lazy(() => import("@/components/FlightAltitudeProfile"));

export default function FlightDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const [flight, setFlight] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [videos, setVideos] = useState<any[]>([]);
  const [track, setTrack] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [trainedManeuvers, setTrainedManeuvers] = useState<string[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [publishedToFeed, setPublishedToFeed] = useState(false);
  const [showPublishPreview, setShowPublishPreview] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [pilotProfile, setPilotProfile] = useState<{ pilot_name: string; avatar_url: string }>({ pilot_name: "", avatar_url: "" });
  const [show3D, setShow3D] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [animIdx, setAnimIdx] = useState<number | null>(null);
  const igcInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";

  const loadPhotos = async () => {
    if (!id) return;
    const { data } = await supabase.from("flight_photos").select("*").eq("flight_id", id);
    const photoList = data || [];
    setPhotos(photoList);
    // Create signed URLs for all photos
    const urls: Record<string, string> = {};
    for (const p of photoList) {
      const { data: signedData } = await supabase.storage.from("flight-photos").createSignedUrl(p.storage_path, 3600);
      if (signedData?.signedUrl) urls[p.id] = signedData.signedUrl;
    }
    setPhotoUrls(urls);
  };

  useEffect(() => {
    if (!id) return;
    supabase.from("flights").select("*, takeoff:locations!flights_takeoff_location_id_fkey(name, latitude, longitude), landing:locations!flights_landing_location_id_fkey(name, latitude, longitude)").eq("id", id).single().then(({ data }) => {
      setFlight(data);
      if (data) {
        setPublishedToFeed((data as any).published_to_feed || false);
        if ((data as any).group_id) {
          supabase.from("groups").select("name").eq("id", (data as any).group_id).single().then(({ data: g }) => { if (g) setGroupName(g.name); });
        }
      }
    });
    loadPhotos();
    supabase.from("flight_videos").select("*").eq("flight_id", id).then(({ data }) => setVideos(data || []));
    supabase.from("igc_tracks").select("*").eq("flight_id", id).maybeSingle().then(({ data }) => setTrack(data));
    supabase.from("flight_training_items" as any).select("item_id, training_items(name)").eq("flight_id", id).then(({ data }) => {
      if (data) setTrainedManeuvers((data as any[]).map((d: any) => d.training_items?.name).filter(Boolean));
    });
    // Load pilot profile
    if (user) {
      supabase.from("profiles").select("pilot_name, avatar_url").eq("user_id", user.id).single().then(async ({ data: prof }) => {
        if (prof) {
          let avatarUrl = prof.avatar_url || "";
          if (avatarUrl && !avatarUrl.startsWith("http")) {
            const { data: signed } = await supabase.storage.from("flight-photos").createSignedUrl(avatarUrl, 3600);
            if (signed?.signedUrl) avatarUrl = signed.signedUrl;
          }
          setPilotProfile({ pilot_name: prof.pilot_name || "", avatar_url: avatarUrl });
        }
      });
    }
  }, [id]);

  const handleDelete = async () => { if (!confirm(t("flights.deleteFlight"))) return; await supabase.from("flights").delete().eq("id", id); toast({ title: t("flights.flightDeleted") }); navigate("/flights"); };

  const handleDuplicate = async () => {
    if (!user || !flight) return;
    try {
      const { data, error } = await supabase.from("flights").insert({
        user_id: user.id, date: flight.date, takeoff_location_id: flight.takeoff_location_id || null,
        landing_location_id: flight.landing_location_id || null, duration_minutes: flight.duration_minutes,
        altitude_gain: flight.altitude_gain, distance_km: flight.distance_km, thermals: flight.thermals,
        wind_speed: flight.wind_speed, wind_direction: flight.wind_direction, glider: flight.glider, comments: flight.comments,
        group_id: (flight as any).group_id || null, is_solo_shv: (flight as any).is_solo_shv || false,
      } as any).select("id").single();
      if (error) throw error;
      if (trainedManeuvers.length > 0) {
        const { data: items } = await supabase.from("flight_training_items" as any).select("item_id").eq("flight_id", id);
        if (items && items.length > 0) {
          await supabase.from("flight_training_items" as any).insert((items as any[]).map((i: any) => ({ flight_id: data.id, item_id: i.item_id })) as any);
        }
      }
      toast({ title: t("flights.flightDuplicated") });
      navigate(`/flights/${data.id}`);
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
  };

  const handleIGCUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !user || !id) return; setUploading(true);
    try {
      const content = await file.text(); const parsed = parseIGC(content);
      const path = `${user.id}/${id}/${file.name}`;
      const { error: storageErr } = await supabase.storage.from("igc-files").upload(path, file, { upsert: true }); if (storageErr) throw storageErr;
      const limitedPoints = parsed.points.filter((_, i) => i % Math.max(1, Math.floor(parsed.points.length / 2000)) === 0);
      if (track) await supabase.from("igc_tracks").delete().eq("id", track.id);
      const igcStats = { maxAltitude: parsed.maxAltitude, minAltitude: parsed.minAltitude, maxClimbRate: parsed.maxClimbRate, maxSinkRate: parsed.maxSinkRate, avgSpeedKmh: parsed.avgSpeedKmh, totalDistanceKm: parsed.totalDistanceKm, startTime: parsed.startTime, endTime: parsed.endTime, durationMinutes: parsed.durationMinutes };
      const { data: newTrack, error: trackErr } = await supabase.from("igc_tracks").insert({ flight_id: id, storage_path: path, track_data: { points: limitedPoints, stats: igcStats } as any }).select().single();
      if (trackErr) throw trackErr;
      setTrack(newTrack);
      toast({ title: t("flights.igcUploaded"), description: `${parsed.points.length} ${t("flights.igcPointsLoaded")}` });
    } catch (err: any) { toast({ title: t("flights.igcUploadFailed"), description: err.message, variant: "destructive" }); }
    finally { setUploading(false); if (igcInputRef.current) igcInputRef.current.value = ""; }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files || !user || !id) return;
    setUploadingPhoto(true);
    try {
      for (const photo of Array.from(files)) {
        const compressed = await compressImage(photo, 1600, 1600, 0.8);
        const path = `${user.id}/${id}/${Date.now()}-${compressed.name}`;
        const { error: storageErr } = await supabase.storage.from("flight-photos").upload(path, compressed);
        if (storageErr) throw storageErr;
        const { error: insertErr } = await supabase.from("flight_photos").insert({ flight_id: id, storage_path: path });
        if (insertErr) throw insertErr;
      }
      toast({ title: t("flights.photoAdded") });
      loadPhotos();
    } catch (err: any) { toast({ title: t("flights.photoUploadFailed"), description: err.message, variant: "destructive" }); }
    finally { setUploadingPhoto(false); if (photoInputRef.current) photoInputRef.current.value = ""; }
  };

  const handleDeletePhoto = async (photoId: string, storagePath: string) => {
    if (!confirm(t("flights.deletePhoto"))) return;
    await supabase.storage.from("flight-photos").remove([storagePath]);
    await supabase.from("flight_photos").delete().eq("id", photoId);
    toast({ title: t("flights.photoDeleted") });
    loadPhotos();
  };

  if (!flight) return <div className="p-4 text-center text-muted-foreground">{t("common.loading")}</div>;
  const formatDuration = (min: number) => { const h = Math.floor(min / 60); const m = min % 60; return h > 0 ? `${h}h ${m}m` : `${m} min`; };
  const getYoutubeEmbedUrl = (url: string) => { const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/); return match ? `https://www.youtube.com/embed/${match[1]}` : null; };

  return (
    <div className="px-4 pt-4 pb-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/flights")}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">{flight.takeoff?.name || t("flights.flight")}</h1>
              {(flight as any).is_solo_shv && <Badge variant="default" className="text-[10px] px-1.5 py-0">SHV Solo</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">{new Date(flight.date).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/flights/${id}/edit`)}><Edit className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={handleDuplicate}><Copy className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={handleDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      </div>
      {(flight.takeoff || flight.landing) && (
        <Card className="border-0 shadow-sm"><CardContent className="p-4 flex items-center gap-3"><MapPin className="h-5 w-5 text-secondary shrink-0" /><div className="text-sm"><span className="font-medium">{flight.takeoff?.name || "–"}</span><span className="text-muted-foreground mx-2">→</span><span className="font-medium">{flight.landing?.name || "–"}</span></div></CardContent></Card>
      )}
      {/* Map with 3D toggle */}
      {track?.track_data && (track.track_data as any).points?.length > 1 && (
        <div className="flex gap-1 justify-end">
          <Button variant={show3D ? "outline" : "default"} size="sm" className="h-7 text-xs" onClick={() => setShow3D(false)}>2D</Button>
          <Button variant={show3D ? "default" : "outline"} size="sm" className="h-7 text-xs gap-1" onClick={() => setShow3D(true)}>
            <Mountain className="h-3.5 w-3.5" /> 3D
          </Button>
        </div>
      )}
      {show3D && track?.track_data ? (
        <Suspense fallback={<div className="h-[55vh] rounded-xl border border-border bg-muted animate-pulse" />}>
          <Flight3DMap
            points={((track.track_data as any).points || []).map((p: any) => ({ lat: p.lat, lng: p.lng, altitude: p.altitude || 0, time: p.time || "" }))}
            highlightIndex={hoverIdx}
          />
          <FlightAltitudeProfile
            points={((track.track_data as any).points || []).map((p: any) => ({ lat: p.lat, lng: p.lng, altitude: p.altitude || 0, time: p.time || "" }))}
            onHoverIndex={setHoverIdx}
          />
        </Suspense>
      ) : (
        <FlightDetailMap takeoff={flight.takeoff ? { name: flight.takeoff.name, latitude: flight.takeoff.latitude, longitude: flight.takeoff.longitude } : null} landing={flight.landing ? { name: flight.landing.name, latitude: flight.landing.latitude, longitude: flight.landing.longitude } : null} trackPoints={track?.track_data ? ((track.track_data as any).points || []).map((p: any) => [p.lat, p.lng] as [number, number]) : []} />
      )}
      <div className="grid grid-cols-2 gap-3">
        {(() => {
          const igcStats = (track?.track_data as any)?.stats;
          const items = [
            { label: t("flights.flightTime"), value: flight.duration_minutes ? formatDuration(flight.duration_minutes) : igcStats?.durationMinutes ? formatDuration(igcStats.durationMinutes) : "–" },
            { label: t("flights.altitude"), value: flight.altitude_gain ? `+${flight.altitude_gain} m` : "–" },
            { label: t("flights.distanceLabel"), value: flight.distance_km ? `${Number(flight.distance_km).toFixed(1)} km` : igcStats?.totalDistanceKm ? `${igcStats.totalDistanceKm} km` : "–" },
            { label: t("flights.gliderLabel"), value: flight.glider || "–" },
            { label: t("flights.thermalsLabel"), value: flight.thermals || "–" },
            { label: t("flights.windLabel"), value: flight.wind_speed ? `${flight.wind_speed} km/h ${flight.wind_direction || ""}` : "–" },
          ];
          if (igcStats) {
            items.push(
              { label: t("flights.maxAltitude"), value: `${igcStats.maxAltitude} m` },
              { label: t("flights.maxClimb"), value: `${igcStats.maxClimbRate} m/s` },
              { label: t("flights.avgSpeed"), value: `${igcStats.avgSpeedKmh} km/h` },
              { label: t("flights.startTimeLabel"), value: igcStats.startTime || "–" },
            );
          }
          return items.map(({ label, value }) => (
            <Card key={label} className="border-0 shadow-sm"><CardContent className="p-3"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p><p className="text-sm font-medium mt-0.5">{value}</p></CardContent></Card>
          ));
        })()}
      </div>
      {flight.comments && (<Card className="border-0 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm">{t("flights.comments")}</CardTitle></CardHeader><CardContent className="pt-0"><p className="text-sm text-muted-foreground">{flight.comments}</p></CardContent></Card>)}
      {groupName && (<Card className="border-0 shadow-sm"><CardContent className="p-3"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("flights.group")}</p><p className="text-sm font-medium mt-0.5">{groupName}</p></CardContent></Card>)}
      {trainedManeuvers.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("flights_training.trainedManeuvers")}</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-1.5">
              {trainedManeuvers.map((name) => (
                <Badge key={name} variant="secondary">{name}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {/* Coach/Instructor Feedback */}
      <CoachFeedback flightId={id!} flightUserId={flight.user_id} groupId={(flight as any).group_id || null} />
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">{t("flights.photos")}</CardTitle>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}>
            <Plus className="h-3.5 w-3.5" /> {t("flights.addPhotos2")}
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {photos.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p) => {
                const url = photoUrls[p.id];
                if (!url) return null;
                return (
                  <div key={p.id} className="relative group">
                    <img src={url} alt="" className="rounded-lg aspect-square object-cover cursor-pointer active:scale-[0.97] transition-transform" onClick={() => setLightboxUrl(url)} />
                    <button
                      onClick={() => handleDeletePhoto(p.id, p.storage_path)}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t("common.none")}</p>
          )}
        </CardContent>
      </Card>
      <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-0 bg-transparent shadow-none [&>button]:text-white [&>button]:bg-black/50 [&>button]:rounded-full [&>button]:p-1">{lightboxUrl && <img src={lightboxUrl} alt="" className="w-full h-auto max-h-[90vh] object-contain rounded-lg" />}</DialogContent>
      </Dialog>
      {videos.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("flights.videos")}</CardTitle></CardHeader>
          <CardContent className="pt-0 space-y-3">
            {videos.map((v) => {
              const embedUrl = getYoutubeEmbedUrl(v.youtube_url);
              return embedUrl ? (
                <div key={v.id} className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
                  <iframe
                    src={embedUrl}
                    title="YouTube video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                </div>
              ) : (
                <a key={v.id} href={v.youtube_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <Youtube className="h-4 w-4" /> {t("flights.watchVideo")}
                </a>
              );
            })}
          </CardContent>
        </Card>
      )}
      <input ref={igcInputRef} type="file" accept=".igc" className="hidden" onChange={handleIGCUpload} />
      <Button variant="outline" className="w-full gap-2" onClick={() => igcInputRef.current?.click()} disabled={uploading}>
        <Upload className="h-4 w-4" />{uploading ? t("flights.uploading") : track ? t("flights.igcReplace") : t("flights.igcAttach")}
      </Button>
      {/* Publish to Feed */}
      {flight.user_id === user?.id && (flight as any).group_id && (
        publishedToFeed ? (
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={async () => {
              await supabase.from("flights").update({ published_to_feed: false } as any).eq("id", id);
              setPublishedToFeed(false);
              toast({ title: t("flights.unpublishedFromFeed") });
            }}
          >
            <CheckCircle className="h-4 w-4" />
            {t("flights.unpublishFromFeed")}
          </Button>
        ) : (
          <Button className="w-full gap-2" onClick={() => setShowPublishPreview(true)}>
            <Share2 className="h-4 w-4" />
            {t("flights.publishToFeed")}
          </Button>
        )
      )}

      {/* Publish Preview Dialog */}
      <PublishPreviewDialog
        open={showPublishPreview}
        onOpenChange={setShowPublishPreview}
        flight={{
          date: flight.date,
          glider: flight.glider,
          duration_minutes: flight.duration_minutes,
          altitude_gain: flight.altitude_gain,
          distance_km: flight.distance_km,
          comments: flight.comments,
          takeoff: flight.takeoff ? { name: flight.takeoff.name, latitude: flight.takeoff.latitude, longitude: flight.takeoff.longitude } : null,
          landing: flight.landing ? { name: flight.landing.name, latitude: flight.landing.latitude, longitude: flight.landing.longitude } : null,
        }}
        pilotName={pilotProfile.pilot_name}
        avatarUrl={pilotProfile.avatar_url}
        groupName={groupName || ""}
        photos={photos.map(p => ({ id: p.id, url: photoUrls[p.id] || "" })).filter(p => p.url)}
        videoUrls={videos.map(v => v.youtube_url)}
        trackPoints={track?.track_data ? ((track.track_data as any).points || []).map((p: any) => [p.lat, p.lng] as [number, number]) : []}
        loading={publishLoading}
        onPublish={async (selectedPhotoIds, feedComment) => {
          setPublishLoading(true);
          try {
            const publishUpdate: any = {
              published_to_feed: true,
              published_at: new Date().toISOString(),
              feed_photo_ids: selectedPhotoIds,
            };
            if (feedComment !== flight.comments) {
              publishUpdate.comments = feedComment;
              setFlight({ ...flight, comments: feedComment });
            }
            await supabase.from("flights").update(publishUpdate).eq("id", id);
            setPublishedToFeed(true);
            setShowPublishPreview(false);
            toast({ title: t("flights.publishedToFeed") });
          } catch (err: any) {
            toast({ title: t("common.error"), description: err.message, variant: "destructive" });
          } finally {
            setPublishLoading(false);
          }
        }}
      />
    </div>
  );
}
