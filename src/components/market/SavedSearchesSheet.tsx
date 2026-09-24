import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Bell, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { deleteSavedSearch, setNotify, type SavedSearch } from "@/lib/marketplace-saved-searches";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searches: SavedSearch[];
  onChange: (searches: SavedSearch[]) => void;
  onOpen: (search: SavedSearch) => void;
}

/** Saved searches (plan 6.2): open one, switch its push on or off, delete it. */
export default function SavedSearchesSheet({ open, onOpenChange, searches, onChange, onOpen }: Props) {
  const { t } = useTranslation();

  const toggle = async (s: SavedSearch, notify: boolean) => {
    onChange(searches.map((x) => (x.id === s.id ? { ...x, notify } : x)));
    try { await setNotify(s.id, notify); } catch {
      onChange(searches);
      toast.error(t("market.errors.unknown"));
    }
  };
  const remove = async (s: SavedSearch) => {
    if (!window.confirm(t("market.saved.deleteConfirm", { name: s.name }))) return;
    try {
      await deleteSavedSearch(s.id);
      onChange(searches.filter((x) => x.id !== s.id));
    } catch {
      toast.error(t("market.errors.unknown"));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
        <SheetHeader><SheetTitle>{t("market.saved.title")}</SheetTitle></SheetHeader>
        <div className="space-y-2 py-4">
          {searches.length === 0 && <p className="text-sm text-muted-foreground">{t("market.saved.empty")}</p>}
          {searches.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-lg border p-2">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(s)}>
                <p className="truncate text-sm font-medium">{s.name}</p>
                {s.new_count > 0 && <Badge className="mt-0.5 text-[10px]">{t("market.saved.newCount", { count: s.new_count })}</Badge>}
              </button>
              <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Bell className="h-3.5 w-3.5" />
                <Switch checked={s.notify} onCheckedChange={(v) => void toggle(s, v)} aria-label={t("market.saved.notify")} />
              </label>
              <Button size="icon" variant="ghost" aria-label={t("market.saved.delete")} onClick={() => void remove(s)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
