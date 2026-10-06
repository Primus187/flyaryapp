import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

/** Einheitlicher Seitenrahmen: gleiche Breite, gleiche Abstände auf allen Seiten. */
export default function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn("px-5 pt-5 pb-6 max-w-lg mx-auto space-y-4", className)}>
      {children}
    </div>
  );
}
