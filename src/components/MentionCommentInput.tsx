import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const QUICK_EMOJIS = ["👏", "🔥", "🪂", "🏔️", "❤️", "💪"];

interface Member {
  user_id: string;
  pilot_name: string;
}

interface MentionCommentInputProps {
  onSubmit: (message: string) => void;
  members?: Member[];
  placeholder?: string;
}

export default function MentionCommentInput({ onSubmit, members = [], placeholder }: MentionCommentInputProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredMembers = members.filter(m =>
    m.pilot_name.toLowerCase().includes(mentionQuery.toLowerCase())
  ).slice(0, 5);

  const detectMention = useCallback((text: string) => {
    const cursorPos = inputRef.current?.selectionStart ?? text.length;
    const beforeCursor = text.slice(0, cursorPos);
    const match = beforeCursor.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setShowMentions(true);
      setSelectedIdx(0);
    } else {
      setShowMentions(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    detectMention(newValue);
  };

  const insertMention = (member: Member) => {
    const cursorPos = inputRef.current?.selectionStart ?? value.length;
    const beforeCursor = value.slice(0, cursorPos);
    const afterCursor = value.slice(cursorPos);
    const replaced = beforeCursor.replace(/@\w*$/, `@${member.pilot_name} `);
    setValue(replaced + afterCursor);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions && filteredMembers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx(i => Math.min(i + 1, filteredMembers.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredMembers[selectedIdx]);
        return;
      }
      if (e.key === "Escape") {
        setShowMentions(false);
        return;
      }
    }
    if (e.key === "Enter" && value.trim()) {
      onSubmit(value.trim());
      setValue("");
      setShowMentions(false);
    }
  };

  const handleEmojiTap = (emoji: string) => {
    onSubmit(emoji);
  };

  const handleSubmit = () => {
    if (!value.trim()) return;
    onSubmit(value.trim());
    setValue("");
    setShowMentions(false);
  };

  // Close mentions on outside click
  useEffect(() => {
    if (!showMentions) return;
    const handler = () => setShowMentions(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showMentions]);

  return (
    <div className="space-y-1.5 pt-1">
      {/* Emoji quick-reactions */}
      <div className="flex items-center gap-1">
        {QUICK_EMOJIS.map(emoji => (
          <button
            key={emoji}
            onClick={() => handleEmojiTap(emoji)}
            className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted active:scale-90 transition-transform text-sm"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Input with mention dropdown */}
      <div className="relative flex items-center gap-2">
        {showMentions && filteredMembers.length > 0 && (
          <div
            className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {filteredMembers.map((m, i) => (
              <button
                key={m.user_id}
                onClick={() => insertMention(m)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm transition-colors",
                  i === selectedIdx ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                )}
              >
                <span className="font-medium">@{m.pilot_name}</span>
              </button>
            ))}
          </div>
        )}
        <Input
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || t("feed.addComment")}
          className="h-8 text-sm bg-muted/50 border-0"
        />
        {value.trim() && (
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={handleSubmit}>
            <Send className="h-4 w-4 text-primary" />
          </Button>
        )}
      </div>
    </div>
  );
}
