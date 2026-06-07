import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const MONTH_KEYS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

function getPreviousMonth(year: number, month: number, offset = 1) {
  let m = month - offset;
  let y = year;
  while (m < 0) { m += 12; y -= 1; }
  return { year: y, month: m };
}

export interface OverviewMetrics {
  current: MonthMetrics;
  weeklyPrevious: MonthMetrics; // Media semanal del mes anterior (para Resumen Semanal)
  previous: MonthMetrics;       // Mes anterior completo (para alertas)
  previous2: MonthMetrics;      // 2 meses atrás completo
  previous3: MonthMetrics;      // 3 meses atrás completo
}

export interface PieEntry {
  name: string;
  value: number;
}

export interface MonthMetrics {
  year: number;
  month: number;
  monthName: string;
  // Productivity
  professionals: ProfessionalData[];
  avgOccupancy: number;
  totalHours: number;
  // Revenue
  totalRevenue: number;
  avgTicket: number;
  // Appointments
  totalCitas: number;
  citasRealizadas: number;
  citasCanceladas: number;
  nuevosPacientes: number;
  citasPilates: number;
  citasFisioterapia: number;
  pieData: PieEntry[];
  otrosDesglose: PieEntry[];
  // Top service (solo para current)
  topService?: { name: string; revenue: number; sessions: number };
  // LTV
  ltv: number;
}

export interface ProfessionalData {
  name: string;
  occupancy: number;
  appointments: number;
  revenue: number;
  hours: number;
  euroPerHour: number;
}

/**
 * Hook centralizado para el panel Overview
 * Carga todos los datos necesarios en UNA consulta batch para evitar duplicados
 */
export interface LastWeekInfo {
  startDate: Date;
  endDate: Date;
  label: string;
}

function classifyCitas(realizadas: any[]): {
  citasPilates: number;
  citasFisioterapia: number;
  pieData: PieEntry[];
  otrosDesglose: PieEntry[];
} {
  const counts: Record<string, number> = {};
  const otrosMap: Record<string, number> = {};
  const primeraPhones = new Set<string>();

  for (const row of realizadas) {
    const asuntoUpper = (row.asunto || "").toUpperCase();
    const servicioLower = (row.servicio || "").toLowerCase();
    const telefono = (row.paciente_telefono || "").trim();

    const esPrimeraVisita =
      servicioLower.includes("primera") ||
      servicioLower.includes("1ª sesion") ||
      servicioLower.includes("1a sesion") ||
      servicioLower.includes("1ª sesión");

    let tipo: string;
    if (esPrimeraVisita) {
      if (telefono && !primeraPhones.has(telefono)) {
        primeraPhones.add(telefono);
        tipo = "Primera sesión";
      } else {
        tipo = asuntoUpper.includes("PILATES") ? "Pilates" : "Sucesivas";
      }
    } else if (asuntoUpper.includes("PILATES")) {
      tipo = "Pilates";
    } else if (asuntoUpper.includes("SUCESIVAS") || asuntoUpper.includes("SUCESIVA")) {
      tipo = "Sucesivas";
    } else {
      tipo = "Otros";
      const subtipo = (row.servicio || row.asunto || "Sin especificar").trim();
      const subtipoNorm = subtipo.charAt(0).toUpperCase() + subtipo.slice(1).toLowerCase();
      otrosMap[subtipoNorm] = (otrosMap[subtipoNorm] || 0) + 1;
    }
    counts[tipo] = (counts[tipo] || 0) + 1;
  }

  const pilates = counts["Pilates"] || 0;
  const total = Object.values(counts).reduce((s, v) => s + v, 0);

  return {
    citasPilates: pilates,
    citasFisioterapia: total - pilates,
    pieData: Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    otrosDesglose: Object.entries(otrosMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
  };
}

export function useOverviewData() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Los 4 meses que necesitamos: actual + 3 anteriores (para alertas y comparaciones)
  const months = [
    { year: currentYear, month: currentMonth },
    getPreviousMonth(currentYear, currentMonth, 1),
    getPreviousMonth(currentYear, currentMonth, 2),
    getPreviousMonth(currentYear, currentMonth, 3),
  ];

  const query = useQuery({
    queryKey: ["overview_data", currentYear, currentMonth],
    staleTime: 5 * 60_000, // 5 minutos
    gcTime: 30 * 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<OverviewMetrics & { lastWeekInfo: LastWeekInfo }> => {
      // Batch queries - all in parallel
      const [ocupacion, citas, balance, horas, balanceMensual, listadoCitas, analisisServicios, extras] = await Promise.all([
        supabase.from("ocupacion_profesional" as any).select("*").in("anio", [...new Set(months.map(m => m.year))]),
        supabase.from("citas_profesional" as any).select("*").in("anio", [...new Set(months.map(m => m.year))]),
        supabase.from("balance_profesional" as any).select("*").in("anio", [...new Set(months.map(m => m.year))]),
        supabase.from("horas_profesional").select("*").in("anio", [...new Set(months.map(m => m.year))]),
        supabase.from("balance_mensual" as any).select("*").in("anio", [...new Set(months.map(m => m.year))]),
        // Para citas, cargamos solo los 4 meses específicos
        fetchListadoCitasMultiMonth(months),
        // Servicios del año actual con fechas para filtrar por semana
        supabase.from("analisis_servicios").select("servicio,importe_total,num_citas,fecha_inicio,fecha_fin,periodo_tipo,mes").eq("anio", currentYear),
        // Extras
        supabase.from("citas_extras_profesional" as any).select("*").in("anio", [...new Set(months.map(m => m.year))]),
      ]);

      if (ocupacion.error) throw ocupacion.error;
      if (citas.error) throw citas.error;
      if (balance.error) throw balance.error;
      if (horas.error) throw horas.error;
      if (balanceMensual.error) throw balanceMensual.error;

      // Encontrar la última semana con datos
      const allDates = listadoCitas.map(c => new Date(c.fecha_cita)).filter(d => !isNaN(d.getTime()));
      const maxDate = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => d.getTime()))) : new Date();
      
      // Calcular el inicio de la semana (lunes) de la última fecha con datos
      const dayOfWeek = maxDate.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStart = new Date(maxDate);
      weekStart.setDate(maxDate.getDate() - diffToMonday);
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      // Formatear label de la semana
      const formatDay = (d: Date) => `${d.getDate()} ${MONTH_NAMES[d.getMonth()].substring(0, 3)}`;
      const lastWeekLabel = `${formatDay(weekStart)} - ${formatDay(weekEnd)}`;
      
      const lastWeekInfo: LastWeekInfo = {
        startDate: weekStart,
        endDate: weekEnd,
        label: lastWeekLabel,
      };

      // Process each month
      const processMonth = (m: { year: number; month: number }): MonthMetrics => {
        const monthKey = MONTH_KEYS[m.month];
        const monthName = MONTH_NAMES[m.month];

        // Professionals data
        const ocupacionData = (ocupacion.data || []).filter((r: any) => r.anio === m.year);
        const citasData = (citas.data || []).filter((r: any) => r.anio === m.year);
        const horasData = (horas.data || []).filter((r: any) => r.anio === m.year);
        const balanceData = (balance.data || []).filter((r: any) => r.anio === m.year && r.mes === monthName);

        const balanceMap = new Map<string, number>();
        balanceData.forEach((b: any) => {
          balanceMap.set(b.usuario, (balanceMap.get(b.usuario) || 0) + (b.total || 0));
        });

        const allUsers = new Set<string>();
        ocupacionData.forEach((r: any) => allUsers.add(r.usuario));
        citasData.forEach((r: any) => allUsers.add(r.usuario));
        horasData.forEach((r: any) => allUsers.add(r.usuario));
        balanceData.forEach((r: any) => allUsers.add(r.usuario));

        const professionals: ProfessionalData[] = [];
        allUsers.forEach(usuario => {
          const oRow = ocupacionData.find((r: any) => r.usuario === usuario);
          const cRow = citasData.find((r: any) => r.usuario === usuario);
          const hRow = horasData.find((r: any) => r.usuario === usuario);
          const revenue = balanceMap.get(usuario) || 0;

          const occupancy = oRow?.[monthKey] ?? 0;
          const appointments = cRow?.[monthKey] ?? 0;
          const hours = Number(hRow?.[monthKey]) || 0;
          const euroPerHour = hours > 0 ? revenue / hours : 0;

          if (appointments > 0 || occupancy > 0 || revenue > 0) {
            professionals.push({ name: usuario, occupancy, appointments, revenue, hours, euroPerHour });
          }
        });

        // Revenue from balance_mensual + estimated from extras
        const bmData = (balanceMensual.data || []).filter((r: any) => r.anio === m.year && r.mes === monthName);
        const revenueFromCSV = bmData.reduce((sum: number, r: any) => sum + (r.total || 0), 0);
        
        // Extras for the month
        const monthExtras = (extras.data || []).filter((e: any) => e.anio === m.year && e.mes === monthKey);
        
        // Pre-calculate service prices for extras
        const servicePricesMap = new Map<string, number>();
        (analisisServicios.data || []).forEach((s: any) => {
          if (s.servicio && s.num_citas > 0) {
            const avg = (s.importe_total || 0) / s.num_citas;
            servicePricesMap.set(s.servicio, avg);
          }
        });
        const totalCitasRef = (analisisServicios.data || []).reduce((s, r) => s + (r.num_citas || 0), 0);
        
        // BETTER FALLBACK: Current month average from CSV
        const filteredCSVMonthCitas = listadoCitas.filter(c => {
          const citaDate = new Date(c.fecha_cita);
          if (citaDate.getFullYear() !== m.year || citaDate.getMonth() !== m.month) return false;
          const asunto = (c.asunto || "").toLowerCase();
          const servicio = (c.servicio || "").toLowerCase();
          return !asunto.includes("1918") && !asunto.includes("bloqueado") && !asunto.includes("no citar") && servicio !== "sin agenda";
        });
        const csvRealizadas = filteredCSVMonthCitas.filter(c => (c.estado || "").toLowerCase().startsWith("realizada")).length;
        const csvAverageTicket = csvRealizadas > 0 ? revenueFromCSV / csvRealizadas : 45;

        const extrasRevenue = (monthExtras as any[]).reduce((sum, e) => {
          const price = servicePricesMap.get(e.servicio || "") || csvAverageTicket;
          return sum + price;
        }, 0);

        const totalRevenue = revenueFromCSV + extrasRevenue;

        // Appointments from listado_citas
        const monthCitas = listadoCitas.filter(c => {
          const citaDate = new Date(c.fecha_cita);
          return citaDate.getFullYear() === m.year && citaDate.getMonth() === m.month;
        });

        // Filter placeholders - MISMO FILTRO QUE EN useDashboardData
        const filteredCitas = monthCitas.filter(c => {
          const asunto = (c.asunto || "").toLowerCase();
          const servicio = (c.servicio || "").toLowerCase();
          // Excluir: 1918, BLOQUEADO, NO CITAR, SIN AGENDA
          const esPlaceholder =
            asunto.includes("1918") ||
            asunto.includes("bloqueado") ||
            asunto.includes("no citar") ||
            servicio === "sin agenda";
          return !esPlaceholder;
        });

        // Citas realizadas - incluir todas las variantes + extras
        const citasRealizadasFromCSV = filteredCitas.filter(c => {
          const estado = (c.estado || "").toLowerCase();
          return estado.startsWith("realizada");
        }).length;

        const citasRealizadas = citasRealizadasFromCSV + monthExtras.length;

        // Cancelaciones - incluir anuladas y canceladas
        const citasCanceladas = filteredCitas.filter(c => {
          const estado = (c.estado || "").toLowerCase();
          const asunto = (c.asunto || "").toUpperCase();
          return (estado.includes("anulada") || estado.includes("cancelada")) && !asunto.includes("PILATES");
        }).length;

        // Nuevos pacientes - basado en servicio "primera" - CONTAR ÚNICOS POR TELÉFONO
        const pacientesNuevosSet = new Set<string>();
        filteredCitas.forEach(c => {
          const servicio = (c.servicio || "").toLowerCase();
          const estado = (c.estado || "").toLowerCase();
          const esPrimeraVisita =
            servicio.includes("primera") ||
            servicio.includes("1ª sesion") ||
            servicio.includes("1a sesion") ||
            servicio.includes("1ª sesión");
          if (esPrimeraVisita && estado.startsWith("realizada")) {
            const telefono = (c.paciente_telefono || "").trim();
            if (telefono) {
              pacientesNuevosSet.add(telefono);
            }
          }
        });
        const nuevosPacientes = pacientesNuevosSet.size;

        const avgOccupancy = professionals.length > 0
          ? professionals.reduce((sum, p) => sum + p.occupancy, 0) / professionals.length
          : 0;
        const totalHours = professionals.reduce((sum, p) => sum + p.hours, 0);

        const totalCitas = filteredCitas.length;
        const avgTicket = citasRealizadas > 0 ? Math.round(totalRevenue / citasRealizadas) : 0;
        const ltv = avgTicket * 6;

        // Clasificar citas realizadas por tipo (pie chart)
        const realizadas = filteredCitas.filter(c => (c.estado || "").toLowerCase().startsWith("realizada"));
        const { citasPilates, citasFisioterapia, pieData: pie, otrosDesglose: otros } = classifyCitas(realizadas);

        return {
          year: m.year,
          month: m.month,
          monthName,
          professionals,
          avgOccupancy,
          totalHours,
          totalRevenue,
          avgTicket,
          totalCitas,
          citasRealizadas,
          citasCanceladas,
          nuevosPacientes,
          citasPilates,
          citasFisioterapia,
          pieData: pie,
          otrosDesglose: otros,
          ltv,
        };
      };

      // Procesar datos de la última semana con registros + ingresos del mes actual
      const processLastWeek = (): MonthMetrics => {
        const weekCitas = listadoCitas.filter(c => {
          const citaDate = new Date(c.fecha_cita);
          return citaDate >= weekStart && citaDate <= weekEnd;
        });

        // Filter placeholders - MISMO FILTRO QUE EN useDashboardData
        const filteredCitas = weekCitas.filter(c => {
          const asunto = (c.asunto || "").toLowerCase();
          const servicio = (c.servicio || "").toLowerCase();
          // Excluir: 1918, BLOQUEADO, NO CITAR, SIN AGENDA
          const esPlaceholder =
            asunto.includes("1918") ||
            asunto.includes("bloqueado") ||
            asunto.includes("no citar") ||
            servicio === "sin agenda";
          return !esPlaceholder;
        });

        // Citas realizadas + extras de la semana
        const weekExtras = (extras.data as any[] || []).filter(e => {
          const d = new Date(e.fecha);
          return d >= weekStart && d <= weekEnd;
        });

        const citasRealizadasFromCSV = filteredCitas.filter(c => {
          const estado = (c.estado || "").toLowerCase();
          return estado.startsWith("realizada");
        }).length;

        const citasRealizadas = citasRealizadasFromCSV + weekExtras.length;

        // Cancelaciones
        const citasCanceladas = filteredCitas.filter(c => {
          const estado = (c.estado || "").toLowerCase();
          const asunto = (c.asunto || "").toUpperCase();
          return (estado.includes("anulada") || estado.includes("cancelada")) && !asunto.includes("PILATES");
        }).length;

        // Nuevos pacientes - basado en servicio "primera" - CONTAR ÚNICOS POR TELÉFONO
        const pacientesNuevosSet = new Set<string>();
        filteredCitas.forEach(c => {
          const servicio = (c.servicio || "").toLowerCase();
          const estado = (c.estado || "").toLowerCase();
          const esPrimeraVisita =
            servicio.includes("primera") ||
            servicio.includes("1ª sesion") ||
            servicio.includes("1a sesion") ||
            servicio.includes("1ª sesión");
          if (esPrimeraVisita && estado.startsWith("realizada")) {
            const telefono = (c.paciente_telefono || "").trim();
            if (telefono) {
              pacientesNuevosSet.add(telefono);
            }
          }
        });
        const nuevosPacientes = pacientesNuevosSet.size;

        // Obtener ingresos del mes actual desde balance_mensual + extras
        const currentMonthName = MONTH_NAMES[currentMonth];
        const currentMonthBalance = (balanceMensual.data || []).filter(
          (r: any) => r.anio === currentYear && r.mes === currentMonthName
        );
        const revenueFromCSV = currentMonthBalance.reduce((sum: number, r: any) => sum + (r.total || 0), 0);
        
        // Month extras for revenue sync
        const currentMonthKey = MONTH_KEYS[currentMonth];
        const monthExtras = (extras.data || []).filter((e: any) => e.anio === currentYear && e.mes === currentMonthKey);
        
        // Prices map for extras
        const servicePricesMap = new Map<string, number>();
        (analisisServicios.data || []).forEach((s: any) => {
          if (s.servicio && s.num_citas > 0) {
            const avg = (s.importe_total || 0) / s.num_citas;
            servicePricesMap.set(s.servicio, avg);
          }
        });
        const totalCitasRef = (analisisServicios.data || []).reduce((s, r) => s + (r.num_citas || 0), 0);
        
        // Month fallback
        const monthCitasForFallback = listadoCitas.filter(c => {
          const citaDate = new Date(c.fecha_cita);
          if (citaDate.getFullYear() !== currentYear || citaDate.getMonth() !== currentMonth) return false;
          const asunto = (c.asunto || "").toLowerCase();
          const servicio = (c.servicio || "").toLowerCase();
          return !asunto.includes("1918") && !asunto.includes("bloqueado") && !asunto.includes("no citar") && servicio !== "sin agenda";
        });
        const csvRealizadasMes = monthCitasForFallback.filter(c => (c.estado || "").toLowerCase().startsWith("realizada")).length;
        const csvAverageTicket = csvRealizadasMes > 0 ? revenueFromCSV / csvRealizadasMes : 45;

        const extrasRevenueMonth = (monthExtras as any[]).reduce((sum, e) => {
          const price = servicePricesMap.get(e.servicio || "") || csvAverageTicket;
          return sum + price;
        }, 0);

        const totalRevenue = revenueFromCSV + extrasRevenueMonth;

        // Para el ticket medio: usar citas realizadas del MES COMPLETO hasta la fecha
        const currentMonthCitas = listadoCitas.filter(c => {
          const citaDate = new Date(c.fecha_cita);
          return citaDate.getFullYear() === currentYear && citaDate.getMonth() === currentMonth;
        });
        const filteredMonthCitas = currentMonthCitas.filter(c => {
          const asunto = (c.asunto || "").toLowerCase();
          const servicio = (c.servicio || "").toLowerCase();
          return !asunto.includes("1918") && !asunto.includes("bloqueado") && !asunto.includes("no citar") && servicio !== "sin agenda";
        });
        const citasRealizadasMesFromCSV = filteredMonthCitas.filter(c => (c.estado || "").toLowerCase().startsWith("realizada")).length;
        const citasRealizadasMes = citasRealizadasMesFromCSV + monthExtras.length;
        const avgTicket = citasRealizadasMes > 0 ? Math.round(totalRevenue / citasRealizadasMes) : 0;
        const ltv = avgTicket * 6;

      // Calcular el servicio con más ingresos del MES actual
      let topService: { name: string; revenue: number; sessions: number } | undefined;
      if (analisisServicios.data && analisisServicios.data.length > 0) {
        // Formatear mes actual para comparar
        const currentMonthOneBased = currentMonth + 1;
        const currentMonthStartStr = format(startOfMonth(now), 'yyyy-MM-dd');
        const currentMonthEndStr = format(endOfMonth(now), 'yyyy-MM-dd');
        
        // Buscar servicios del mes actual
        const monthlyServices = analisisServicios.data.filter((s: any) => {
          // 1. Prioridad: Columna 'mes' exacta
          if (s.mes !== undefined && s.mes !== null) {
            return s.mes === currentMonthOneBased;
          }
          
          // 2. Columna 'periodo_tipo' mensual o semanal que caiga en el mes
          if (s.fecha_inicio && s.fecha_fin) {
             // Si el periodo termina en este mes, lo contamos como de este mes (para mensuales)
             // O si empieza y termina dentro del mes (para semanales u otros)
             const endDate = new Date(s.fecha_fin);
             return endDate.getFullYear() === currentYear && endDate.getMonth() === currentMonth;
          }
          
          // Fallback final: fecha_inicio en este mes
          if (s.fecha_inicio) {
            const startDate = new Date(s.fecha_inicio);
            return startDate.getFullYear() === currentYear && startDate.getMonth() === currentMonth;
          }
          return false;
        });
        
        // NO hacer fallback a todos los datos del año para evitar mostrar totales anuales como mensuales
        const dataToUse = monthlyServices;
        
        // Agregar por servicio antes de ordenar
        const serviceMap = new Map<string, { revenue: number; sessions: number }>();
        dataToUse.forEach((s: any) => {
          const existing = serviceMap.get(s.servicio) || { revenue: 0, sessions: 0 };
          serviceMap.set(s.servicio, {
            revenue: existing.revenue + (s.importe_total || 0),
            sessions: existing.sessions + (s.num_citas || 0),
          });
        });
        
        const sorted = Array.from(serviceMap.entries())
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.revenue - a.revenue);
        
        if (sorted[0]) {
          topService = {
            name: sorted[0].name,
            revenue: sorted[0].revenue,
            sessions: sorted[0].sessions,
          };
        }
      }

        // Clasificar citas realizadas por tipo (pie chart)
        const realizadasWeek = filteredCitas.filter(c => (c.estado || "").toLowerCase().startsWith("realizada"));
        const { citasPilates, citasFisioterapia, pieData: pie, otrosDesglose: otros } = classifyCitas(realizadasWeek);

        return {
          year: weekStart.getFullYear(),
          month: weekStart.getMonth(),
          monthName: MONTH_NAMES[weekStart.getMonth()],
          professionals: [],
          avgOccupancy: 0,
          totalHours: 0,
          totalRevenue,
          avgTicket,
          totalCitas: filteredCitas.length,
          citasRealizadas,
          citasCanceladas,
          nuevosPacientes,
          citasPilates,
          citasFisioterapia,
          pieData: pie,
          otrosDesglose: otros,
          topService,
          ltv,
        };
      };

      const previousData = processMonth(months[1]); // Diciembre
      const previous2Data = processMonth(months[2]); // Noviembre
      const previous3Data = processMonth(months[3]); // Octubre
      const currentWeekData = processLastWeek();

      // Calcular media semanal del mes anterior para comparación en Resumen Semanal
      const SEMANAS_POR_MES = 4.33;
      const weeklyAveragePrevious: MonthMetrics = {
        ...previousData,
        citasRealizadas: Math.round(previousData.citasRealizadas / SEMANAS_POR_MES),
        citasCanceladas: Math.round(previousData.citasCanceladas / SEMANAS_POR_MES),
        nuevosPacientes: Math.round(previousData.nuevosPacientes / SEMANAS_POR_MES),
        totalCitas: Math.round(previousData.totalCitas / SEMANAS_POR_MES),
        totalRevenue: Math.round(previousData.totalRevenue / SEMANAS_POR_MES),
        avgTicket: previousData.avgTicket,
        avgOccupancy: previousData.avgOccupancy,
        ltv: previousData.ltv,
      };

      return {
        current: currentWeekData,
        // Para el Resumen Semanal: media semanal del mes anterior
        weeklyPrevious: weeklyAveragePrevious,
        // Para alertas: datos mensuales completos
        previous: previousData,      // Diciembre completo
        previous2: previous2Data,    // Noviembre completo
        previous3: previous3Data,    // Octubre completo
        lastWeekInfo,
      };
    },
  });

  return {
    ...query,
  };
}

// Fetch listado_citas for multiple months efficiently
async function fetchListadoCitasMultiMonth(months: { year: number; month: number }[]): Promise<any[]> {
  const years = [...new Set(months.map(m => m.year))];
  const monthNames = months.map(m => MONTH_NAMES[m.month]);

  const PAGE_SIZE = 1000;
  const all: any[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("listado_citas")
      .select("id,estado,fecha_cita,asunto,servicio,mes,paciente_telefono")
      .in("anio", years)
      .in("mes", monthNames)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    if (offset > 50000) break; // Safety
  }

  return all;
}
