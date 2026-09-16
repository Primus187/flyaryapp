import { Skeleton } from "@/components/ui/skeleton";
import PageContainer from "@/components/layout/PageContainer";

interface LoadingStateProps {
  /** Anzahl der Platzhalterkarten. */
  rows?: number;
  /** Zeigt eine Kopfzeile als Platzhalter. */
  header?: boolean;
}

/** Einheitlicher Ladezustand für ganze Seiten. */
export default function LoadingState({ rows = 3, header = true }: LoadingStateProps) {
  return (
    <PageContainer>
      {header && (
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl" />
      ))}
    </PageContainer>
  );
}
