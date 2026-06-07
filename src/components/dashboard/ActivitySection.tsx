import { useState, useMemo } from "react";
import { KPICard } from "./KPICard";
import { Calendar } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useControlCitas, useControlCitasFiltros, useControlCitasMensuales, WeekOption } from "@/hooks/useDashboardData";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MonthlyChart } from "./MonthlyChart";
import { DeleteDataButton } from "./DeleteDataButton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { CapacidadProductividadBlock } from "./CapacidadProductividadBlock";

type FilterType = "anual" | "mensual" | "semanal";

const PIE_COLOR_MAP: Record<string, string> = {
  "Pilates": "hsl(var(--muted-foreground))",
  "Primera sesión": "hsl(var(--foreground))",
  "Sucesivas": "hsl(var(--primary))",
  "Otros": "hsl(var(--border))",
};

function clasificarAsunto(asunto: string): string {
  const upper = asunto.toUpperCase();
  if (upper.includes("PILATES")) return "Pilates";
  if (upper.includes("SUCESIVAS") || upper.includes("SUCESIVA")) return "Sucesivas";
  if (upper.includes("1ª SESION") || upper.includes("1ª SESIÓN") || upper.includes("PRIMERA SESION") || upper.includes("PRIMERA SESIÓN")) return "Primera sesión";
  return "Otros";
}

const months = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export function ActivitySection() {
  const currentYear = new Date().getFullYear();
  const currentMonth = months[new Date().getMonth()];

  const [filterType, setFilterType] = useState<FilterType>("mensual");
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [selectedWeek, setSelectedWeek] = useState<WeekOption | undefined>(undefined);

  // Generate available years (from current year back to 2025)
  const availableYears = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear; y >= 2025; y--) {
      years.push(y);
    }
    return years;
  }, [currentYear]);

  // Get available filters from data
  const { data: filtros } = useControlCitasFiltros(selectedYear);

  // Determine filter values based on filter type
  const mesFilter = filterType === "mensual" ? selectedMonth : undefined;
  const semanaFilter = filterType === "semanal" && selectedWeek 
    ? { startDate: selectedWeek.startDate, endDate: selectedWeek.endDate } 
    : undefined;

  // Para modo semanal sin semana seleccionada, usamos un flag especial
  const modoSemanalSinSeleccion = filterType === "semanal" && !selectedWeek;

  const { data: rawData, isLoading, error } = useControlCitas(
    selectedYear,
    mesFilter,
    semanaFilter,
    modoSemanalSinSeleccion
  );

  // Datos mensuales para el gráfico anual
  const { data: datosMensuales, isLoading: isLoadingMensuales } = useControlCitasMensuales(
    filterType === "anual" ? selectedYear : undefined
  );

  // Datos para diagrama circular por tipo de cita
  const { data: pieData } = useQuery({
    queryKey: ["citas_pie_chart", selectedYear, mesFilter, semanaFilter?.startDate, semanaFilter?.endDate, modoSemanalSinSeleccion],
    staleTime: 120_000,
    queryFn: async (): Promise<{ pie: { name: string; value: number }[]; otros: { name: string; value: number }[] }> => {
      let query = supabase
        .from("listado_citas")
        .select("asunto, servicio, paciente_telefono, fecha_cita")
        .eq("anio", selectedYear)
        .like("estado", "Realizada%")
        .not("asunto", "is", null);

      if (mesFilter) {
        query = query.eq("mes", mesFilter);
      }
      if (semanaFilter) {
        query = query.gte("fecha_cita", semanaFilter.startDate).lte("fecha_cita", semanaFilter.endDate);
      }

      const { data: rows, error } = await query;
      if (error || !rows) return { pie: [], otros: [] };

      // Classify using same logic as KPI: servicio determines "Primera sesión"
      const counts: Record<string, number> = {};
      const otrosDesglose: Record<string, number> = {};
      const primerasSesionPhones = new Set<string>(); // unique phones for primera sesión

      for (const row of rows) {
        const asuntoUpper = (row.asunto || "").toUpperCase();
        const servicioLower = (row.servicio || "").toLowerCase();
        const telefono = (row.paciente_telefono || "").trim();

        // Same check as KPI in useDashboardData
        const esPrimeraVisita =
          servicioLower.includes("primera") ||
          servicioLower.includes("1ª sesion") ||
          servicioLower.includes("1a sesion") ||
          servicioLower.includes("1ª sesión");

        let tipo: string;
        if (esPrimeraVisita) {
          // Count unique phones only (same as KPI)
          if (telefono && !primerasSesionPhones.has(telefono)) {
            primerasSesionPhones.add(telefono);
            tipo = "Primera sesión";
          } else {
            // Duplicate phone for primera sesión → skip counting as primera
            if (asuntoUpper.includes("PILATES")) {
              tipo = "Pilates";
            } else {
              tipo = "Sucesivas";
            }
          }
        } else if (asuntoUpper.includes("PILATES")) {
          tipo = "Pilates";
        } else if (asuntoUpper.includes("SUCESIVAS") || asuntoUpper.includes("SUCESIVA")) {
          tipo = "Sucesivas";
        } else {
          tipo = "Otros";
          const subtipo = (row.servicio || row.asunto || "Sin especificar").trim();
          const subtipoNorm = subtipo.charAt(0).toUpperCase() + subtipo.slice(1).toLowerCase();
          otrosDesglose[subtipoNorm] = (otrosDesglose[subtipoNorm] || 0) + 1;
        }

        counts[tipo] = (counts[tipo] || 0) + 1;
      }

      const pieEntries = Object.entries(counts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      const otrosEntries = Object.entries(otrosDesglose)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      return { pie: pieEntries, otros: otrosEntries };
    },
  });

  // correctamente calculadas desde el hook (divididas por nº real de semanas/meses con datos).
  // Solo necesitamos ajustar los totales anuales a escala semanal.
  const data = useMemo(() => {
    if (!rawData) return null;
    if (!modoSemanalSinSeleccion) return rawData;
    
    // rawData.mediaCitas etc. ya están calculadas correctamente por semanas reales.
    // Usamos esas medias directamente como los valores principales.
    return {
      ...rawData,
      totalCitas: Math.round(rawData.mediaCitas),
      citasRealizadas: Math.round(rawData.mediaRealizadas),
      citasCanceladas: Math.round(rawData.mediaCancelaciones),
      nuevosPacientes: Math.round(rawData.mediaNuevos),
      // Trends no tienen sentido sin semana seleccionada
      trendCitas: 0,
      trendRealizadas: 0,
      trendCancelaciones: 0,
      trendNuevos: 0,
    };
  }, [rawData, modoSemanalSinSeleccion]);

  // Escalar los datos del gráfico circular si estamos en modo Media (divisor > 1)
  const scaledPieData = useMemo(() => {
    if (!pieData || !data || data.divisor <= 1) return pieData;
    
    const divisor = data.divisor;
    return {
      pie: pieData.pie.map(p => ({ ...p, value: Math.round(p.value / divisor) })),
      otros: pieData.otros.map(o => ({ ...o, value: Math.round(o.value / divisor) }))
    };
  }, [pieData, data]);

  // Get weeks from filtros
  const weeks = useMemo(() => {
    if (filtros?.semanas && filtros.semanas.length > 0) {
      return filtros.semanas;
    }
    return [];
  }, [filtros?.semanas]);

  // Helper para calcular variación vs media
  const calcVsMedia = (current: number, media: number) => {
    if (media === 0) return 0;
    return Math.round(((current - media) / media) * 100);
  };

  // En anual, la "media" realmente es la media mensual (anual/12), así que no la mostramos aquí.
  const showMedia = filterType !== "anual";

  // Determinar label para el trend según el tipo de filtro
  const getTrendLabel = () => {
    if (filterType === "semanal" && selectedWeek) {
      return "vs. semana anterior";
    } else if (filterType === "mensual") {
      return "vs. mes anterior";
    } else if (filterType === "anual") {
      return "vs. año anterior";
    }
    return "vs. periodo anterior";
  };
  const trendLabel = getTrendLabel();

  if (isLoading) {
    return (
      <section className="animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h3 className="section-title flex items-center gap-2 mb-0">
            <Calendar className="w-5 h-5 text-primary" />
            Control de Citas
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="kpi-card">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="animate-slide-up">
        <h3 className="section-title flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Control de Citas
        </h3>
        <div className="kpi-card">
          <p className="text-muted-foreground text-center py-8">
            Error cargando datos de citas. Sube un archivo de listado de citas primero.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="animate-slide-up">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h3 className="section-title flex items-center gap-2 mb-0">
              <Calendar className="w-5 h-5 text-primary" />
              Control de Citas
            </h3>
            {modoSemanalSinSeleccion && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                Media Semanal ({selectedYear})
              </span>
            )}
            <DeleteDataButton 
              dataType="citas" 
              year={selectedYear} 
              month={filterType === "mensual" ? selectedMonth : undefined} 
              week={filterType === "semanal" && selectedWeek ? selectedWeek.weekNum : undefined}
            />
          </div>
          
          {filterType === "mensual" && selectedYear === currentYear && selectedMonth === currentMonth && (
            <div className="mt-2 text-[10px] leading-tight bg-amber-50 text-amber-700 p-2 rounded-lg border border-amber-100 flex items-start gap-1.5 animate-in fade-in slide-in-from-top-1 max-w-xl">
              <span className="mt-0.5 shrink-0">⚠️</span>
              <p>Nota: Al ser el mes actual ({selectedMonth}), las medias mensuales y comparativas no serán definitivas hasta que finalice el periodo y se completen todos los datos.</p>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Filter Type Toggle */}
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilterType("anual")}
              className={cn(
                "transition-all text-xs px-3",
                filterType === "anual" 
                  ? "bg-card shadow-sm text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Anual
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilterType("mensual")}
              className={cn(
                "transition-all text-xs px-3",
                filterType === "mensual" 
                  ? "bg-card shadow-sm text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Mensual
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilterType("semanal")}
              className={cn(
                "transition-all text-xs px-3",
                filterType === "semanal" 
                  ? "bg-card shadow-sm text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Semanal
            </Button>
          </div>

          {/* Year Selector */}
          <Select 
            value={selectedYear.toString()} 
            onValueChange={(v) => setSelectedYear(parseInt(v))}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Month Selector (only for mensual) */}
          {filterType === "mensual" && (
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month} value={month}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Week Selector (only for semanal) */}
          {filterType === "semanal" && (
            <Select 
              value={selectedWeek?.weekNum.toString() || ""} 
              onValueChange={(v) => {
                const week = weeks.find(w => w.weekNum.toString() === v);
                setSelectedWeek(week);
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Seleccionar semana" />
              </SelectTrigger>
              <SelectContent>
                {weeks.map((week) => (
                  <SelectItem key={week.weekNum} value={week.weekNum.toString()}>
                    S{week.weekNum}: {week.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        
        <KPICard
          label="Citas Realizadas"
          value={data?.citasRealizadas || 0}
          trend={data?.trendRealizadas || 0}
          trendLabel={trendLabel}
          secondaryValue={showMedia && data?.mediaRealizadas ? `Media: ${data.mediaRealizadas}` : undefined}
          secondaryTrend={showMedia && data?.mediaRealizadas ? calcVsMedia(data.citasRealizadas, data.mediaRealizadas) : undefined}
        />
        
        <KPICard
          label="Cancelaciones"
          value={data?.citasCanceladas || 0}
          trend={data?.trendCancelaciones || 0}
          trendLabel={trendLabel}
          secondaryValue={showMedia && data?.mediaCancelaciones ? `Media: ${data.mediaCancelaciones}` : undefined}
          secondaryTrend={showMedia && data?.mediaCancelaciones ? calcVsMedia(data.citasCanceladas, data.mediaCancelaciones) : undefined}
          invertTrend
        />
        
        <KPICard
          label="Pacientes Nuevos"
          value={data?.nuevosPacientes || 0}
          trend={data?.trendNuevos || 0}
          trendLabel={trendLabel}
          secondaryValue={showMedia && data?.mediaNuevos ? `Media: ${data.mediaNuevos}` : undefined}
          secondaryTrend={showMedia && data?.mediaNuevos ? calcVsMedia(data.nuevosPacientes, data.mediaNuevos) : undefined}
        />
      </div>

      {/* Capacidad y Productividad Block - Solo en vista mensual para histórico */}
      {filterType === "mensual" && (
        <div className="mb-6">
          <CapacidadProductividadBlock year={selectedYear} month={months.indexOf(selectedMonth)} />
        </div>
      )}

      {/* Gráfico Mensual - Solo en vista anual */}
      {filterType === "anual" && (
        <div className="mb-6">
          <MonthlyChart data={datosMensuales} isLoading={isLoadingMensuales} />
        </div>
      )}

      {/* Diagrama circular por tipo de cita */}
      {scaledPieData && scaledPieData.pie && scaledPieData.pie.length > 0 && (
        <div className="kpi-card mb-6 animate-fade-in">
          <h4 className="text-sm font-semibold text-foreground mb-4">
            Distribución de Citas Realizadas por Tipo {data && data.divisor > 1 && "(Media)"}
          </h4>

          {/* Inline summary - Pilates vs Fisioterapia */}
          <div className="flex items-center gap-6 mb-6 pb-4 border-b border-border/40">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />
              <span className="text-sm text-muted-foreground">Pilates</span>
              <span className="text-lg font-bold text-foreground">
                {scaledPieData.pie.find(p => p.name === "Pilates")?.value || 0}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-foreground/50" />
              <span className="text-sm text-muted-foreground">Fisioterapia</span>
              <span className="text-lg font-bold text-foreground">
                {(() => {
                  const total = scaledPieData.pie.reduce((s, p) => s + p.value, 0);
                  const pilates = scaledPieData.pie.find(p => p.name === "Pilates")?.value || 0;
                  return total - pilates;
                })()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8 items-start">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={scaledPieData.pie}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={105}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                  >
                    {scaledPieData.pie.map((entry) => (
                      <Cell key={entry.name} fill={PIE_COLOR_MAP[entry.name] || "hsl(var(--muted))"} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [value, "Citas"]}
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))"
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Desglose de "Otros" */}
            {scaledPieData.otros && scaledPieData.otros.length > 0 && (
              <div className="border-t lg:border-t-0 lg:border-l border-border/40 pt-4 lg:pt-0 lg:pl-6 h-full flex flex-col">
                <h5 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Desglose "Otras"</h5>
                <div className="max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-border/50">
                        <TableHead className="text-xs font-medium text-muted-foreground h-8">Tipo</TableHead>
                        <TableHead className="text-right text-xs font-medium text-muted-foreground h-8">Cant.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scaledPieData.otros.map((item) => (
                        <TableRow key={item.name} className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
                          <TableCell className="text-xs py-2">{item.name}</TableCell>
                          <TableCell className="text-xs text-right font-semibold py-2">{item.value}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!data || data.totalCitas === 0) && (
        <div className="kpi-card text-center py-8">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            No hay datos de citas para este periodo.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Sube un archivo de "Listado de citas" en la sección de importar datos.
          </p>
        </div>
      )}
    </section>
  );
}