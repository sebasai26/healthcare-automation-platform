import React, { useMemo, useState } from "react";
import { Calendar, TrendingUp, Info, Star, Users, Activity, Clock, Euro } from "lucide-react";
import { KPICard } from "./KPICard";
import { useOverviewData } from "@/hooks/useOverviewData";
import { useProductividadEquipo } from "@/hooks/useDashboardData";
import { useContabilidadResumen } from "@/hooks/useContabilidad";
import { useBeneficioReal } from "@/hooks/useBeneficioReal";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
import { ActivitySection } from "./ActivitySection";
import { ServicesSection } from "./ServicesSection";
import { PhysioActivityModal } from "./PhysioActivityModal";
import { CapacidadProductividadBlock } from "./CapacidadProductividadBlock";

export function DefaultKPIView() {
  const { data, isLoading } = useOverviewData();
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const [showActivity, setShowActivity] = useState(false);
  const [showServices, setShowServices] = useState(false);
  const [expandedPhysio, setExpandedPhysio] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Get productivity data for current month
  const { data: productivityData, isLoading: productivityLoading } = useProductividadEquipo(currentYear, currentMonth);
  const { data: contabResumen } = useContabilidadResumen(currentYear, currentMonth);
  const getBeneficioReal = useBeneficioReal(contabResumen, false, currentMonth);

  // Check if current week has data
  const hasCurrentWeekData = useMemo(() => {
    if (!data) return false;
    const c = data.current;
    return c.citasRealizadas > 0 || c.citasCanceladas > 0 || c.totalCitas > 0;
  }, [data]);

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!data) return null;

    const current = data.current;
    const last = data.weeklyPrevious; // Media semanal del mes anterior
    const lastWeekInfo = data.lastWeekInfo;

    // Trends (comparando semana actual vs media semanal mes anterior)
    const citasTrend =
      last.citasRealizadas > 0
        ? Math.round(((current.citasRealizadas - last.citasRealizadas) / last.citasRealizadas) * 100)
        : 0;

    const nuevosTrend =
      last.nuevosPacientes > 0
        ? Math.round(((current.nuevosPacientes - last.nuevosPacientes) / last.nuevosPacientes) * 100)
        : 0;

    // Cancelaciones: calcular % de variación vs media semanal
    const cancelacionesTrend =
      last.citasCanceladas > 0
        ? Math.round(((current.citasCanceladas - last.citasCanceladas) / last.citasCanceladas) * 100)
        : 0;

    // Ticket medio: comparar con mes anterior completo
    const ticketTrend =
      last.avgTicket > 0 ? Math.round(((current.avgTicket - last.avgTicket) / last.avgTicket) * 100) : 0;

    // LTV: comparar con mes anterior completo
    const ltvTrend = last.ltv > 0 ? Math.round(((current.ltv - last.ltv) / last.ltv) * 100) : 0;

    return {
      weekLabel: lastWeekInfo.label,
      lastMonth: last.monthName,
      lastYear: last.year,
      hasData: hasCurrentWeekData,
      // Citas
      currentCitas: current.citasRealizadas,
      lastCitas: last.citasRealizadas,
      citasTrend,
      // Cancelaciones
      currentCancelaciones: current.citasCanceladas,
      lastCancelaciones: last.citasCanceladas,
      cancelacionesTrend,
      // Nuevos pacientes
      currentNuevos: current.nuevosPacientes,
      lastNuevos: last.nuevosPacientes,
      nuevosTrend,
      // Revenue
      currentRevenue: current.totalRevenue,
      // Ticket medio
      currentTicket: current.avgTicket,
      lastTicket: last.avgTicket,
      ticketTrend,
      // Top service (ahora de la semana)
      topService: current.topService,
      // LTV
      ltv: current.ltv,
      lastLtv: last.ltv,
      ltvTrend,
      // Current month name
      currentMonthName: current.monthName,
    };
  }, [data, hasCurrentWeekData]);

  const getOccupancyColor = (occupancy: number) => {
    if (occupancy >= 80) return "text-success";
    if (occupancy >= 60) return "text-primary";
    return "text-warning";
  };

  if (isLoading || !metrics) {
    return (
      <section className="animate-slide-up">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-xl font-semibold text-foreground">Resumen Semanal</h2>
          </div>
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="kpi-card">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="kpi-card">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  const mediaLabel = `Media sem. ${metrics.lastMonth}`;

  const MONTH_NAMES = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const currentMonthLabel = MONTH_NAMES[currentMonth];

  return (
    <section className="animate-slide-up space-y-8">
      {/* Header con contexto temporal */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg md:text-xl font-semibold text-foreground mb-1">Resumen Semanal</h2>
          <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-1 md:gap-2 flex-wrap">
            <Calendar className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
            <span>Comparando</span> <span className="font-medium text-foreground">{metrics.weekLabel}</span>{" "}
            <span>vs</span>{" "}
            <span className="font-medium text-foreground">
              {metrics.lastMonth} {metrics.lastYear}
            </span>
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger>
            <Info className="w-5 h-5 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>
              Datos de la última semana con registros comparados con la media semanal del mes anterior. Para análisis
              histórico completo, usa la sección "Histórico / Avanzado".
            </p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* KPIs de Actividad + Servicio Top Semanal */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Actividad
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          <KPICard
            label="Citas Realizadas"
            value={metrics.hasData ? metrics.currentCitas : undefined}
            trend={metrics.hasData ? metrics.citasTrend : undefined}
            trendLabel={metrics.hasData ? `vs. ${mediaLabel}` : undefined}
            secondaryValue={`${mediaLabel}: ${metrics.lastCitas}`}
            tooltip="Número de citas completadas en la semana"
            status={metrics.hasData ? (metrics.currentCitas >= metrics.lastCitas ? "good" : "warning") : "neutral"}
            pendingData={!metrics.hasData}
          />

          <KPICard
            label="Cancelaciones"
            value={metrics.hasData ? metrics.currentCancelaciones : undefined}
            trend={metrics.hasData ? metrics.cancelacionesTrend : undefined}
            trendLabel={metrics.hasData ? `vs. ${mediaLabel}` : undefined}
            secondaryValue={`${mediaLabel}: ${metrics.lastCancelaciones}`}
            tooltip="Citas canceladas. Menos es mejor."
            status={
              metrics.hasData ? (metrics.currentCancelaciones <= metrics.lastCancelaciones ? "good" : "bad") : "neutral"
            }
            invertTrend
            pendingData={!metrics.hasData}
          />

          <KPICard
            label="Pacientes Nuevos"
            value={metrics.hasData ? metrics.currentNuevos : undefined}
            trend={metrics.hasData ? metrics.nuevosTrend : undefined}
            trendLabel={metrics.hasData ? `vs. ${mediaLabel}` : undefined}
            secondaryValue={`${mediaLabel}: ${metrics.lastNuevos}`}
            tooltip="Nuevos pacientes captados"
            status={metrics.hasData ? (metrics.currentNuevos >= metrics.lastNuevos ? "good" : "warning") : "neutral"}
            pendingData={!metrics.hasData}
          />

        </div>

        {/* Desglose Pilates vs Fisioterapia + Pie chart */}
        {metrics.hasData && data?.current?.pieData && data.current.pieData.length > 0 && (
          <>
            <div className="kpi-card animate-fade-in mt-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">
                Distribución de Citas Realizadas por Tipo
              </h4>

              {/* Inline summary */}
              <div className="flex items-center gap-6 mb-4 pb-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />
                  <span className="text-sm text-muted-foreground">Pilates</span>
                  <span className="text-lg font-bold text-foreground">{data.current.citasPilates}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-foreground/50" />
                  <span className="text-sm text-muted-foreground">Fisioterapia</span>
                  <span className="text-lg font-bold text-foreground">{data.current.citasFisioterapia}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.current.pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                      >
                        {data.current.pieData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={
                              entry.name === "Pilates" ? "hsl(var(--muted-foreground))" :
                              entry.name === "Primera sesión" ? "hsl(var(--foreground))" :
                              entry.name === "Sucesivas" ? "hsl(var(--primary))" : "hsl(var(--border))"
                            }
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip
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
                {data.current.otrosDesglose && data.current.otrosDesglose.length > 0 && (
                  <div className="border-t lg:border-t-0 lg:border-l border-border/40 pt-4 lg:pt-0 lg:pl-5 h-full flex flex-col">
                    <h5 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Desglose "Otras"</h5>
                    <div className="max-h-56 overflow-y-auto pr-2 custom-scrollbar">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border/50">
                            <th className="text-left font-medium text-muted-foreground text-xs pb-1.5">Tipo</th>
                            <th className="text-right font-medium text-muted-foreground text-xs pb-1.5">Cant.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.current.otrosDesglose.map((item) => (
                            <tr key={item.name} className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
                              <td className="text-xs py-1.5 truncate max-w-[180px]" title={item.name}>{item.name}</td>
                              <td className="text-xs text-right font-semibold py-1.5">{item.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Resumen Mensual */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-lg md:text-xl font-semibold text-foreground">Resumen Mensual</h2>
          <span className="text-xs md:text-sm text-muted-foreground flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            {currentMonthLabel} {currentYear} (hasta la fecha)
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground/70 mb-3">
          ℹ️ El ticket medio y LTV pueden no ser del todo precisos si los ingresos del mes no se subieron el lunes de
          esta semana.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <KPICard
            label="Ingresos del Mes"
            value={metrics.hasData ? `${metrics.currentRevenue.toLocaleString()}€` : undefined}
            tooltip="Total de ingresos registrados hasta la fecha"
            status={metrics.hasData ? "neutral" : "neutral"}
            pendingData={!metrics.hasData}
          />

          <KPICard
            label="Ticket Medio"
            value={metrics.hasData ? `${metrics.currentTicket}€` : undefined}
            trend={metrics.hasData ? metrics.ticketTrend : undefined}
            trendLabel={metrics.hasData ? `vs. ${metrics.lastMonth}` : undefined}
            secondaryValue={`${metrics.lastMonth}: ${metrics.lastTicket}€`}
            tooltip="Ingreso promedio por cita realizada"
            status={metrics.hasData ? (metrics.currentTicket >= metrics.lastTicket ? "good" : "warning") : "neutral"}
            pendingData={!metrics.hasData}
          />

          <KPICard
            label="LTV Estimado"
            value={metrics.hasData ? `${metrics.ltv.toLocaleString()}€` : undefined}
            trend={metrics.hasData ? metrics.ltvTrend : undefined}
            trendLabel={metrics.hasData ? `vs. ${metrics.lastMonth}` : undefined}
            secondaryValue={`${metrics.lastMonth}: ${metrics.lastLtv.toLocaleString()}€`}
            tooltip="Ticket medio × 6 meses"
            status={metrics.hasData ? (metrics.ltv >= metrics.lastLtv ? "good" : "warning") : "neutral"}
            pendingData={!metrics.hasData}
          />

          {/* Servicio Top del Mes */}
          <div className="kpi-card animate-fade-in">
            <div className="flex items-center gap-1 mb-2">
              <p className="kpi-label flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-primary" />
                Servicio Top
              </p>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3.5 h-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Servicio con más ingresos registrado en el mes de {metrics.currentMonthName}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            {metrics.hasData && metrics.topService ? (
              <>
                <p className="text-base md:text-lg font-semibold text-foreground truncate" title={metrics.topService.name}>
                  {metrics.topService.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {metrics.topService.revenue.toLocaleString()}€ · {metrics.topService.sessions} sesiones
                </p>
              </>
            ) : (
              <p className="text-lg font-semibold text-muted-foreground">-</p>
            )}
          </div>
        </div>

        {/* Capacidad y Productividad */}
        <CapacidadProductividadBlock year={currentYear} month={currentMonth} />
      </div>

      {/* Productividad del Mes */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-lg md:text-xl font-semibold text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Productividad del Equipo
          </h3>
          <span className="text-xs md:text-sm text-muted-foreground">
            {currentMonthLabel} {currentYear}
          </span>
        </div>

        {productivityLoading ? (
          <div className="kpi-card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Profesional</th>
                    <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Citas</th>
                    <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Ocupación</th>
                    <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Horas</th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Facturación</th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground">€ neto/hora</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4].map((i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-4 px-4">
                        <Skeleton className="h-4 w-32" />
                      </td>
                      <td className="py-4 px-4 text-center">
                        <Skeleton className="h-4 w-12 mx-auto" />
                      </td>
                      <td className="py-4 px-4 text-center">
                        <Skeleton className="h-4 w-16 mx-auto" />
                      </td>
                      <td className="py-4 px-4 text-center">
                        <Skeleton className="h-4 w-12 mx-auto" />
                      </td>
                      <td className="py-4 px-4 text-right">
                        <Skeleton className="h-4 w-20 ml-auto" />
                      </td>
                      <td className="py-4 px-4 text-right">
                        <Skeleton className="h-4 w-16 ml-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : !productivityData || productivityData.length === 0 ? (
          <div className="kpi-card">
            <p className="text-muted-foreground text-center py-8">
              Sin datos de productividad para {currentMonthLabel} {currentYear}. Sube los CSVs para comenzar.
            </p>
          </div>
        ) : (
          <div className="kpi-card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Profesional
                      </span>
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-muted-foreground">
                      <span className="flex items-center justify-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Citas
                      </span>
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-muted-foreground">
                      <span className="flex items-center justify-center gap-2">
                        <Activity className="w-4 h-4" />
                        Ocupación
                      </span>
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-muted-foreground">
                      <span className="flex items-center justify-center gap-2">
                        <Clock className="w-4 h-4" />
                        Horas
                      </span>
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground">
                      <span className="flex items-center justify-end gap-2">
                        <Euro className="w-4 h-4" />
                        Facturación
                      </span>
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground">
                      <span className="flex items-center justify-end gap-2">
                        <Euro className="w-4 h-4" />
                        € neto/hora
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {productivityData.map((physio) => {
                    const beneficio = getBeneficioReal(physio.name);
                    const displayBeneficio = beneficio;

                    return (
                    <React.Fragment key={physio.name}>
                      <tr 
                        className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => {
                          setExpandedPhysio(physio.name);
                          setIsModalOpen(true);
                        }}
                      >
                        <td className="py-4 px-4">
                          <span className="font-medium text-foreground">{physio.name}</span>
                        </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-foreground font-semibold">{physio.appointments}</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        {physio.name.toLowerCase().includes('cristina ponce') ? (
                          <span className="font-semibold min-w-[3rem] text-muted-foreground">
                            N/A
                          </span>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <div className="relative w-16 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`absolute top-0 left-0 h-full rounded-full transition-all duration-300 ${physio.occupancy >= 80 ? "bg-green-500" : physio.occupancy >= 60 ? "bg-blue-500" : "bg-amber-500"}`}
                                style={{ width: `${Math.min(Math.round(physio.occupancy), 100)}%` }}
                              />
                            </div>
                            <span className={`font-semibold min-w-[3rem] ${getOccupancyColor(physio.occupancy)}`}>
                              {Math.round(physio.occupancy)}%
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-foreground font-semibold">
                          {physio.hours > 0 ? physio.hours.toFixed(1) : "-"}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="font-semibold text-foreground">{physio.revenue.toLocaleString("es-ES")}€</span>
                      </td>
                      <td className={`py-4 px-4 text-right font-semibold ${displayBeneficio && displayBeneficio !== 0 ? (displayBeneficio > 0 ? "text-green-500" : "text-red-500") : "text-muted-foreground"}`}>
                        {physio.hours > 0 && displayBeneficio !== null && displayBeneficio !== undefined
                          ? `${(displayBeneficio / physio.hours).toFixed(2)}€` 
                          : "-"}
                      </td>
                    </tr>
                  </React.Fragment>
                  );
                })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50 font-semibold">
                    <td className="py-4 px-4 text-foreground">Total / Media</td>
                    <td className="py-4 px-4 text-center text-foreground">
                      {productivityData.reduce((sum, p) => sum + p.appointments, 0)}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span
                        className={getOccupancyColor(
                          (() => {
                            const filtered = productivityData.filter(p => !p.name.toLowerCase().includes('cristina ponce'));
                            return filtered.length > 0 ? filtered.reduce((sum, p) => sum + p.occupancy, 0) / filtered.length : 0;
                          })()
                        )}
                      >
                        {Math.round(
                          (() => {
                            const filtered = productivityData.filter(p => !p.name.toLowerCase().includes('cristina ponce'));
                            return filtered.length > 0 ? filtered.reduce((sum, p) => sum + p.occupancy, 0) / filtered.length : 0;
                          })()
                        )}
                        %
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center text-foreground">
                      {productivityData.reduce((sum, p) => sum + p.hours, 0).toFixed(1)}
                    </td>
                    <td className="py-4 px-4 text-right text-foreground">
                      {productivityData.reduce((sum, p) => sum + p.revenue, 0).toLocaleString("es-ES")}€
                    </td>
                    <td className="py-4 px-4 text-right text-muted-foreground">
                      -
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {expandedPhysio && (
        <PhysioActivityModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setExpandedPhysio(null);
          }}
          physioName={expandedPhysio}
          year={currentYear}
          month={currentMonth}
        />
      )}
    </section>
  );
}
