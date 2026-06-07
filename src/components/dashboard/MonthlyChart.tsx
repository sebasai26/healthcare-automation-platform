import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { DatosMensuales } from "@/hooks/useDashboardData";
import { Skeleton } from "@/components/ui/skeleton";

interface MonthlyChartProps {
  data: DatosMensuales[] | undefined;
  isLoading: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-4 min-w-[180px]">
      <p className="font-semibold text-foreground mb-3 border-b border-border pb-2">
        {data.mes}
      </p>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-emerald-500" />
            <span className="text-sm text-muted-foreground">Realizadas</span>
          </div>
          <span className="font-semibold text-foreground">{data.realizadas}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-red-500" />
            <span className="text-sm text-muted-foreground">Cancelaciones</span>
          </div>
          <span className="font-semibold text-foreground">{data.cancelaciones}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-blue-500" />
            <span className="text-sm text-muted-foreground">Pac. Nuevos</span>
          </div>
          <span className="font-semibold text-foreground">{data.nuevos}</span>
        </div>
      </div>
      <div className="mt-3 pt-2 border-t border-border">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total citas</span>
          <span className="font-semibold">{data.realizadas + data.cancelaciones}</span>
        </div>
      </div>
    </div>
  );
};

export function MonthlyChart({ data, isLoading }: MonthlyChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((d) => ({
      ...d,
      name: d.mesCorto,
    }));
  }, [data]);

  if (isLoading) {
    return (
      <div className="kpi-card">
        <Skeleton className="h-6 w-48 mb-4" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="kpi-card">
        <p className="text-muted-foreground text-center py-8">
          No hay datos disponibles para mostrar el gráfico
        </p>
      </div>
    );
  }

  return (
    <div className="kpi-card">
      <h4 className="text-sm font-medium text-muted-foreground mb-4">
        Evolución Mensual
      </h4>
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
            onMouseMove={(state) => {
              if (state.activeTooltipIndex !== undefined) {
                setActiveIndex(state.activeTooltipIndex);
              }
            }}
            onMouseLeave={() => setActiveIndex(null)}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              vertical={false}
              stroke="hsl(var(--border))"
            />
            <XAxis 
              dataKey="name" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            />
            <Tooltip 
              content={<CustomTooltip />}
              cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: 16 }}
              iconType="square"
              formatter={(value) => (
                <span className="text-sm text-muted-foreground">{value}</span>
              )}
            />
            <Bar 
              dataKey="realizadas" 
              name="Realizadas" 
              fill="#10b981"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            >
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-realizadas-${index}`}
                  fillOpacity={activeIndex === null || activeIndex === index ? 1 : 0.4}
                />
              ))}
            </Bar>
            <Bar 
              dataKey="cancelaciones" 
              name="Cancelaciones" 
              fill="#ef4444"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            >
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-cancelaciones-${index}`}
                  fillOpacity={activeIndex === null || activeIndex === index ? 1 : 0.4}
                />
              ))}
            </Bar>
            <Bar 
              dataKey="nuevos" 
              name="Pac. Nuevos" 
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            >
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-nuevos-${index}`}
                  fillOpacity={activeIndex === null || activeIndex === index ? 1 : 0.4}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
