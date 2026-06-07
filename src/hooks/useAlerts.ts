import { useMemo } from "react";
import { useProductividadEquipo, useIngresos, useControlCitas } from "./useDashboardData";

export interface Alert {
  id: string;
  type: "critical" | "warning" | "info";
  title: string;
  description: string;
  impact?: string;
  action?: string;
  metric?: string;
}

interface AlertConfig {
  lowOccupancyThreshold: number;
  newPatientsDropThreshold: number;
  revenueDropThreshold: number;
  consecutiveMonths: number;
}

const DEFAULT_CONFIG: AlertConfig = {
  lowOccupancyThreshold: 50,
  newPatientsDropThreshold: 10,
  revenueDropThreshold: 10,
  consecutiveMonths: 2,
};

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function getPreviousMonth(year: number, month: number, offset: number = 1): { year: number; month: number } {
  let newMonth = month - offset;
  let newYear = year;
  while (newMonth < 0) {
    newMonth += 12;
    newYear -= 1;
  }
  return { year: newYear, month: newMonth };
}

export function useAlerts(year?: number, month?: number, config: AlertConfig = DEFAULT_CONFIG) {
  // Get current real date
  const now = new Date();
  const realYear = now.getFullYear();
  const realMonth = now.getMonth(); // 0-indexed
  
  // Use the last CLOSED month (previous month) as the analysis endpoint
  // This excludes the current incomplete month
  const lastClosed = getPreviousMonth(realYear, realMonth, 1);
  const secondLastClosed = getPreviousMonth(realYear, realMonth, 2);
  
  // Fetch data for the last 2 closed months
  const { data: productivity1, isLoading: loadingProd1 } = useProductividadEquipo(lastClosed.year, lastClosed.month);
  const { data: productivity2, isLoading: loadingProd2 } = useProductividadEquipo(secondLastClosed.year, secondLastClosed.month);
  
  const { data: revenue1, isLoading: loadingRev1 } = useIngresos(lastClosed.year, lastClosed.month);
  const { data: revenue2, isLoading: loadingRev2 } = useIngresos(secondLastClosed.year, secondLastClosed.month);
  
  const { data: citas1, isLoading: loadingCitas1 } = useControlCitas(lastClosed.year, MONTH_NAMES[lastClosed.month]);
  const { data: citas2, isLoading: loadingCitas2 } = useControlCitas(secondLastClosed.year, MONTH_NAMES[secondLastClosed.month]);

  // For wasted capacity calculation, also fetch a 3rd month back
  const thirdLastClosed = getPreviousMonth(realYear, realMonth, 3);
  const { data: revenue3 } = useIngresos(thirdLastClosed.year, thirdLastClosed.month);
  const { data: citas3 } = useControlCitas(thirdLastClosed.year, MONTH_NAMES[thirdLastClosed.month]);

  const alerts = useMemo<Alert[]>(() => {
    const result: Alert[] = [];
    
    const month1Name = MONTH_NAMES[lastClosed.month];
    const month2Name = MONTH_NAMES[secondLastClosed.month];

    // 1. TREND: 2 consecutive months with fewer new patients
    if (citas1 && citas2 && citas3) {
      const trend1 = citas1.nuevosPacientes < citas2.nuevosPacientes;
      const trend2 = citas2.nuevosPacientes < citas3.nuevosPacientes;
      
      if (trend1 && trend2 && citas3.nuevosPacientes > 0) {
        const dropTotal = citas3.nuevosPacientes - citas1.nuevosPacientes;
        const dropPercent = Math.round((dropTotal / citas3.nuevosPacientes) * 100);
        
        result.push({
          id: "trend-new-patients-drop",
          type: "critical",
          title: "Tendencia negativa en pacientes nuevos",
          description: `2 meses consecutivos perdiendo pacientes nuevos: ${citas3.nuevosPacientes} → ${citas2.nuevosPacientes} → ${citas1.nuevosPacientes}`,
          impact: `${dropPercent}% menos pacientes nuevos en 2 meses`,
          action: "Revisa canales de captación, campañas de marketing y reputación online.",
          metric: `${citas1.nuevosPacientes} nuevos`,
        });
      }
    }

    // 2. TREND: 2 consecutive months with declining revenue
    if (revenue1 && revenue2 && revenue3) {
      const rev1 = revenue1.weeklyRevenue;
      const rev2 = revenue2.weeklyRevenue;
      const rev3 = revenue3.weeklyRevenue;
      
      const trend1 = rev1 < rev2;
      const trend2 = rev2 < rev3;
      
      if (trend1 && trend2 && rev3 > 0) {
        const lostAmount = rev3 - rev1;
        const dropPercent = Math.round((lostAmount / rev3) * 100);
        
        result.push({
          id: "trend-revenue-drop",
          type: "critical",
          title: "Ingresos en descenso 2 meses seguidos",
          description: `Los ingresos han caído durante ${month2Name} y ${month1Name}: ${rev3.toLocaleString()}€ → ${rev2.toLocaleString()}€ → ${rev1.toLocaleString()}€`,
          impact: `${lostAmount.toLocaleString()}€ menos en 2 meses (-${dropPercent}%)`,
          action: "Analiza si hay menos citas, cancelaciones o cambio en servicios.",
          metric: `${rev1.toLocaleString()}€`,
        });
      }
    }

    // 3. TREND: Professional with <50% occupancy for 2 consecutive months
    if (productivity1 && productivity2 && productivity1.length > 0 && productivity2.length > 0) {
      // Build a map of occupancy per professional for each month
      const occMonth1 = new Map(productivity1.map(p => [p.name, p]));
      const occMonth2 = new Map(productivity2.map(p => [p.name, p]));
      
      // Find professionals who had <50% in BOTH months
      const lowOccupancyBothMonths: Array<{ name: string; occ1: number; occ2: number; hours: number; euroPerHour: number }> = [];
      
      occMonth1.forEach((data1, name) => {
        const data2 = occMonth2.get(name);
        if (data2 && data1.occupancy < config.lowOccupancyThreshold && data2.occupancy < config.lowOccupancyThreshold) {
          lowOccupancyBothMonths.push({
            name,
            occ1: data1.occupancy,
            occ2: data2.occupancy,
            hours: data1.hours,
            euroPerHour: data1.euroPerHour,
          });
        }
      });

      lowOccupancyBothMonths.forEach(pro => {
        const unusedHours = pro.hours * ((100 - pro.occ1) / 100);
        const lostRevenue = Math.round(unusedHours * pro.euroPerHour);
        
        result.push({
          id: `trend-low-occupancy-${pro.name}`,
          type: "warning",
          title: `${pro.name}: baja ocupación persistente`,
          description: `Menos del ${config.lowOccupancyThreshold}% de ocupación durante 2 meses: ${pro.occ2.toFixed(0)}% (${month2Name}) → ${pro.occ1.toFixed(0)}% (${month1Name})`,
          impact: lostRevenue > 0 ? `~${lostRevenue.toLocaleString()}€/mes sin aprovechar` : undefined,
          action: "Derivar más primeras visitas o revisar disponibilidad de agenda.",
          metric: `${pro.occ1.toFixed(0)}%`,
        });
      });
    }

    // 4. WASTED CAPACITY: Calculate money lost due to unfilled slots
    if (productivity1 && productivity1.length > 0) {
      const totalHours = productivity1.reduce((sum, p) => sum + p.hours, 0);
      const avgOccupancy = productivity1.reduce((sum, p) => sum + p.occupancy, 0) / productivity1.length;
      
      // Calculate weighted average €/hour
      const totalRevenue = productivity1.reduce((sum, p) => sum + p.revenue, 0);
      const occupiedHours = productivity1.reduce((sum, p) => sum + (p.hours * p.occupancy / 100), 0);
      const avgRevenuePerHour = occupiedHours > 0 ? totalRevenue / occupiedHours : 0;
      
      if (totalHours > 0 && avgOccupancy > 0 && avgOccupancy < 100 && avgRevenuePerHour > 0) {
        const unusedHoursPercent = (100 - avgOccupancy) / 100;
        const unusedHours = totalHours * unusedHoursPercent;
        const wastedCapacity = Math.round(unusedHours * avgRevenuePerHour);
        
        if (wastedCapacity > 500) {
          result.push({
            id: "wasted-capacity",
            type: "info",
            title: `Capacidad no aprovechada en ${month1Name}`,
            description: `${unusedHours.toFixed(0)} horas sin ocupar de ${totalHours.toFixed(0)} horas disponibles (${avgOccupancy.toFixed(0)}% ocupación).`,
            impact: `~${wastedCapacity.toLocaleString()}€ de facturación potencial perdida`,
            action: "Optimiza agendas, redistribuye citas y promociona huecos disponibles.",
            metric: `${unusedHours.toFixed(0)}h libres`,
          });
        }
      }
    }

    // Sort by priority
    const typePriority = { critical: 0, warning: 1, info: 2 };
    return result.sort((a, b) => typePriority[a.type] - typePriority[b.type]);
  }, [productivity1, productivity2, revenue1, revenue2, revenue3, citas1, citas2, citas3, config, lastClosed.month, secondLastClosed.month]);

  const isLoading = loadingProd1 || loadingProd2 || loadingRev1 || loadingRev2 || loadingCitas1 || loadingCitas2;

  return {
    alerts,
    isLoading,
    criticalCount: alerts.filter(a => a.type === "critical").length,
    warningCount: alerts.filter(a => a.type === "warning").length,
    analyzedPeriod: {
      lastMonth: { year: lastClosed.year, month: lastClosed.month, name: MONTH_NAMES[lastClosed.month] },
      previousMonth: { year: secondLastClosed.year, month: secondLastClosed.month, name: MONTH_NAMES[secondLastClosed.month] },
    },
  };
}

// Helper to get dashboard summary data for AI analysis
export function useDashboardSummary(year?: number, month?: number) {
  const now = new Date();
  const realYear = now.getFullYear();
  const realMonth = now.getMonth();
  
  // Use last closed month for summary
  const lastClosed = getPreviousMonth(realYear, realMonth, 1);
  const analysisYear = year ?? lastClosed.year;
  const analysisMonth = month ?? lastClosed.month;
  const monthName = MONTH_NAMES[analysisMonth];
  
  const { data: productivityData } = useProductividadEquipo(analysisYear, analysisMonth);
  const { data: revenueData } = useIngresos(analysisYear, analysisMonth);
  const { data: citasData } = useControlCitas(analysisYear, monthName);
  const { alerts } = useAlerts();

  return useMemo(() => {
    if (!productivityData || !revenueData || !citasData) return null;

    const avgOccupancy = productivityData.length > 0
      ? productivityData.reduce((sum, p) => sum + p.occupancy, 0) / productivityData.length
      : 0;

    const totalRevenue = revenueData.weeklyRevenue;
    const avgTicket = revenueData.averageTicket;
    const totalAppointments = citasData.citasRealizadas;
    const cancellations = citasData.citasCanceladas;
    const newPatients = citasData.nuevosPacientes;

    const professionalsSummary = productivityData.map(p => ({
      name: p.name,
      occupancy: p.occupancy,
      appointments: p.appointments,
      revenue: p.revenue,
      euroPerHour: p.euroPerHour,
    }));

    return {
      period: {
        year: analysisYear,
        month: analysisMonth,
        monthName,
      },
      metrics: {
        totalRevenue,
        avgTicket,
        avgOccupancy: Math.round(avgOccupancy),
        totalAppointments,
        cancellations,
        cancellationRate: totalAppointments > 0 ? Math.round((cancellations / (totalAppointments + cancellations)) * 100) : 0,
        newPatients,
      },
      professionals: professionalsSummary,
      alerts: alerts.map(a => ({
        type: a.type,
        title: a.title,
        impact: a.impact,
      })),
    };
  }, [productivityData, revenueData, citasData, alerts, analysisYear, analysisMonth, monthName]);
}
