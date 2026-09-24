import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { setFavorite } from "@/lib/marketplace-favorites";

interface Props {
  userId: string;
  listingId: string;
  active: boolean;
  /** Called at once (optimistic) and again with the old value if saving fails. */
  onChange: (active: boolean) => void;
  className?: string;
}

/** Heart to keep a listing on the favourites list (plan 6.1). */
export default function FavoriteButton({ userId, listingId, active, onChange, className }: Props) {
  const { t } = useTranslation();
  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !active;
    onChange(next);
    try {
      await setFavorite(userId, listingId, next);
    } catch {
      onChange(active);
      toast.error(t("market.errors.unknown"));
    }
  };
  return (
    <button type="button" onClick={(e) => void toggle(e)} aria-pressed={active}
      aria-label={active ? t("market.favorites.remove") : t("market.favorites.add")}
      className={cn("rounded-full bg-background/80 p-1.5 shadow-sm", className)}>
      <Heart className={cn("h-4 w-4", active ? "fill-red-500 text-red-500" : "text-foreground")} />
    </button>
  );
}
