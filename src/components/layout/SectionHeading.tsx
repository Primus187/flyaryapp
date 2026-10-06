import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  title: string;
  action?: React.ReactNode;
  className?: string;
}

/** Einheitliche Abschnittsüberschrift innerhalb einer Seite. */
export default function SectionHeading({ title, action, className }: SectionHeadingProps) {
  return (
    <div className={cn("flex items-center justify-between mb-2 min-h-8", className)}>
      <h2 className="eyebrow">{title}</h2>
      {action}
    </div>
  );
}
