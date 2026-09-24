import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { openDirectChannel, useDirectCandidates } from "@/hooks/use-chat";
import { initials } from "@/lib/chat";

/** Pick a person (anyone sharing a group) and open the direct chat with them. */
export default function NewDirectMessageDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const candidates = useDirectCandidates(open);
  const [query, setQuery] = useState("");
  const [opening, setOpening] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const people = (candidates.data || []).filter((p) => !q || p.pilot_name.toLowerCase().includes(q));

  const start = async (userId: string) => {
    setOpening(userId);
    try {
      const channelId = await openDirectChannel(userId);
      onOpenChange(false);
      navigate(`/messages/${channelId}`);
    } catch (error) {
      toast({ title: t("common.error"), description: (error as Error).message, variant: "destructive" });
    } finally {
      setOpening(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("chat.newDirect")}</DialogTitle>
          <DialogDescription>{t("chat.newDirectHint")}</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("chat.searchPeople")} className="pl-9" />
        </div>
        <div className="max-h-[50vh] overflow-y-auto -mx-2">
          {candidates.isPending ? (
            <div className="space-y-2 px-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
          ) : people.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("chat.noPeople")}</p>
          ) : people.map((p) => (
            <button key={p.user_id} type="button" disabled={!!opening} onClick={() => void start(p.user_id)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted/60 disabled:opacity-60">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {initials(p.pilot_name || "Pilot")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{p.pilot_name || "Pilot"}</span>
                <span className="block truncate text-xs text-muted-foreground">{p.groups.join(", ")}</span>
              </span>
              {opening === p.user_id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
