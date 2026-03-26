import { Card, CardContent } from "@/components/ui/card";

interface RankedListProps {
  title: string;
  items: { name: string; count: number }[];
}

export default function RankedList({ title, items }: RankedListProps) {
  if (items.length === 0) return null;
  const max = items[0].count;

  return (
    <div>
      <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{title}</h2>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3 space-y-2">
          {items.map((item, i) => (
            <div key={item.name} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-4 tabular-nums">{i + 1}.</span>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-xs font-medium truncate">{item.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{item.count}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${(item.count / max) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
