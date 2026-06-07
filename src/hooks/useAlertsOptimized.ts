import { useMemo } from "react";
import { useOverviewData, OverviewMetrics } from "./useOverviewData";

export interface Alert {
  id: string;
  type: "critical" | "warning" | "info" | "success";
  title: string;
  description: string;
  impact?: string;
  action?: string;
  metric?: string;
}

interface AlertConfig {
  lowOccupancyThreshold: number;
  highOccupancyThreshold: number;
}

const DEFAULT_CONFIG: AlertConfig = {
  lowOccupancyThreshold: 50,
  highOccupancyThreshold: 80,
};

/**
 * Hook optimizado para alertas que reutiliza los datos de useOverviewData
 */
export function useAlertsOptimized(config: AlertConfig = DEFAULT_CONFIG) {
  const { data, isLoading } = useOverviewData();

  const alerts = useMemo<Alert[]>(() => {
    if (!data) return [];

    const positiveAlerts: Alert[] = [];
    const negativeAlerts: Alert[] = [];
    const { previous: month1, previous2: month2, previous3: month3 } = data;

    // Helper to calculate variation percentage
    const calcVariation = (current: number, previous: number) => 
      previous > 0 ? Math.abs((current - previous) / previous) * 100 : 0;

    // ==================== POSITIVE TRENDS ====================

    // 1. New patients growth (2 consecutive months)
    if (month1.nuevosPacientes > 0 || month2.nuevosPacientes > 0 || month3.nuevosPacientes > 0) {
      const trendUp1 = month1.nuevosPacientes > month2.nuevosPacientes;
      const trendUp2 = month2.nuevosPacientes > month3.nuevosPacientes;

      if (trendUp1 && trendUp2 && month1.nuevosPacientes > 0) {
        const growthTotal = month1.nuevosPacientes - month3.nuevosPacientes;
        const growthPercent = month3.nuevosPacientes > 0 
          ? Math.round((growthTotal / month3.nuevosPacientes) * 100)
          : 100;

        positiveAlerts.push({
          id: "trend-new-patients-growth",
          type: "success",
          title: "Captación de pacientes en alza",
          description: `¡Excelente! La captación de pacientes nuevos ha crecido dos meses seguidos: ${month3.nuevosPacientes} en ${month3.monthName}, ${month2.nuevosPacientes} en ${month2.monthName} y ${month1.nuevosPacientes} en ${month1.monthName}.`,
          impact: `+${growthPercent}% más pacientes nuevos en dos meses`,
          action: "Mantén las acciones actuales de marketing y captación.",
          metric: `${month1.nuevosPacientes} nuevos`,
        });
      }
    }

    // 2. Revenue growth (2 consecutive months)
    const rev1 = month1.totalRevenue;
    const rev2 = month2.totalRevenue;
    const rev3 = month3.totalRevenue;

    if (rev1 > rev2 && rev2 > rev3 && rev1 > 0) {
      const gainedAmount = rev1 - rev3;
      const growthPercent = rev3 > 0 ? Math.round((gainedAmount / rev3) * 100) : 100;

      positiveAlerts.push({
        id: "trend-revenue-growth",
        type: "success",
        title: "Ingresos en crecimiento",
        description: `¡Los ingresos van en aumento! ${rev3.toLocaleString()}€ en ${month3.monthName}, ${rev2.toLocaleString()}€ en ${month2.monthName} y ${rev1.toLocaleString()}€ en ${month1.monthName}.`,
        impact: `+${gainedAmount.toLocaleString()}€ más respecto a hace 2 meses (+${growthPercent}%)`,
        action: "¡Sigue así! Considera replicar las estrategias que están funcionando.",
        metric: `${rev1.toLocaleString()}€`,
      });
    }

    // 3. Cancellations decreasing (2 consecutive months)
    const cancel1 = month1.citasCanceladas;
    const cancel2 = month2.citasCanceladas;
    const cancel3 = month3.citasCanceladas;

    if (cancel1 < cancel2 && cancel2 < cancel3 && cancel3 > 0) {
      const reduction = cancel3 - cancel1;
      const reductionPercent = Math.round((reduction / cancel3) * 100);

        positiveAlerts.push({
          id: "trend-cancellations-down",
          type: "success",
          title: "Cancelaciones a la baja",
          description: `Las cancelaciones se han reducido dos meses seguidos: ${cancel3} en ${month3.monthName}, ${cancel2} en ${month2.monthName} y ${cancel1} en ${month1.monthName}.`,
        impact: `${reductionPercent}% menos cancelaciones`,
        action: "Los pacientes muestran mayor compromiso con sus citas.",
        metric: `${cancel1} canceladas`,
      });
    }

    // 4. Appointments increasing (2 consecutive months)
    const citas1 = month1.citasRealizadas;
    const citas2 = month2.citasRealizadas;
    const citas3 = month3.citasRealizadas;

    if (citas1 > citas2 && citas2 > citas3 && citas1 > 0) {
      const growthTotal = citas1 - citas3;
      const growthPercent = citas3 > 0 
        ? Math.round((growthTotal / citas3) * 100)
        : 100;

      positiveAlerts.push({
          id: "trend-appointments-growth",
          type: "success",
          title: "Citas realizadas al alza",
          description: `¡Las citas realizadas han crecido dos meses seguidos: ${citas3} en ${month3.monthName}, ${citas2} en ${month2.monthName} y ${citas1} en ${month1.monthName}.`,
        impact: `+${growthPercent}% más citas en dos meses`,
        action: "La actividad de la clínica está en aumento.",
        metric: `${citas1} citas`,
      });
    }

    // 5. Operational stability (small variations in revenue, appointments, cancellations for 2 months)
    const stabilityThreshold = 10; // 10% variation threshold
    const revVar1 = calcVariation(rev1, rev2);
    const revVar2 = calcVariation(rev2, rev3);
    const citasVar1 = calcVariation(month1.citasRealizadas, month2.citasRealizadas);
    const citasVar2 = calcVariation(month2.citasRealizadas, month3.citasRealizadas);
    const cancelVar1 = cancel2 > 0 ? calcVariation(cancel1, cancel2) : 0;
    const cancelVar2 = cancel3 > 0 ? calcVariation(cancel2, cancel3) : 0;

    const isStable = 
      revVar1 < stabilityThreshold && revVar2 < stabilityThreshold &&
      citasVar1 < stabilityThreshold && citasVar2 < stabilityThreshold &&
      cancelVar1 < stabilityThreshold && cancelVar2 < stabilityThreshold &&
      month1.citasRealizadas > 0 && rev1 > 0;

    if (isStable) {
      positiveAlerts.push({
        id: "trend-operational-stability",
        type: "success",
        title: "Estabilidad operativa",
        description: `La clínica mantiene un rendimiento estable: ingresos, citas y cancelaciones con variaciones menores al ${stabilityThreshold}% durante los últimos meses.`,
        impact: "Operaciones predecibles y consistentes",
        action: "Base sólida para planificar mejoras o expansiones.",
        metric: "Estable",
      });
    }

    // ==================== NEGATIVE TRENDS ====================

    // 1. New patients declining (2 consecutive months)
    if (month1.nuevosPacientes > 0 || month2.nuevosPacientes > 0 || month3.nuevosPacientes > 0) {
      const trend1 = month1.nuevosPacientes < month2.nuevosPacientes;
      const trend2 = month2.nuevosPacientes < month3.nuevosPacientes;

      if (trend1 && trend2 && month3.nuevosPacientes > 0) {
        const dropTotal = month3.nuevosPacientes - month1.nuevosPacientes;
        const dropPercent = Math.round((dropTotal / month3.nuevosPacientes) * 100);

        negativeAlerts.push({
          id: "trend-new-patients-drop",
          type: "critical",
          title: "Captación de pacientes en descenso",
          description: `Hemos notado que en ${month2.monthName} y ${month1.monthName} han llegado menos pacientes nuevos que el mes anterior (${month3.nuevosPacientes} → ${month2.nuevosPacientes} → ${month1.nuevosPacientes}).`,
          impact: `Un ${dropPercent}% menos de pacientes nuevos en dos meses`,
          action: "Te recomendamos revisar los canales de captación y la visibilidad online de la clínica.",
          metric: `${month1.nuevosPacientes} nuevos`,
        });
      }
    }

    // 2. Revenue declining (2 consecutive months)
    if (rev1 < rev2 && rev2 < rev3 && rev3 > 0) {
      const lostAmount = rev3 - rev1;
      const dropPercent = Math.round((lostAmount / rev3) * 100);

      negativeAlerts.push({
        id: "trend-revenue-drop",
        type: "critical",
        title: "Ingresos con tendencia a la baja",
        description: `Los ingresos han ido bajando: ${rev3.toLocaleString()}€ en ${month3.monthName}, ${rev2.toLocaleString()}€ en ${month2.monthName} y ${rev1.toLocaleString()}€ en ${month1.monthName}.`,
        impact: `${lostAmount.toLocaleString()}€ menos respecto a hace 2 meses (-${dropPercent}%)`,
        action: "Sería bueno analizar si hay menos citas, más cancelaciones o cambios en los servicios ofrecidos.",
        metric: `${rev1.toLocaleString()}€`,
      });
    }

    // 3. Appointments declining (2 consecutive months)
    if (citas1 < citas2 && citas2 < citas3 && citas3 > 0) {
      const dropTotal = citas3 - citas1;
      const dropPercent = Math.round((dropTotal / citas3) * 100);

        negativeAlerts.push({
          id: "trend-appointments-drop",
          type: "critical",
          title: "Citas realizadas a la baja",
          description: `Las citas realizadas han disminuido dos meses seguidos: ${citas3} en ${month3.monthName}, ${citas2} en ${month2.monthName} y ${citas1} en ${month1.monthName}.`,
        impact: `${dropPercent}% menos citas en dos meses`,
        action: "Revisa la captación de pacientes y las cancelaciones para identificar la causa.",
        metric: `${citas1} citas`,
      });
    }

    // ==================== DISPLAY ORDER ====================
    // 1 positive (if exists) → max 2 negative/info by priority → 1 more positive (if exists)
    const sortedNegative = negativeAlerts.sort((a, b) => {
      const priority: Record<string, number> = { critical: 0, warning: 1, info: 2 };
      return priority[a.type] - priority[b.type];
    });

    const result: Alert[] = [];
    
    // First positive
    if (positiveAlerts.length > 0) {
      result.push(positiveAlerts[0]);
    }
    
    // Max 2 negative/info
    result.push(...sortedNegative.slice(0, 2));
    
    // Second positive (if exists)
    if (positiveAlerts.length > 1) {
      result.push(positiveAlerts[1]);
    }
    
    // Add remaining alerts for completeness (not shown in compact mode)
    const usedIds = new Set(result.map(a => a.id));
    const remaining = [...positiveAlerts, ...negativeAlerts].filter(a => !usedIds.has(a.id));
    result.push(...remaining);

    return result;
  }, [data, config]);

  return {
    alerts,
    isLoading,
    criticalCount: alerts.filter(a => a.type === "critical").length,
    warningCount: alerts.filter(a => a.type === "warning").length,
    successCount: alerts.filter(a => a.type === "success").length,
  };
}

/**
 * Hook para resumen del dashboard (para IA)
 * Usa datos del MES ACTUAL hasta la fecha, con comparaciones:
 * - Citas, cancelaciones, nuevos pacientes → vs media semanal mes anterior
 * - Ticket medio, LTV → vs mes anterior completo
 */
export function useDashboardSummaryOptimized() {
  const { data, isLoading } = useOverviewData();
  const { alerts } = useAlertsOptimized();

  return useMemo(() => {
    if (!data || isLoading) return null;

    const current = data.current; // Mes actual hasta la fecha
    const weeklyPrev = data.weeklyPrevious; // Media semanal del mes anterior
    const monthPrev = data.previous; // Mes anterior completo

    // Calcular tendencias como en DefaultKPIView
    // Citas, cancelaciones, nuevos → vs media semanal mes anterior
    const citasTrend = weeklyPrev.citasRealizadas > 0
      ? Math.round(((current.citasRealizadas - weeklyPrev.citasRealizadas) / weeklyPrev.citasRealizadas) * 100)
      : 0;
    
    const cancelacionesTrend = weeklyPrev.citasCanceladas > 0
      ? Math.round(((current.citasCanceladas - weeklyPrev.citasCanceladas) / weeklyPrev.citasCanceladas) * 100)
      : 0;
    
    const nuevosTrend = weeklyPrev.nuevosPacientes > 0
      ? Math.round(((current.nuevosPacientes - weeklyPrev.nuevosPacientes) / weeklyPrev.nuevosPacientes) * 100)
      : 0;

    // Ticket medio, LTV → vs mes anterior completo
    const ticketTrend = monthPrev.avgTicket > 0
      ? Math.round(((current.avgTicket - monthPrev.avgTicket) / monthPrev.avgTicket) * 100)
      : 0;
    
    const ltvTrend = monthPrev.ltv > 0
      ? Math.round(((current.ltv - monthPrev.ltv) / monthPrev.ltv) * 100)
      : 0;

    // Determinar qué métricas van bien (positivas)
    const positiveTrends: string[] = [];
    const negativeTrends: string[] = [];

    // Ticket medio subiendo es positivo
    if (ticketTrend > 0) {
      positiveTrends.push(`Ticket medio: +${ticketTrend}% (${current.avgTicket}€ vs ${monthPrev.avgTicket}€ en ${monthPrev.monthName})`);
    } else if (ticketTrend < 0) {
      negativeTrends.push(`Ticket medio: ${ticketTrend}% (${current.avgTicket}€ vs ${monthPrev.avgTicket}€ en ${monthPrev.monthName})`);
    }

    // Nuevos pacientes subiendo es positivo
    if (nuevosTrend > 0) {
      positiveTrends.push(`Pacientes nuevos: +${nuevosTrend}% (${current.nuevosPacientes} vs media semanal de ${weeklyPrev.nuevosPacientes} en ${monthPrev.monthName})`);
    } else if (nuevosTrend < 0) {
      negativeTrends.push(`Pacientes nuevos: ${nuevosTrend}% (${current.nuevosPacientes} vs media semanal de ${weeklyPrev.nuevosPacientes} en ${monthPrev.monthName})`);
    }

    // LTV subiendo es positivo
    if (ltvTrend > 0) {
      positiveTrends.push(`LTV estimado: +${ltvTrend}% (${current.ltv}€ vs ${monthPrev.ltv}€ en ${monthPrev.monthName})`);
    } else if (ltvTrend < 0) {
      negativeTrends.push(`LTV estimado: ${ltvTrend}% (${current.ltv}€ vs ${monthPrev.ltv}€ en ${monthPrev.monthName})`);
    }

    // Cancelaciones bajando es positivo (invertido)
    if (cancelacionesTrend < 0) {
      positiveTrends.push(`Cancelaciones: ${cancelacionesTrend}% (${current.citasCanceladas} vs media semanal de ${weeklyPrev.citasCanceladas} en ${monthPrev.monthName})`);
    } else if (cancelacionesTrend > 0) {
      negativeTrends.push(`Cancelaciones: +${cancelacionesTrend}% (${current.citasCanceladas} vs media semanal de ${weeklyPrev.citasCanceladas} en ${monthPrev.monthName})`);
    }

    // Citas realizadas
    if (citasTrend > 0) {
      positiveTrends.push(`Citas realizadas: +${citasTrend}% (${current.citasRealizadas} vs media semanal de ${weeklyPrev.citasRealizadas} en ${monthPrev.monthName})`);
    } else if (citasTrend < 0) {
      negativeTrends.push(`Citas realizadas: ${citasTrend}% (${current.citasRealizadas} vs media semanal de ${weeklyPrev.citasRealizadas} en ${monthPrev.monthName})`);
    }

    return {
      period: {
        year: current.year,
        month: current.month,
        monthName: current.monthName,
      },
      weekLabel: data.lastWeekInfo.label,
      metrics: {
        totalRevenue: current.totalRevenue,
        avgTicket: current.avgTicket,
        avgOccupancy: Math.round(current.avgOccupancy),
        totalAppointments: current.citasRealizadas,
        cancellations: current.citasCanceladas,
        cancellationRate: current.citasRealizadas > 0 ? Math.round((current.citasCanceladas / (current.citasRealizadas + current.citasCanceladas)) * 100) : 0,
        newPatients: current.nuevosPacientes,
        topService: current.topService?.name,
        ltv: current.ltv,
      },
      trends: {
        citasTrend,
        cancelacionesTrend,
        nuevosTrend,
        ticketTrend,
        ltvTrend,
      },
      positiveTrends,
      negativeTrends,
      previousMonth: {
        name: monthPrev.monthName,
        revenue: monthPrev.totalRevenue,
        appointments: monthPrev.citasRealizadas,
        newPatients: monthPrev.nuevosPacientes,
        avgTicket: monthPrev.avgTicket,
        ltv: monthPrev.ltv,
      },
      professionals: monthPrev.professionals.map(p => ({
        name: p.name,
        occupancy: p.occupancy,
        appointments: p.appointments,
        revenue: p.revenue,
        euroPerHour: p.euroPerHour,
      })),
      alerts: alerts.map(a => ({
        type: a.type,
        title: a.title,
        impact: a.impact,
      })),
    };
  }, [data, isLoading, alerts]);
}
