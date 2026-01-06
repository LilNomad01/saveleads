import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";

interface ChartData {
  date: string;
  leads: number;
  messages: number;
  delivered: number;
}

interface PerformanceChartProps {
  data: ChartData[];
  className?: string;
}

export function PerformanceChart({ data, className }: PerformanceChartProps) {
  return (
    <div
      className={cn(
        "bg-card rounded-xl p-6 shadow-card border border-border",
        className
      )}
    >
      <div className="mb-6">
        <h3 className="font-semibold text-foreground">
          Desempenho da Semana
        </h3>
        <p className="text-sm text-muted-foreground">
          Extrações e disparos por dia
        </p>
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(215, 50%, 23%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(215, 50%, 23%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(152, 69%, 45%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(152, 69%, 45%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 20%, 90%)" />
            <XAxis
              dataKey="date"
              stroke="hsl(215, 15%, 45%)"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              stroke="hsl(215, 15%, 45%)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(0, 0%, 100%)",
                border: "1px solid hsl(210, 20%, 90%)",
                borderRadius: "8px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="leads"
              name="Leads Extraídos"
              stroke="hsl(215, 50%, 23%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorLeads)"
            />
            <Area
              type="monotone"
              dataKey="messages"
              name="Mensagens Enviadas"
              stroke="hsl(152, 69%, 45%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorMessages)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
