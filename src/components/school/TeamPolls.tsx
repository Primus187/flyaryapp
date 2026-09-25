import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/layout/EmptyState";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { countResponsesByOption, findOwnResponse, isPollClosed, parseOptionsInput, type PollResponse } from "@/lib/team-polls";

const TEAM_FUNCTIONS = ["school_lead", "instructor", "launch_helper"] as const;

interface Poll {
  id: string;
  group_id: string;
  question: string;
  options: string[];
  closes_at: string | null;
  created_by: string;
  created_at: string;
}

interface Props {
  groupId: string;
  canManage?: boolean;
}

export default function TeamPolls({ groupId, canManage = true }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [responses, setResponses] = useState<Record<string, PollResponse[]>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState("");
  const [optionsInput, setOptionsInput] = useState("Ja, Nein");
  const [closesAt, setClosesAt] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: pollRows } = await supabase
      .from("team_polls")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });
    const pollList = (pollRows as unknown as Poll[]) || [];
    setPolls(pollList);

    if (pollList.length > 0) {
      const { data: responseRows } = await supabase
        .from("team_poll_responses")
        .select("poll_id, user_id, response")
        .in("poll_id", pollList.map((p) => p.id));
      const map: Record<string, PollResponse[]> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet
      ((responseRows as any[]) || []).forEach((r) => {
        if (!map[r.poll_id]) map[r.poll_id] = [];
        map[r.poll_id].push({ userId: r.user_id, response: r.response });
      });
      setResponses(map);
    }

    const [{ data: members }, { data: funcs }] = await Promise.all([
      supabase.from("group_members").select("user_id, role").eq("group_id", groupId),
      supabase.from("group_member_functions").select("user_id, function").eq("group_id", groupId),
    ]);
    const admins = (members || []).filter((m) => m.role === "admin").map((m) => m.user_id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet
    const teamFuncUserIds = ((funcs as any[]) || [])
      .filter((f) => (TEAM_FUNCTIONS as readonly string[]).includes(f.function))
      .map((f) => f.user_id);
    const teamIds = [...new Set([...admins, ...teamFuncUserIds])];
    if (teamIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("user_id, pilot_name").in("user_id", teamIds);
      const nameMap: Record<string, string> = {};
      (profs || []).forEach((p) => { nameMap[p.user_id] = p.pilot_name || "—"; });
      setNames(nameMap);
    }
    setLoading(false);
  }, [groupId]);

  useEffect(() => { if (groupId) void load(); }, [groupId, load]);

  const resetForm = () => {
    setQuestion("");
    setOptionsInput("Ja, Nein");
    setClosesAt("");
  };

  const createPoll = async () => {
    if (!user) return;
    const options = parseOptionsInput(optionsInput);
    if (!question.trim() || options.length < 2) return;
    setSaving(true);
    const newPoll = {
      group_id: groupId,
      question: question.trim(),
      options,
      closes_at: closesAt ? new Date(closesAt).toISOString() : null,
      created_by: user.id,
    };
    const { error } = await supabase.from("team_polls").insert(newPoll);
    setSaving(false);
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      return;
    }
    setCreating(false);
    resetForm();
    void load();
  };

  const deletePoll = async (pollId: string) => {
    await supabase.from("team_polls").delete().eq("id", pollId);
    setPolls((prev) => prev.filter((p) => p.id !== pollId));
  };

  const respond = async (poll: Poll, option: string) => {
    if (!user) return;
    const newResponse = { poll_id: poll.id, user_id: user.id, response: option };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet
    const { error } = await supabase.from("team_poll_responses").upsert(newResponse as any, { onConflict: "poll_id,user_id" });
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      return;
    }
    setResponses((prev) => {
      const existing = (prev[poll.id] || []).filter((r) => r.userId !== user.id);
      return { ...prev, [poll.id]: [...existing, { userId: user.id, response: option }] };
    });
  };

  if (loading) return <Skeleton className="h-32 w-full rounded-2xl" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("school.polls.title")}</h2>
        {canManage && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" /> {t("school.polls.new")}
          </Button>
        )}
      </div>

      {polls.length === 0 ? (
        <EmptyState icon={ListChecks} title={t("school.polls.empty")} description={t("school.polls.emptyHint")} />
      ) : (
        polls.map((poll) => {
          const pollResponses = responses[poll.id] || [];
          const closed = isPollClosed(poll.closes_at);
          const ownResponse = user ? findOwnResponse(pollResponses, user.id) : null;
          const counts = countResponsesByOption(poll.options, pollResponses);
          return (
            <Card key={poll.id} className="border-border/60 bg-card/80">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium flex-1">{poll.question}</p>
                  {canManage && (
                    <button onClick={() => deletePoll(poll.id)} aria-label={t("common.delete")}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
                {poll.closes_at && (
                  <p className="text-[10px] text-muted-foreground">
                    {closed ? t("school.polls.closed") : t("school.polls.closesAt", { date: new Date(poll.closes_at).toLocaleString("de-CH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) })}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {poll.options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      disabled={closed}
                      onClick={() => respond(poll, option)}
                      className={`text-[11px] px-2.5 py-1 rounded-full border shrink-0 disabled:opacity-50 ${
                        ownResponse === option ? "bg-primary/15 border-primary/50 text-primary font-medium" : "border-border text-muted-foreground"
                      }`}
                    >
                      {option} · {counts[option] ?? 0}
                    </button>
                  ))}
                </div>
                {canManage && pollResponses.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    {pollResponses.map((r) => `${names[r.userId] || "—"}: ${r.response}`).join(", ")}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      <Dialog open={creating} onOpenChange={(open) => { setCreating(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("school.polls.new")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("school.polls.question")}</Label>
              <Textarea rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t("school.polls.questionPlaceholder")} />
            </div>
            <div>
              <Label>{t("school.polls.options")}</Label>
              <Input value={optionsInput} onChange={(e) => setOptionsInput(e.target.value)} placeholder="Ja, Nein" />
              <p className="text-[10px] text-muted-foreground mt-1">{t("school.polls.optionsHint")}</p>
            </div>
            <div>
              <Label>{t("school.polls.closesAtLabel")}</Label>
              <Input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={createPoll} disabled={saving || !question.trim() || parseOptionsInput(optionsInput).length < 2}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
