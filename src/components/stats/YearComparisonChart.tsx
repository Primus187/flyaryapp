import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

interface YearComparisonChartProps {
  title: string;
  data: { label: string; current: number; previous: number }[];
  currentLabel: string;
  previousLabel: string;
}

export default function YearComparisonChart({ title, data, currentLabel, previousLabel }: YearComparisonChartProps) {
  const config = {
    current: { label: currentLabel, color: "hsl(var(--primary))" },
    previous: { label: previousLabel, color: "hsl(var(--muted-foreground) / 0.4)" },
  };

  return (
    <div>
      <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{title}</h2>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3">
          <ChartContainer config={config} className="h-[180px] w-full">
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={1} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="previous" fill="var(--color-previous)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="current" fill="var(--color-current)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
