import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  /** Optionales Symbol. */
  icon?: LucideIcon;
  /** Kurze Erklärung, warum hier nichts steht. */
  title: string;
  /** Optionaler Hinweis auf den nächsten Schritt. */
  description?: string;
  /** Beschriftung der Handlung. */
  actionLabel?: string;
  onAction?: () => void;
}

/** Einheitlicher Leerzustand mit einer klaren Handlung. */
export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <Card className="border-dashed border-border/60 bg-card/50">
      <CardContent className="p-6 flex flex-col items-center text-center gap-2">
        {Icon && (
          <span className="rounded-full bg-primary/10 p-2.5">
            <Icon className="h-5 w-5 text-primary" />
          </span>
        )}
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="text-xs text-muted-foreground max-w-xs">{description}</p>}
        {actionLabel && onAction && (
          <Button size="sm" variant="outline" className="mt-1" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
