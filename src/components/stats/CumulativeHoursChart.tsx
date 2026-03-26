import { Card, CardContent } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface CumulativeHoursChartProps {
  title: string;
  data: { date: string; hours: number }[];
  tooltipLabel: string;
}

export default function CumulativeHoursChart({ title, data, tooltipLabel }: CumulativeHoursChartProps) {
  return (
    <div>
      <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{title}</h2>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(0, 7)} interval={Math.max(1, Math.floor(data.length / 6))} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [`${v}h`, tooltipLabel]} labelFormatter={l => l} />
              <Line type="monotone" dataKey="hours" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
