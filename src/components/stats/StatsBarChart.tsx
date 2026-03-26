import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

interface StatsBarChartProps {
  title: string;
  data: Record<string, any>[];
  dataKey: string;
  config: Record<string, { label: string; color: string }>;
  xInterval?: number;
}

export default function StatsBarChart({ title, data, dataKey, config, xInterval = 1 }: StatsBarChartProps) {
  return (
    <div>
      <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{title}</h2>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3">
          <ChartContainer config={config} className="h-[180px] w-full">
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={xInterval} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey={dataKey} fill={`var(--color-${dataKey})`} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
