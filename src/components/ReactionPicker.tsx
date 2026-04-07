import { useState, useRef, useEffect, useCallback } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

const REACTIONS = [
  { type: "heart", emoji: "❤️" },
  { type: "fire", emoji: "🔥" },
  { type: "clap", emoji: "👏" },
  { type: "wow", emoji: "😍" },
  { type: "strong", emoji: "💪" },
  { type: "paraglider", emoji: "🪂" },
] as const;

export type ReactionType = typeof REACTIONS[number]["type"];

interface ReactionPickerProps {
  reactions: { user_id: string; reaction_type: string }[];
  currentUserId?: string;
  onReact: (reactionType: ReactionType) => void;
  size?: "sm" | "md";
}

export function getReactionEmoji(type: string): string {
  return REACTIONS.find(r => r.type === type)?.emoji || "❤️";
}

export default function ReactionPicker({ reactions, currentUserId, onReact, size = "md" }: ReactionPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>();
  const pickerRef = useRef<HTMLDivElement>(null);

  const myReaction = reactions.find(r => r.user_id === currentUserId);
  const isLiked = !!myReaction;
  const iconSize = size === "sm" ? "h-5 w-5" : "h-6 w-6";

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPicker]);

  const handleQuickTap = useCallback(() => {
    if (!isLiked) {
      setLikeAnimating(true);
      setTimeout(() => setLikeAnimating(false), 400);
    }
    onReact("heart");
  }, [isLiked, onReact]);

  const handleLongPressStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      setShowPicker(true);
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(20);
    }, 400);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    clearTimeout(longPressTimer.current);
  }, []);

  const handleSelectReaction = useCallback((type: ReactionType) => {
    setLikeAnimating(true);
    setTimeout(() => setLikeAnimating(false), 400);
    onReact(type);
    setShowPicker(false);
  }, [onReact]);

  return (
    <div className="relative" ref={pickerRef}>
      {/* Picker bubble */}
      {showPicker && (
        <div className="absolute bottom-full left-0 mb-2 bg-card border border-border rounded-full shadow-lg px-2 py-1.5 flex gap-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
          {REACTIONS.map(r => (
            <button
              key={r.type}
              onClick={() => handleSelectReaction(r.type)}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-lg hover:scale-125 transition-transform active:scale-95",
                myReaction?.reaction_type === r.type && "bg-primary/15 ring-2 ring-primary/30"
              )}
            >
              {r.emoji}
            </button>
          ))}
        </div>
      )}

      {/* Main button */}
      <button
        onClick={handleQuickTap}
        onMouseDown={handleLongPressStart}
        onMouseUp={handleLongPressEnd}
        onMouseLeave={handleLongPressEnd}
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressEnd}
        className="active:scale-90 transition-transform"
      >
        {isLiked && myReaction?.reaction_type !== "heart" ? (
          <span className={cn("inline-block text-lg transition-transform", likeAnimating && "animate-like-bounce")}>
            {getReactionEmoji(myReaction!.reaction_type)}
          </span>
        ) : (
          <Heart className={cn(iconSize, "transition-transform", isLiked ? "fill-red-500 text-red-500" : "text-foreground", likeAnimating && "animate-like-bounce")} />
        )}
      </button>
    </div>
  );
}

/** Grouped reaction badges displayed under a post */
export function ReactionBadges({ reactions }: { reactions: { user_id: string; reaction_type: string }[] }) {
  if (reactions.length === 0) return null;

  const grouped: Record<string, number> = {};
  reactions.forEach(r => { grouped[r.reaction_type] = (grouped[r.reaction_type] || 0) + 1; });

  const entries = Object.entries(grouped).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {entries.map(([type, count]) => (
        <span key={type} className="inline-flex items-center gap-0.5 text-sm bg-muted/50 rounded-full px-1.5 py-0.5">
          <span className="text-xs">{getReactionEmoji(type)}</span>
          <span className="text-xs font-medium tabular-nums">{count}</span>
        </span>
      ))}
    </div>
  );
}
