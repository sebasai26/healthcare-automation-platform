import { useState, useMemo } from "react";
import { TrendingUp, Info, Calendar } from "lucide-react";
import { KPICard } from "./KPICard";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIngresos, useIngresosHistorial, useIngresosAniosDisponibles } from "@/hooks/useDashboardData";
import { useContabilidadResumen } from "@/hooks/useContabilidad";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import { DeleteDataButton } from "./DeleteDataButton";

interface RevenueData {
  averageTicket: number;
  ticketTrend?: number;
  weeklyRevenue: number;
  weeklyTrend: number;
  physioRevenue: { name: string; revenue: number }[];
}

interface RevenueSectionProps {
  data?: RevenueData;
}

const months = [
  { value: "all", label: "Todo el año" },
  { value: "0", label: "Enero" },
  { value: "1", label: "Febrero" },
  { value: "2", label: "Marzo" },
  { value: "3", label: "Abril" },
  { value: "4", label: "Mayo" },
  { value: "5", label: "Junio" },
  { value: "6", label: "Julio" },
  { value: "7", label: "Agosto" },
  { value: "8", label: "Septiembre" },
  { value: "9", label: "Octubre" },
  { value: "10", label: "Noviembre" },
  { value: "11", label: "Diciembre" },
];

export function RevenueSection({ data }: RevenueSectionProps) {
  const currentYear = new Date().getFullYear();

  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");

  const yearNum = parseInt(selectedYear);
  const monthNum = selectedPeriod === "all" ? undefined : parseInt(selectedPeriod);

  // Determine if we're showing annual or monthly view
  const isAnnualView = selectedPeriod === "all";

  const { data: dbData, isLoading, error } = useIngresos(yearNum, monthNum);
  const { data: historialData, isLoading: isLoadingHistorial } = useIngresosHistorial(yearNum);
  const { data: aniosDisponibles } = useIngresosAniosDisponibles();
  const { data: contabResumen } = useContabilidadResumen(yearNum, monthNum);

  const availableYears = useMemo(() => {
    const years: { value: string; label: string }[] = [];
    // Generate years from current year back to 2025
    for (let y = currentYear; y >= 2025; y--) {
      years.push({ value: y.toString(), label: y.toString() });
    }
    return years;
  }, [currentYear]);

  const displayData = data ||
    dbData || {
    averageTicket: 0,
    ticketTrend: 0,
    weeklyRevenue: 0,
    weeklyTrend: 0,
    physioRevenue: [],
  };

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!historialData) return [];
    return historialData.map((item) => ({
      name: item.mes.substring(0, 3),
      total: item.total,
      efectivo: item.efectivo,
      tarjeta: item.tarjeta,
      transferencia: item.talon_transferencia,
    }));
  }, [historialData]);

  const totalAnual = useMemo(() => {
    if (!historialData) return 0;
    return historialData.reduce((sum, item) => sum + item.total, 0);
  }, [historialData]);

  const MONTH_KEYS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"] as const;

  const beneficioNeto = useMemo(() => {
    if (!contabResumen?.beneficioNeto) return null;
    if (isAnnualView) return contabResumen.beneficioNeto['total'] || 0;
    return contabResumen.beneficioNeto[MONTH_KEYS[monthNum!]] || 0;
  }, [contabResumen, isAnnualView, monthNum]);

  if (isLoading) {
    return (
      <section className="animate-slide-up">
        <h3 className="section-title flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Ingresos y Rentabilidad
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="kpi-card">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
        <div className="kpi-card">
          <Skeleton className="h-4 w-40 mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="animate-slide-up">
        <h3 className="section-title flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Ingresos y Rentabilidad
        </h3>
        <div className="kpi-card">
          <p className="text-muted-foreground text-center py-8">Error cargando datos de ingresos</p>
        </div>
      </section>
    );
  }

  return (
    <section className="animate-slide-up">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h3 className="section-title flex items-center gap-2 mb-0">
            <TrendingUp className="w-5 h-5 text-primary" />
            Ingresos y Rentabilidad
          </h3>
          <DeleteDataButton dataType="ingresos" year={yearNum} month={selectedPeriod} />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select
              value={selectedYear}
              onValueChange={(v) => {
                setSelectedYear(v);
                setSelectedPeriod("all");
              }}
            >
              <SelectTrigger className="w-24">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => (
                  <SelectItem key={year.value} value={year.value}>
                    {year.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <KPICard
          label={isAnnualView ? "Ingresos Anuales" : "Ingresos Mensuales"}
          value={`${displayData.weeklyRevenue.toLocaleString()}€`}
          trend={displayData.weeklyTrend}
          trendLabel={isAnnualView ? "vs. año anterior" : "vs. mes anterior"}
        />

        <KPICard
          label="Ingresos Netos"
          value={beneficioNeto !== null ? `${beneficioNeto.toLocaleString('es-ES')}€` : '—'}
          tooltip="Ingresos totales menos gastos totales del periodo (excluyendo conceptos fiscales)"
          status={beneficioNeto !== null ? (beneficioNeto > 0 ? 'good' : 'bad') : 'neutral'}
        />
      </div>

      {/* Chart (only for annual view) */}
      {isAnnualView && (
        <>
          {isLoadingHistorial ? (
            <div className="kpi-card">
              <Skeleton className="h-64 w-full" />
            </div>
          ) : chartData.length > 0 ? (
            <div className="kpi-card">
              <p className="kpi-label mb-4">Evolución de Ingresos {selectedYear}</p>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(value) => `${value}€`} />
                    <RechartsTooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const total = payload.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);
                          return (
                            <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                              <p className="font-semibold text-foreground mb-2">{label}</p>
                              <p className="text-lg font-bold text-primary mb-2">Total: {total.toLocaleString()}€</p>
                              <div className="space-y-1 text-xs text-muted-foreground">
                                {payload.map((entry, index) => (
                                  <div key={index} className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                    <span>
                                      {entry.name}: {Number(entry.value).toLocaleString()}€
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    <Bar dataKey="efectivo" name="Efectivo" fill="#22c55e" stackId="a" />
                    <Bar dataKey="tarjeta" name="Tarjeta" fill="#3b82f6" stackId="a" />
                    <Bar dataKey="transferencia" name="Transferencia" fill="#f59e0b" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="kpi-card">
              <p className="text-muted-foreground text-center py-8">
                No hay datos de ingresos para {selectedYear}. Sube un archivo de "Analisis de caja" para ver el
                histórico.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
