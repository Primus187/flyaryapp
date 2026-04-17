import { useState, KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}

function normalize(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/^#/, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9äöüéèà_-]/g, "")
    .slice(0, 24);
}

export default function TagsInput({ value, onChange, suggestions = [], placeholder }: Props) {
  const [input, setInput] = useState("");

  const addTag = (raw: string) => {
    const t = normalize(raw);
    if (!t || value.includes(t) || value.length >= 8) return;
    onChange([...value, t]);
    setInput("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      if (input.trim()) {
        e.preventDefault();
        addTag(input);
      }
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const filteredSuggestions = suggestions
    .filter((s) => !value.includes(s) && (!input || s.includes(normalize(input))))
    .slice(0, 6);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 pr-1">
            #{tag}
            <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => input.trim() && addTag(input)}
        placeholder={placeholder || "#thermik, #abendflug..."}
        disabled={value.length >= 8}
      />
      {filteredSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filteredSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              className="text-[11px] px-2 py-0.5 rounded-full border border-border/60 bg-card hover:bg-muted/50 text-muted-foreground"
            >
              #{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
