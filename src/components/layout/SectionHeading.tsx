import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  title: string;
  action?: React.ReactNode;
  className?: string;
}

/** Einheitliche Abschnittsüberschrift innerhalb einer Seite. */
export default function SectionHeading({ title, action, className }: SectionHeadingProps) {
  return (
    <div className={cn("flex items-center justify-between mb-2 px-1", className)}>
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h2>
      {action}
    </div>
  );
}
