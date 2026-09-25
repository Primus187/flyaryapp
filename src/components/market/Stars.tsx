import { Star, StarHalf } from "lucide-react";
import { cn } from "@/lib/utils";
import { starFills } from "@/lib/marketplace-reviews";

/** Five stars for an average rating (plan 8.1). */
export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center text-amber-500", className)} aria-hidden>
      {starFills(value).map((fill, i) => fill === 0.5
        ? <StarHalf key={i} className="h-3.5 w-3.5 fill-current" />
        : <Star key={i} className={cn("h-3.5 w-3.5", fill === 1 ? "fill-current" : "text-muted-foreground/40")} />)}
    </span>
  );
}

/** Picking 1–5 stars. */
export function StarInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: (n: number) => string }) {
  return (
    <div className="flex justify-center gap-1" role="radiogroup">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={label(n)} onClick={() => onChange(n)} className="p-1">
          <Star className={cn("h-8 w-8", n <= value ? "fill-amber-500 text-amber-500" : "text-muted-foreground/40")} />
        </button>
      ))}
    </div>
  );
}
