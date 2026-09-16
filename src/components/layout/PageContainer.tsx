import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

/** Einheitlicher Seitenrahmen: gleiche Breite, gleiche Abstände auf allen Seiten. */
export default function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn("px-4 pt-6 pb-4 max-w-lg mx-auto space-y-5", className)}>
      {children}
    </div>
  );
}
