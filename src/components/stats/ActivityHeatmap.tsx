import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";

interface ActivityHeatmapProps {
  title: string;
  year: number;
  days: Record<string, number>;
}

export default function ActivityHeatmap({ title, year, days }: ActivityHeatmapProps) {
  const { t } = useTranslation();

  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  const weeks: { date: Date; count: number }[][] = [];
  let currentWeek: { date: Date; count: number }[] = [];

  const firstDay = startDate.getDay();
  for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
    currentWeek.push({ date: new Date(0), count: -1 });
  }

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    const dayOfWeek = d.getDay();
    currentWeek.push({ date: new Date(d), count: days[dateStr] || 0 });
    if (dayOfWeek === 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  const getColor = (count: number) => {
    if (count < 0) return "transparent";
    if (count === 0) return "hsl(var(--muted))";
    if (count === 1) return "hsl(var(--primary) / 0.3)";
    if (count === 2) return "hsl(var(--primary) / 0.5)";
    return "hsl(var(--primary) / 0.8)";
  };

  return (
    <div>
      <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{title}</h2>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3">
          <div className="overflow-x-auto">
            <div className="flex gap-[2px]" style={{ minWidth: weeks.length * 12 }}>
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[2px]">
                  {week.map((day, di) => (
                    <div
                      key={di}
                      className="rounded-[2px]"
                      style={{ width: 10, height: 10, backgroundColor: getColor(day.count) }}
                      title={day.count >= 0 ? `${day.date.toLocaleDateString()}: ${day.count} ${t("stats.flights")}` : ""}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
