import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ClipboardEdit, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CoachNote {
  id: string;
  coach_id: string;
  note: string;
  visible_to_student: boolean;
  updated_at: string;
  coach_name?: string;
}

interface Props {
  flightId: string;
  flightUserId: string;
  groupId: string | null;
}

export default function FlightCoachNote({ flightId, flightUserId, groupId }: Props) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isCoach, setIsCoach] = useState(false);
  const [notes, setNotes] = useState<CoachNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftVisible, setDraftVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const isStudent = user?.id === flightUserId;

  const load = async () => {
    if (!user || !flightId) return;
    setLoading(true);

    let coachOk = false;
    if (groupId && !isStudent) {
      const { data: m } = await supabase
        .from("group_members")
        .select("role")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .maybeSingle();
      coachOk = m?.role === "admin";
    }
    setIsCoach(coachOk);

    const { data } = await supabase
      .from("flight_coach_notes")
      .select("id, coach_id, note, visible_to_student, updated_at")
      .eq("flight_id", flightId)
      .order("updated_at", { ascending: false });

    const list = (data as any[]) || [];
    if (list.length > 0) {
      const coachIds = [...new Set(list.map((n) => n.coach_id))];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, pilot_name")
        .in("user_id", coachIds);
      const nameMap = Object.fromEntries((profs || []).map((p) => [p.user_id, p.pilot_name]));
      list.forEach((n: any) => { n.coach_name = nameMap[n.coach_id] || ""; });
    }
    setNotes(list);

    // Pre-fill draft with current coach's existing note
    if (coachOk) {
      const own = list.find((n: any) => n.coach_id === user.id);
      if (own) {
        setDraft(own.note);
        setDraftVisible(own.visible_to_student);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, flightId, groupId, flightUserId]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("flight_coach_notes")
      .upsert({
        flight_id: flightId,
        coach_id: user.id,
        note: draft,
        visible_to_student: draftVisible,
      } as any, { onConflict: "flight_id,coach_id" });

    setSaving(false);
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("coach.noteSaved") });
    setEditing(false);
    load();
  };

  // Hide entirely if nothing relevant to show
  if (loading) return null;
  const visibleToStudent = notes.filter((n) => n.visible_to_student);
  if (!isCoach && (!isStudent || visibleToStudent.length === 0)) return null;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <ClipboardEdit className="h-4 w-4 text-primary" />
          {t("coach.privateNote")}
        </CardTitle>
        {isCoach && !editing && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditing(true)}>
            {notes.some((n) => n.coach_id === user?.id) ? t("common.edit") : t("common.add")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {editing && isCoach ? (
          <div className="space-y-3">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("coach.privateNotePlaceholder")}
              className="min-h-[100px] text-sm"
            />
            <div className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
              <Label htmlFor="visible-toggle" className="text-xs flex items-center gap-2 cursor-pointer">
                {draftVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {draftVisible ? t("coach.visibleToStudent") : t("coach.privateOnly")}
              </Label>
              <Switch id="visible-toggle" checked={draftVisible} onCheckedChange={setDraftVisible} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={saving}>
                {t("common.save")}
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditing(false)}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {(isCoach ? notes : visibleToStudent).map((n) => (
              <div key={n.id} className="bg-muted/40 rounded-lg p-3 space-y-1">
                {n.note ? (
                  <p className="text-sm whitespace-pre-wrap">{n.note}</p>
                ) : (
                  <p className="text-xs text-muted-foreground italic">{t("coach.noNoteYet")}</p>
                )}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
                  <span>{n.coach_name && `— ${n.coach_name}`}</span>
                  {isCoach && (
                    <span className="flex items-center gap-1">
                      {n.visible_to_student ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {n.visible_to_student ? t("coach.visibleToStudent") : t("coach.privateOnly")}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {isCoach && notes.length === 0 && (
              <p className="text-xs text-muted-foreground">{t("coach.noNoteYet")}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
