import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LocationCombobox from "@/components/LocationCombobox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { parseIGC, type IGCData } from "@/lib/igc-parser";
import { uploadIgcTrack } from "@/lib/igc-upload";
import { ArrowLeft, Upload, Plus, X, Youtube, Check, Save, FileText, Video, Film } from "lucide-react";
import { validateVideo, extractPoster, getVideoDuration, MAX_VIDEO_SECONDS, MAX_VIDEO_BYTES } from "@/lib/video-utils";
import { compressVideo, isVideoCompressionSupported } from "@/lib/video-compress";
import VideoTrimDialog from "@/components/VideoTrimDialog";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import TagsInput from "@/components/TagsInput";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SchoolFlightImportCard from "@/components/SchoolFlightImportCard";
import { cn } from "@/lib/utils";

const DRAFT_KEY = "flyary.flightDraft";
// Older drafts are dropped: restoring them silently backdated new flights to the draft day.
const DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

interface LocationOption { id: string; name: string; type: string; altitude?: number | null; }
interface GliderOption { id: string; manufacturer: string; model: string; size: string | null; is_default: boolean; }
interface TrainingItem { id: string; name: string; category_name: string; }
interface GroupOption { id: string; name: string; }
interface FlightTemplate { id: string; name: string; takeoff_location_id: string | null; landing_location_id: string | null; glider: string | null; group_id: string | null; }

export default function FlightForm() {
  const { id } = useParams();
  const locationState = useLocation().state as any;
  const isEdit = !!id;
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [gliders, setGliders] = useState<GliderOption[]>([]);
  const [igcData, setIgcData] = useState<IGCData | null>(null);
  const [igcFile, setIgcFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [youtubeUrls, setYoutubeUrls] = useState<string[]>([]);
  const [newYoutubeUrl, setNewYoutubeUrl] = useState("");
  const [pendingVideos, setPendingVideos] = useState<{ file: File; poster: Blob; durationSec: number; previewUrl: string }[]>([]);
  const [existingUploadedVideos, setExistingUploadedVideos] = useState<{ id: string; storage_path: string; poster_path: string | null }[]>([]);
  const [videoProcessing, setVideoProcessing] = useState(false);
  const [trimSource, setTrimSource] = useState<File | null>(null);
  const videoLibraryInputRef = useRef<HTMLInputElement | null>(null);
  const videoCameraInputRef = useRef<HTMLInputElement | null>(null);
  const [trainingItems, setTrainingItems] = useState<TrainingItem[]>([]);
  const [selectedTrainingIds, setSelectedTrainingIds] = useState<string[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [templates, setTemplates] = useState<FlightTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [step, setStep] = useState(1);
  const [draftRestored, setDraftRestored] = useState(false);
  // Only persist a draft once the pilot actually typed/tapped something in the form.
  const userEditedRef = useRef(false);

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0], takeoff_location_id: "", landing_location_id: "",
    duration_minutes: "", altitude_gain: "", distance_km: "", thermals: "", wind_speed: "",
    wind_direction: "", glider: "", comments: "", group_id: "", is_solo_shv: false,
  });

  useEffect(() => {
    if (!user) return;
    supabase.from("locations").select("id, name, type, altitude").eq("user_id", user.id).order("name").then(({ data }) => { if (data) setLocations(data); });
    supabase.from("training_items").select("id, name, category_id, training_categories(name)").order("sort_order").then(({ data }) => {
      if (data) setTrainingItems(data.map((item: any) => ({ id: item.id, name: item.name, category_name: item.training_categories?.name || "" })));
    });
    // Load flight templates
    supabase.from("flight_templates").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setTemplates(data as any as FlightTemplate[]);
    });
    supabase.from("group_members").select("group_id, groups(id, name)").eq("user_id", user.id).then(({ data }) => {
      if (data) setGroups(data.map((gm: any) => ({ id: gm.groups.id, name: gm.groups.name })));
    });
    supabase.from("pilot_gliders").select("id, manufacturer, model, size, is_default").eq("user_id", user.id).order("is_default", { ascending: false }).then(({ data }) => {
      if (data) {
        setGliders(data);
        if (!isEdit && !form.glider) {
          const def = data.find((g) => g.is_default);
          if (def) setForm((prev) => ({ ...prev, glider: `${def.manufacturer} ${def.model}${def.size ? ` (${def.size})` : ""}` }));
        }
      }
    });
    if (isEdit) {
      supabase.from("flights").select("*").eq("id", id).single().then(({ data }) => {
        if (data) {
          setForm({ date: data.date, takeoff_location_id: data.takeoff_location_id || "", landing_location_id: data.landing_location_id || "", duration_minutes: data.duration_minutes?.toString() || "", altitude_gain: data.altitude_gain?.toString() || "", distance_km: data.distance_km?.toString() || "", thermals: data.thermals || "", wind_speed: data.wind_speed?.toString() || "", wind_direction: data.wind_direction || "", glider: data.glider || "", comments: data.comments || "", group_id: (data as any).group_id || "", is_solo_shv: !!(data as any).is_solo_shv });
          if (Array.isArray((data as any).tags)) setTags((data as any).tags);
        }
      });
      supabase.from("flight_videos").select("id, youtube_url, storage_path, poster_path").eq("flight_id", id).then(({ data }) => {
        if (!data) return;
        setYoutubeUrls(data.filter((v: any) => v.youtube_url).map((v: any) => v.youtube_url));
        setExistingUploadedVideos(data.filter((v: any) => v.storage_path).map((v: any) => ({ id: v.id, storage_path: v.storage_path, poster_path: v.poster_path })));
      });
      supabase.from("flight_training_items").select("item_id").eq("flight_id", id).then(({ data }) => { if (data) setSelectedTrainingIds((data as any[]).map((d: any) => d.item_id)); });
    }
    // Load tag suggestions from user's existing flights
    supabase.from("flights").select("tags").eq("user_id", user.id).limit(200).then(({ data }) => {
      if (!data) return;
      const all = new Set<string>();
      for (const row of data as any[]) {
        if (Array.isArray(row.tags)) row.tags.forEach((t: string) => all.add(t));
      }
      setTagSuggestions([...all].sort());
    });
    if (locationState?.igcFile && locationState?.igcContent) {
      try {
        const parsed = parseIGC(locationState.igcContent);
        setIgcData(parsed); setIgcFile(locationState.igcFile);
        setForm((prev) => ({ ...prev, date: parsed.date || prev.date, duration_minutes: parsed.durationMinutes > 0 ? parsed.durationMinutes.toString() : prev.duration_minutes, altitude_gain: parsed.maxAltitude > 0 ? (parsed.maxAltitude - parsed.minAltitude).toString() : prev.altitude_gain, distance_km: parsed.xcDistanceKm > 0 ? parsed.xcDistanceKm.toString() : prev.distance_km, glider: parsed.glider || prev.glider }));
        toast({ title: t("flights.uploadRecording"), description: `${parsed.points.length} ${t("flights.igcPointsLoaded")}` });
      } catch (err) { console.error("Failed to parse recorded IGC:", err); }
    }
  }, [user, id, isEdit]);

  // Zwischenstand wiederherstellen (nur bei neuem Flug)
  useEffect(() => {
    if (isEdit || draftRestored) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      const draft = raw ? JSON.parse(raw) : null;
      const fresh = typeof draft?.savedAt === "number" && Date.now() - draft.savedAt < DRAFT_MAX_AGE_MS;
      // A recorded IGC flight brings its own data; never overlay an older draft on it.
      const importingRecording = !!(locationState?.igcFile && locationState?.igcContent);
      if (raw && (!fresh || importingRecording)) localStorage.removeItem(DRAFT_KEY);
      if (draft && fresh && !importingRecording) {
        userEditedRef.current = true;
        if (draft?.form) setForm((prev) => ({ ...prev, ...draft.form }));
        if (Array.isArray(draft?.tags)) setTags(draft.tags);
        if (Array.isArray(draft?.selectedTrainingIds)) setSelectedTrainingIds(draft.selectedTrainingIds);
        if (typeof draft?.step === "number") setStep(Math.min(3, Math.max(1, draft.step)));
        toast({ title: t("flights.draftRestored", { defaultValue: "Zwischenstand wiederhergestellt" }) });
      }
    } catch { /* ignore */ }
    setDraftRestored(true);
  }, [isEdit, draftRestored]);

  // Zwischenstand laufend speichern
  useEffect(() => {
    if (isEdit || !draftRestored || !userEditedRef.current) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, tags, selectedTrainingIds, step, savedAt: Date.now() }));
      } catch { /* ignore */ }
    }, 400);
    return () => clearTimeout(timer);
  }, [form, tags, selectedTrainingIds, step, isEdit, draftRestored]);

  const handleIGCUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; setIgcFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string; const parsed = parseIGC(content); setIgcData(parsed);
        setForm((prev) => ({ ...prev, date: parsed.date || prev.date, duration_minutes: parsed.durationMinutes > 0 ? parsed.durationMinutes.toString() : prev.duration_minutes, altitude_gain: parsed.maxAltitude > 0 ? (parsed.maxAltitude - parsed.minAltitude).toString() : prev.altitude_gain, distance_km: parsed.xcDistanceKm > 0 ? parsed.xcDistanceKm.toString() : prev.distance_km, glider: parsed.glider || prev.glider }));
        const shapeLabel = parsed.xcOptimization
          ? ({ fai_triangle: "FAI ▲", flat_triangle: "Flach ▲", free_3tp: "3-TP", free: "Frei" } as Record<string, string>)[parsed.xcOptimization.shape]
          : null;
        toast({ title: t("flights.igcImported"), description: `${parsed.points.length} ${t("flights.igcPointsLoaded")}${shapeLabel ? ` · ${shapeLabel} ${parsed.xcDistanceKm} km` : ""}` });
      } catch (err: any) { toast({ title: t("flights.igcError"), description: err.message || t("flights.igcReadError"), variant: "destructive" }); setIgcFile(null); }
    };
    reader.readAsText(file);
  };

  const addPendingVideoFromFile = async (file: File): Promise<boolean> => {
    let workingFile = file;

    // Auto-compress oversized but short videos
    if (workingFile.size > MAX_VIDEO_BYTES) {
      try {
        const dur = await getVideoDuration(workingFile);
        if (dur <= MAX_VIDEO_SECONDS + 0.5 && isVideoCompressionSupported()) {
          toast({
            title: t("flights.compressing", { defaultValue: "Komprimiere Video…" }),
            description: t("flights.compressingHint", { defaultValue: "Das kann je nach Länge einen Moment dauern." }),
          });
          try {
            const compressed = await compressVideo(workingFile, { targetBytes: Math.floor(MAX_VIDEO_BYTES * 0.95) });
            if (compressed.size > MAX_VIDEO_BYTES) {
              toast({
                title: file.name,
                description: t("flights.compressedTooLarge", { defaultValue: "Auch nach Komprimierung > 50 MB. Bitte kürzeres oder kleineres Video wählen." }),
                variant: "destructive",
              });
              return false;
            }
            workingFile = compressed;
          } catch (err: any) {
            toast({
              title: file.name,
              description: err?.message || t("flights.compressFailed", { defaultValue: "Komprimierung fehlgeschlagen. Bitte vorab kürzen oder Qualität reduzieren." }),
              variant: "destructive",
            });
            return false;
          }
        }
      } catch { /* ignore — fall through to validateVideo */ }
    }

    const validation = await validateVideo(workingFile);
    if (!validation.ok) {
      // If only the duration is the problem, offer trim
      try {
        const dur = await getVideoDuration(workingFile);
        if (workingFile.size <= MAX_VIDEO_BYTES && dur > MAX_VIDEO_SECONDS) {
          setTrimSource(workingFile);
          return false;
        }
      } catch { /* ignore */ }
      toast({ title: file.name, description: validation.error, variant: "destructive" });
      return false;
    }
    try {
      const poster = await extractPoster(workingFile);
      const previewUrl = URL.createObjectURL(poster);
      setPendingVideos((prev) => [...prev, { file: workingFile, poster, durationSec: validation.durationSec!, previewUrl }]);
      return true;
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message || "Vorschaubild fehlgeschlagen", variant: "destructive" });
      return false;
    }
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    setVideoProcessing(true);
    try {
      for (const file of files) {
        await addPendingVideoFromFile(file);
      }
    } finally {
      setVideoProcessing(false);
    }
  };

  const handleTrimmed = async (trimmed: File) => {
    setTrimSource(null);
    setVideoProcessing(true);
    try {
      await addPendingVideoFromFile(trimmed);
    } finally {
      setVideoProcessing(false);
    }
  };

  const removePendingVideo = (idx: number) => {
    setPendingVideos((prev) => {
      const next = [...prev];
      const [removed] = next.splice(idx, 1);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  };

  const removeExistingUploadedVideo = async (videoId: string) => {
    if (!isEdit) return;
    const target = existingUploadedVideos.find((v) => v.id === videoId);
    if (!target) return;
    const { error } = await supabase.from("flight_videos").delete().eq("id", videoId);
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      return;
    }
    // best-effort delete from storage
    const paths = [target.storage_path, target.poster_path].filter(Boolean) as string[];
    if (paths.length) await supabase.storage.from("flight-videos").remove(paths);
    setExistingUploadedVideos((prev) => prev.filter((v) => v.id !== videoId));
    toast({ title: t("common.deleted", { defaultValue: "Gelöscht" }) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!user) return; setLoading(true);
    try {
      const pendingYoutubeUrls = [...youtubeUrls, newYoutubeUrl]
        .map((u) => u.trim())
        .filter(Boolean)
        .filter((url, index, arr) => arr.indexOf(url) === index);

      // Auto-link event_id when group + date match
      let eventId: string | null = null;
      if (form.group_id && form.date) {
        const dateStart = new Date(form.date + "T00:00:00").toISOString();
        const dateEnd = new Date(form.date + "T23:59:59").toISOString();
        const { data: matchingEvent } = await supabase.from("flight_events")
          .select("id")
          .eq("group_id", form.group_id)
          .gte("event_date", dateStart)
          .lte("event_date", dateEnd)
          .limit(1)
          .maybeSingle();
        if (matchingEvent) eventId = matchingEvent.id;
      }

      const flightData = { user_id: user.id, date: form.date, takeoff_location_id: form.takeoff_location_id || null, landing_location_id: form.landing_location_id || null, duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null, altitude_gain: form.altitude_gain ? parseInt(form.altitude_gain) : null, distance_km: form.distance_km ? parseFloat(form.distance_km) : null, thermals: form.thermals || null, wind_speed: form.wind_speed ? parseInt(form.wind_speed) : null, wind_direction: form.wind_direction || null, glider: form.glider || null, comments: form.comments || null, group_id: form.group_id || null, is_solo_shv: form.is_solo_shv, event_id: eventId, tags: tags.length > 0 ? tags : null } as any;

      // Offline save when not connected
      if (!navigator.onLine && !isEdit) {
        const { saveOfflineFlight } = await import("@/lib/offline-queue");
        await saveOfflineFlight({
          id: crypto.randomUUID(),
          flightData,
          youtubeUrls: pendingYoutubeUrls,
          selectedTrainingIds,
          createdAt: new Date().toISOString(),
          syncStatus: "pending",
        });
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
        toast({ title: t("offline.flightSaved"), description: t("offline.flightSavedDesc") });
        navigate("/flights");
        return;
      }

      let flightId: string;
      if (isEdit) { const { error } = await supabase.from("flights").update(flightData).eq("id", id); if (error) throw error; flightId = id!; }
      else { const { data, error } = await supabase.from("flights").insert(flightData).select("id").single(); if (error) throw error; flightId = data.id; }
      if (igcFile) {
        try {
          const content = await igcFile.text();
          await uploadIgcTrack({
            flightId,
            fileName: igcFile.name,
            fileContent: content,
            igcData,
          });
        } catch (igcErr: any) { console.error("IGC upload failed:", igcErr); toast({ title: t("flights.igcUploadFailed"), description: t("flights.igcUploadFailedDesc"), variant: "destructive" }); }
      }
      for (const photo of photoFiles) {
        try { const path = `${user.id}/${flightId}/${Date.now()}-${photo.name}`; const { error: photoErr } = await supabase.storage.from("flight-photos").upload(path, photo); if (photoErr) throw photoErr; const { error: insertErr } = await supabase.from("flight_photos").insert({ flight_id: flightId, storage_path: path }); if (insertErr) throw insertErr; }
        catch (photoErr: any) { console.error("Photo upload failed:", photoErr); toast({ title: t("flights.photoUploadFailed"), description: photo.name, variant: "destructive" }); }
      }
      // Save YouTube videos: only delete YouTube rows on edit (uploaded videos are managed separately).
      if (isEdit) {
        const { error: deleteVideosError } = await supabase
          .from("flight_videos")
          .delete()
          .eq("flight_id", flightId)
          .not("youtube_url", "is", null);
        if (deleteVideosError) throw deleteVideosError;
      }
      if (pendingYoutubeUrls.length > 0) {
        const { error: insertVideosError } = await supabase.from("flight_videos").insert(
          pendingYoutubeUrls.map((url) => ({ flight_id: flightId, youtube_url: url }))
        );
        if (insertVideosError) throw insertVideosError;
      }
      // Upload pending direct videos
      for (const pv of pendingVideos) {
        try {
          const ts = Date.now();
          const ext = pv.file.name.match(/\.(mp4|mov|webm)$/i)?.[0] || ".mp4";
          const videoPath = `${user.id}/${flightId}/${ts}${ext}`;
          const posterPath = `${user.id}/${flightId}/${ts}.jpg`;
          // Normalize content type: bucket only allows exact MIME (no codec params)
          const rawType = (pv.file.type || "").split(";")[0].trim().toLowerCase();
          const allowed = ["video/mp4", "video/quicktime", "video/webm"];
          let contentType = allowed.includes(rawType) ? rawType : "";
          if (!contentType) {
            if (/\.webm$/i.test(pv.file.name)) contentType = "video/webm";
            else if (/\.mov$/i.test(pv.file.name)) contentType = "video/quicktime";
            else contentType = "video/mp4";
          }
          const { error: vErr } = await supabase.storage.from("flight-videos").upload(videoPath, pv.file, { contentType });
          if (vErr) throw vErr;
          const { error: pErr } = await supabase.storage.from("flight-videos").upload(posterPath, pv.poster, { contentType: "image/jpeg" });
          if (pErr) throw pErr;
          const { error: insErr } = await supabase.from("flight_videos").insert({
            flight_id: flightId,
            youtube_url: null as any,
            storage_path: videoPath,
            poster_path: posterPath,
            duration_seconds: Math.round(pv.durationSec),
            size_bytes: pv.file.size,
          } as any);
          if (insErr) throw insErr;
        } catch (vErr: any) {
          console.error("Video upload failed:", vErr);
          toast({ title: t("flights.videoUploadFailed", { defaultValue: "Video-Upload fehlgeschlagen" }), description: `${pv.file.name}: ${vErr?.message || vErr}`, variant: "destructive" });
        }
      }
      // Save training items
      if (isEdit) { await supabase.from("flight_training_items").delete().eq("flight_id", flightId); }
      if (selectedTrainingIds.length > 0) { await supabase.from("flight_training_items").insert(selectedTrainingIds.map((item_id) => ({ flight_id: flightId, item_id })) as any); }
      // Auto-verify challenge goals if IGC data exists
      if (igcData && igcData.points.length > 0) {
        try {
          const { verifyChallengeGoals } = await import("@/lib/challenge-verify");
          // Get user's groups
          const { data: memberships } = await supabase.from("group_members").select("group_id").eq("user_id", user.id);
          if (memberships && memberships.length > 0) {
            const groupIds = memberships.map(m => m.group_id);
            const today = new Date().toISOString().split("T")[0];
            const { data: activeChallenges } = await supabase.from("challenges").select("id").in("group_id", groupIds);
            const filteredChallenges = (activeChallenges as any[] || []);
            if (filteredChallenges.length > 0) {
              const challengeIds = filteredChallenges.map(c => c.id);
              const { data: goalsData } = await supabase.from("challenge_goals").select("id, challenge_id, latitude, longitude, radius_meters, goal_type").in("challenge_id", challengeIds);
              const goalsWithCoords = (goalsData as any[] || []).filter(g => g.latitude && g.longitude);
              if (goalsWithCoords.length > 0) {
                // Check already completed
                const { data: existingProgress } = await supabase.from("challenge_progress").select("goal_id").eq("user_id", user.id);
                const completedIds = new Set((existingProgress as any[] || []).map(p => p.goal_id));
                const uncompleted = goalsWithCoords.filter(g => !completedIds.has(g.id));
                if (uncompleted.length > 0) {
                  const reachedIds = verifyChallengeGoals(igcData.points, uncompleted);
                  if (reachedIds.length > 0) {
                    const inserts = reachedIds.map(goalId => {
                      const goal = uncompleted.find(g => g.id === goalId)!;
                      return { challenge_id: goal.challenge_id, user_id: user.id, goal_id: goalId, flight_id: flightId };
                    });
                    await supabase.from("challenge_progress").insert(inserts as any);

                    // Create feed achievements for each reached goal
                    for (const goalId of reachedIds) {
                      const goal = uncompleted.find(g => g.id === goalId)!;
                      await supabase.from("feed_achievements").insert({
                        user_id: user.id, challenge_id: goal.challenge_id,
                        goal_id: goalId, achievement_type: "goal_reached",
                      } as any);
                    }

                    // Check if any challenge is now fully completed
                    const affectedChallengeIds = [...new Set(reachedIds.map(gId => uncompleted.find(g => g.id === gId)!.challenge_id))];
                    for (const cId of affectedChallengeIds) {
                      const totalGoals = goalsWithCoords.filter(g => g.challenge_id === cId).length;
                      const { data: allProgress } = await supabase.from("challenge_progress")
                        .select("goal_id").eq("challenge_id", cId).eq("user_id", user.id);
                      if ((allProgress as any[] || []).length >= totalGoals) {
                        await supabase.from("feed_achievements").insert({
                          user_id: user.id, challenge_id: cId,
                          goal_id: null, achievement_type: "challenge_completed",
                        } as any);
                      }
                    }

                    toast({ title: t("challenges.autoVerified"), description: `${reachedIds.length} ${t("challenges.goalsReached")}` });
                  }
                }
              }
            }
          }
        } catch (verifyErr) { console.error("Challenge verification failed:", verifyErr); }
      }

      // Check for newly awarded badges
      try {
        const { data: newBadges } = await supabase.from("pilot_badges")
          .select("badge_key, unlocked_at").eq("user_id", user.id)
          .gte("unlocked_at", new Date(Date.now() - 10000).toISOString());
        if (newBadges && (newBadges as any[]).length > 0) {
          toast({ title: t("badges.newBadge"), description: (newBadges as any[]).map(b => t(`badges.${b.badge_key}`)).join(", ") });
        }
      } catch (e) { console.error("Badge check failed:", e); }

      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      void queryClient.invalidateQueries({ queryKey: ["dashboard", user.id] });
      toast({ title: isEdit ? t("flights.flightUpdated") : t("flights.flightSaved") }); navigate(`/flights/${flightId}`);
    } catch (err: any) { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const addYoutubeUrl = () => { if (newYoutubeUrl.trim()) { setYoutubeUrls([...youtubeUrls, newYoutubeUrl.trim()]); setNewYoutubeUrl(""); } };

  const loadTemplate = (tpl: FlightTemplate) => {
    setForm(prev => ({
      ...prev,
      takeoff_location_id: tpl.takeoff_location_id || "",
      landing_location_id: tpl.landing_location_id || "",
      glider: tpl.glider || prev.glider,
      group_id: tpl.group_id || "",
    }));
    toast({ title: t("flights.templateLoaded") });
  };

  const saveTemplate = async () => {
    if (!user || !templateName.trim()) return;
    const { data, error } = await supabase.from("flight_templates").insert({
      user_id: user.id,
      name: templateName.trim(),
      takeoff_location_id: form.takeoff_location_id || null,
      landing_location_id: form.landing_location_id || null,
      glider: form.glider || null,
      group_id: form.group_id || null,
    } as any).select().single();
    if (error) { toast({ title: t("common.error"), description: error.message, variant: "destructive" }); return; }
    setTemplates(prev => [data as any as FlightTemplate, ...prev]);
    setTemplateName("");
    setShowSaveTemplate(false);
    toast({ title: t("flights.templateSaved") });
  };

  const deleteTemplate = async (tplId: string) => {
    await supabase.from("flight_templates").delete().eq("id", tplId);
    setTemplates(prev => prev.filter(t => t.id !== tplId));
    toast({ title: t("flights.templateDeleted") });
  };
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: e.target.value });
  const showStep = (n: number) => isEdit || step === n;
  const takeoffs = locations.filter((l) => l.type === "takeoff" || l.type === "both");
  const landings = locations.filter((l) => l.type === "landing" || l.type === "both");

  const thermalOptions = [
    { value: "Keine", label: t("flights.thermalNone") }, { value: "Schwach", label: t("flights.thermalWeak") },
    { value: "Mässig", label: t("flights.thermalModerate") }, { value: "Stark", label: t("flights.thermalStrong") },
    { value: "Turbulent", label: t("flights.thermalTurbulent") },
  ];

  return (
    <PageContainer>
      <PageHeader title={isEdit ? t("flights.editFlight") : t("flights.newFlight")} back />
      {!isEdit && <SchoolFlightImportCard />}
      {!isEdit && (
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setStep(n)}
              className="flex-1 text-left"
            >
              <div className={cn("h-1.5 rounded-full transition-colors", n <= step ? "bg-primary" : "bg-muted")} />
              <span className={cn("text-[10px] mt-1 block", n === step ? "text-foreground font-medium" : "text-muted-foreground")}>
                {t(`flights.step${n}`, { defaultValue: n === 1 ? "Flug" : n === 2 ? "Details" : "Medien" })}
              </span>
            </button>
          ))}
        </div>
      )}
      {/* Templates */}
      {!isEdit && step === 1 && templates.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("flights.templates")}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {templates.map((tpl) => (
                <div key={tpl.id} className="group relative">
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs pr-6" onClick={() => loadTemplate(tpl)}>
                    {tpl.name}
                  </Button>
                  <button type="button" onClick={() => deleteTemplate(tpl.id)} aria-label={t("common.delete")} className="absolute right-1 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 transition-opacity">
                    <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <form onSubmit={handleSubmit} onInputCapture={() => { userEditedRef.current = true; }} onClickCapture={() => { userEditedRef.current = true; }} className="space-y-4">
        {showStep(1) && (<>
        <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <label className="flex flex-col items-center gap-2 cursor-pointer">
              <Upload className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium text-primary">{t("flights.igcImport")}</span>
              <span className="text-xs text-muted-foreground">{t("flights.igcExtract")}</span>
              <input type="file" accept=".igc" className="hidden" onChange={handleIGCUpload} />
            </label>
            {igcData && <p className="text-xs text-center mt-2 text-muted-foreground">✓ {igcData.points.length} Punkte · {igcData.durationMinutes}min · max {igcData.maxAltitude}m</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">{t("flights.basicData")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">{t("flights.date")}</Label><Input type="date" value={form.date} onChange={set("date")} required /></div>
              <div className="space-y-1.5"><Label className="text-xs">{t("flights.glider")}</Label>
                {gliders.length > 0 ? (
                  <Select value={form.glider} onValueChange={(v) => setForm({ ...form, glider: v })}>
                    <SelectTrigger><SelectValue placeholder={t("flights.selectGlider")} /></SelectTrigger>
                    <SelectContent>{gliders.map((g) => { const label = `${g.manufacturer} ${g.model}${g.size ? ` (${g.size})` : ""}`; return <SelectItem key={g.id} value={label}>{label}</SelectItem>; })}</SelectContent>
                  </Select>
                ) : <Input value={form.glider} onChange={set("glider")} placeholder={t("flights.gliderPlaceholder")} />}
              </div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">{t("flights.takeoff")}</Label>
              <LocationCombobox
                locations={locations}
                value={form.takeoff_location_id}
                onChange={(v) => {
                  const newForm = { ...form, takeoff_location_id: v };
                  if (!igcData && v && form.landing_location_id) {
                    const takeoff = locations.find(l => l.id === v);
                    const landing = locations.find(l => l.id === form.landing_location_id);
                    if (takeoff?.altitude != null && landing?.altitude != null) {
                      newForm.altitude_gain = Math.max(0, takeoff.altitude - landing.altitude).toString();
                    }
                  }
                  setForm(newForm);
                }}
                filterType="takeoff"
                onLocationCreated={() => {
                  if (user) supabase.from("locations").select("id, name, type, altitude").eq("user_id", user.id).order("name").then(({ data }) => { if (data) setLocations(data); });
                }}
              />
            </div>
            <div className="space-y-1.5"><Label className="text-xs">{t("flights.landing")}</Label>
              <LocationCombobox
                locations={locations}
                value={form.landing_location_id}
                onChange={(v) => {
                  const newForm = { ...form, landing_location_id: v };
                  if (!igcData && form.takeoff_location_id && v) {
                    const takeoff = locations.find(l => l.id === form.takeoff_location_id);
                    const landing = locations.find(l => l.id === v);
                    if (takeoff?.altitude != null && landing?.altitude != null) {
                      newForm.altitude_gain = Math.max(0, takeoff.altitude - landing.altitude).toString();
                    }
                  }
                  setForm(newForm);
                }}
                filterType="landing"
                onLocationCreated={() => {
                  if (user) supabase.from("locations").select("id, name, type, altitude").eq("user_id", user.id).order("name").then(({ data }) => { if (data) setLocations(data); });
                }}
              />
            </div>
             <div className="flex items-center gap-3 pt-1">
                <Checkbox
                  id="solo-shv"
                  checked={form.is_solo_shv}
                  onCheckedChange={(checked) => setForm({ ...form, is_solo_shv: !!checked })}
                />
                <Label htmlFor="solo-shv" className="text-xs cursor-pointer">{t("flights.soloShv")}</Label>
              </div>
           </CardContent>
        </Card>
        {groups.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-1.5">
              <Label className="text-xs">{t("flights.group")}</Label>
              <Select value={form.group_id} onValueChange={(v) => setForm({ ...form, group_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder={t("flights.selectGroup")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("flights.noGroup")}</SelectItem>
                  {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}
        </>)}
        {showStep(2) && (<>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">{t("flights.extendedData")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">{t("flights.duration")}</Label><Input type="number" value={form.duration_minutes} onChange={set("duration_minutes")} /></div>
              <div className="space-y-1.5"><Label className="text-xs">{t("flights.altitudeGain")}</Label><Input type="number" value={form.altitude_gain} onChange={set("altitude_gain")} /></div>
              <div className="space-y-1.5"><Label className="text-xs">{t("flights.distance")}</Label><Input type="number" step="0.1" value={form.distance_km} onChange={set("distance_km")} /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">{t("flights.thermals")}</Label>
              <Select value={form.thermals} onValueChange={(v) => setForm({ ...form, thermals: v })}>
                <SelectTrigger><SelectValue placeholder={t("flights.select")} /></SelectTrigger>
                <SelectContent>{thermalOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">{t("flights.windSpeed")}</Label><Input type="number" value={form.wind_speed} onChange={set("wind_speed")} /></div>
              <div className="space-y-1.5"><Label className="text-xs">{t("flights.windDirection")}</Label>
                <Select value={form.wind_direction} onValueChange={(v) => setForm({ ...form, wind_direction: v })}>
                  <SelectTrigger><SelectValue placeholder={t("flights.direction")} /></SelectTrigger>
                  <SelectContent>{["N", "NE", "E", "SE", "S", "SW", "W", "NW"].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">{t("flights.comments")}</Label><Textarea value={form.comments} onChange={set("comments")} placeholder={t("flights.commentsPlaceholder")} rows={3} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">{t("flights.tags")}</CardTitle></CardHeader>
          <CardContent>
            <TagsInput value={tags} onChange={setTags} suggestions={tagSuggestions} placeholder={t("flights.tagsPlaceholder")} />
          </CardContent>
        </Card>
        {trainingItems.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">{t("flights_training.trainedManeuvers")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {selectedTrainingIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedTrainingIds.map((id) => {
                    const item = trainingItems.find((ti) => ti.id === id);
                    return item ? (
                      <Badge key={id} variant="secondary" className="gap-1 pr-1">
                        {item.name}
                        <button type="button" onClick={() => setSelectedTrainingIds((prev) => prev.filter((x) => x !== id))}><X className="h-3 w-3" /></button>
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="w-full">
                    <Plus className="h-4 w-4 mr-1" /> {t("flights_training.selectManeuvers")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 max-h-64 overflow-y-auto p-2" align="start">
                  {(() => {
                    const categories = [...new Set(trainingItems.map((ti) => ti.category_name))];
                    return categories.map((cat) => (
                      <div key={cat} className="mb-2">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-2 py-1">{cat}</p>
                        {trainingItems.filter((ti) => ti.category_name === cat).map((ti) => (
                          <label key={ti.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm">
                            <Checkbox
                              checked={selectedTrainingIds.includes(ti.id)}
                              onCheckedChange={(checked) => {
                                setSelectedTrainingIds((prev) => checked ? [...prev, ti.id] : prev.filter((x) => x !== ti.id));
                              }}
                            />
                            {ti.name}
                          </label>
                        ))}
                      </div>
                    ));
                  })()}
                </PopoverContent>
              </Popover>
            </CardContent>
          </Card>
        )}
        </>)}
        {showStep(3) && (<>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">{t("flights.photos")}</CardTitle></CardHeader>
          <CardContent>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-primary"><Plus className="h-4 w-4" /> {t("flights.addPhotos")}<input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setPhotoFiles(Array.from(e.target.files || []))} /></label>
            {photoFiles.length > 0 && <p className="text-xs text-muted-foreground mt-1">{photoFiles.length} {t("flights.photosSelected")}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Film className="h-4 w-4" /> {t("flights.uploadVideos", { defaultValue: "Video hochladen" })}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              {t("flights.uploadVideosHint", { defaultValue: `Kurze Clips direkt vom Handy. Max ${MAX_VIDEO_SECONDS}s, max ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)} MB.` })}
            </p>
            {existingUploadedVideos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {existingUploadedVideos.map((v) => (
                  <div key={v.id} className="relative aspect-square rounded-md bg-muted overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><Video className="h-6 w-6" /></div>
                    <button type="button" onClick={() => removeExistingUploadedVideo(v.id)} className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 text-white"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
            {pendingVideos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {pendingVideos.map((pv, i) => (
                  <div key={i} className="relative aspect-square rounded-md bg-muted overflow-hidden">
                    <img src={pv.previewUrl} alt="" className="w-full h-full object-cover" />
                    <div className="absolute bottom-1 left-1 text-[10px] bg-black/70 text-white px-1 rounded">{Math.round(pv.durationSec)}s</div>
                    <button type="button" onClick={() => removePendingVideo(i)} className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 text-white"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => videoLibraryInputRef.current?.click()}
                disabled={videoProcessing}
              >
                <Plus className="h-4 w-4" />
                {videoProcessing
                  ? t("flights.processingVideo", { defaultValue: "Verarbeite Video…" })
                  : t("flights.addVideos", { defaultValue: "Video vom Gerät auswählen" })}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={() => videoCameraInputRef.current?.click()}
                disabled={videoProcessing}
              >
                <Video className="h-4 w-4" />
                {t("flights.recordVideo", { defaultValue: "Mit Kamera aufnehmen" })}
              </Button>

              <input
                ref={videoLibraryInputRef}
                type="file"
                accept=".mp4,.mov,.webm,.m4v,video/mp4,video/quicktime,video/webm"
                multiple
                className="hidden"
                onChange={handleVideoSelect}
                disabled={videoProcessing}
              />
              <input
                ref={videoCameraInputRef}
                type="file"
                accept="video/*"
                capture="environment"
                className="hidden"
                onChange={handleVideoSelect}
                disabled={videoProcessing}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">{t("flights.trimAvailableHint", { defaultValue: "Längere Videos können nach der Auswahl auf 60 s zugeschnitten werden." })}</p>
          </CardContent>
        </Card>
        <VideoTrimDialog
          file={trimSource}
          open={!!trimSource}
          onClose={() => setTrimSource(null)}
          onTrimmed={handleTrimmed}
        />
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">{t("flights.youtubeVideos")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {youtubeUrls.map((url, i) => (
              <div key={i} className="flex items-center gap-2 text-xs"><Youtube className="h-4 w-4 text-destructive shrink-0" /><span className="truncate flex-1">{url}</span><button type="button" onClick={() => setYoutubeUrls(youtubeUrls.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button></div>
            ))}
            <div className="flex gap-2"><Input placeholder={t("flights.youtubeUrlPlaceholder")} value={newYoutubeUrl} onChange={(e) => setNewYoutubeUrl(e.target.value)} className="text-sm" /><Button type="button" variant="outline" size="sm" onClick={addYoutubeUrl}>+</Button></div>
          </CardContent>
        </Card>
        </>)}
        <div className="sticky bottom-16 z-10 -mx-1 px-1 py-2 bg-background/85 backdrop-blur-sm space-y-2">
          <div className="flex gap-2">
            {!isEdit && step > 1 && (
              <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(step - 1)}>
                {t("common.back")}
              </Button>
            )}
            {!isEdit && step < 3 ? (
              <Button type="button" className="flex-1" onClick={() => setStep(step + 1)}>
                {t("flights.nextStep", { defaultValue: "Weiter" })}
              </Button>
            ) : (
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? t("flights.saving") : isEdit ? t("common.update") : t("flights.saveFlight", { defaultValue: "Flug speichern" })}
              </Button>
            )}
          </div>
          {!isEdit && step < 3 && (
            <Button type="submit" variant="ghost" className="w-full text-xs" disabled={loading}>
              {loading ? t("flights.saving") : t("flights.saveNow", { defaultValue: "Direkt speichern" })}
            </Button>
          )}
        </div>
        {!isEdit && step === 3 && (
          <div className="space-y-2">
            {showSaveTemplate ? (
              <div className="flex gap-2">
                <Input placeholder={t("flights.templateNamePlaceholder")} value={templateName} onChange={(e) => setTemplateName(e.target.value)} className="text-sm" />
                <Button type="button" size="sm" onClick={saveTemplate} disabled={!templateName.trim()}>
                  <Save className="h-4 w-4" />
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowSaveTemplate(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" className="w-full gap-2 text-sm" onClick={() => setShowSaveTemplate(true)}>
                <Save className="h-4 w-4" /> {t("flights.saveAsTemplate")}
              </Button>
            )}
          </div>
        )}
      </form>
    </PageContainer>
  );
}
