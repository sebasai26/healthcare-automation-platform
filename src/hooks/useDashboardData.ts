import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Helper to get current month name in Spanish
const getMonthKey = (monthNumber: number): string => {
  const months = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];
  return months[monthNumber] || "enero";
};

// Get current month index (0-11)
const getCurrentMonthIndex = () => new Date().getMonth();
const getCurrentYear = () => new Date().getFullYear();

// =====================================================
// PRODUCTIVIDAD DEL EQUIPO - Unified view per professional
// =====================================================
export interface PhysioProductivity {
  name: string;
  appointments: number;
  occupancy: number;
  revenue: number;
  profitFallback: number;
  hours: number;
  euroPerHour: number;
}

// mes = -1 means "all year" (sum all months)
export function useProductividadEquipo(anio?: number, mes?: number) {
  const allMonthKeys = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const isAllYear = mes === -1;
  const monthIndex = mes !== undefined && mes >= 0 ? mes : getCurrentMonthIndex();
  const monthKey = getMonthKey(monthIndex);
  const monthName = monthNames[monthIndex];

  return useQuery({
    queryKey: ["productividad_equipo", anio, isAllYear ? "all" : monthKey],
    placeholderData: keepPreviousData,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<PhysioProductivity[]> => {
      // Build queries - filter by year if provided
      // Note: Using type assertions as some tables may not exist yet
      let ocupacionQuery = supabase.from("ocupacion_profesional" as any).select("*");
      let citasQuery = supabase.from("citas_profesional" as any).select("*");
      let balanceQuery = supabase.from("balance_profesional" as any).select("*");
      let horasQuery = supabase.from("horas_profesional").select("*");

      if (anio) {
        ocupacionQuery = ocupacionQuery.eq("anio", anio);
        citasQuery = citasQuery.eq("anio", anio);
        balanceQuery = balanceQuery.eq("anio", anio);
        horasQuery = horasQuery.eq("anio", anio);
      }

      // If not all year, filter balance by month
      if (!isAllYear) {
        balanceQuery = balanceQuery.eq("mes", monthName);
      }

      // Build extras/jornadas queries with month filtering for efficiency
      let extrasQuery = (supabase as any).from("citas_extras_profesional").select("*").eq("anio", anio);
      let jornadasQuery = (supabase as any).from("jornada_profesional").select("*").eq("anio", anio);
      if (!isAllYear) {
        extrasQuery = extrasQuery.eq("mes", monthKey);
        jornadasQuery = jornadasQuery.eq("mes", monthKey);
      }

      let analisisServiciosQuery = (supabase as any).from("analisis_servicios").select("servicio,importe_total,num_citas").eq("anio", anio);
      let balanceMensualQuery = supabase.from("balance_mensual" as any).select("*").eq("anio", anio);

      const [ocupacionRes, citasRes, balanceRes, horasRes, extrasRes, jornadasRes, analisisServiciosRes, balanceMensualRes] = await Promise.all([
        ocupacionQuery,
        citasQuery,
        balanceQuery,
        horasQuery,
        extrasQuery,
        jornadasQuery,
        analisisServiciosQuery,
        balanceMensualQuery,
      ]);

      if (ocupacionRes.error) throw ocupacionRes.error;
      if (citasRes.error) throw citasRes.error;
      if (balanceRes.error) throw balanceRes.error;
      if (horasRes.error) throw horasRes.error;
      if (extrasRes?.error) console.error("Error fetching extras:", extrasRes.error);
      if (jornadasRes?.error) console.error("Error fetching jornadas:", jornadasRes.error);

      // Create maps for quick lookup (using any type as tables may not exist)
      const citasData = (citasRes.data as any[]) || [];
      const ocupacionData = (ocupacionRes.data as any[]) || [];
      const balanceData = (balanceRes.data as any[]) || [];
      const horasData = (horasRes.data as any[]) || [];
      const extrasData = (extrasRes?.data as any[]) || [];
      const jornadasData = (jornadasRes?.data as any[]) || [];

      const citasMap = new Map(citasData.map((c: any) => [c.usuario, c]));
      const horasMap = new Map(horasData.map((h: any) => [h.usuario, h]));

      const balanceMap = new Map<string, number>();
      const profitMap = new Map<string, number>();
      balanceData.forEach((b: any) => {
        const key = (b.usuario || "").trim().toLowerCase();
        const currentRevenue = balanceMap.get(key) || 0;
        const currentProfit = profitMap.get(key) || 0;
        balanceMap.set(key, currentRevenue + (b.total || 0));
        profitMap.set(key, currentProfit + (b.liquido || 0));
      });

      const allUsersBase = new Set<string>();
      const displayNameMap = new Map<string, string>();
      
      const processUser = (u: string) => {
        if (!u) return;
        const trimmed = u.trim();
        const lower = trimmed.toLowerCase();
        allUsersBase.add(lower);
        // Keep the one with most capital letters or just the last one that isn't all lowercase
        const currentPretty = displayNameMap.get(lower);
        if (!currentPretty || (trimmed !== lower && currentPretty === lower)) {
          displayNameMap.set(lower, trimmed);
        }
      };

      ocupacionData.forEach((row: any) => processUser(row.usuario));
      citasData.forEach((row: any) => processUser(row.usuario));
      balanceData.forEach((row: any) => processUser(row.usuario));
      horasData.forEach((row: any) => processUser(row.usuario));
      extrasData.forEach((row: any) => processUser(row.usuario));
      
      const allUsers = Array.from(allUsersBase);
      
      const analisisServiciosRaw = (analisisServiciosRes?.data as any[]) || [];
      const servicePricesMap = new Map<string, number>();
      analisisServiciosRaw.forEach((s: any) => {
        if (s.servicio && Number(s.num_citas) > 0) {
          const avg = (Number(s.importe_total) || 0) / Number(s.num_citas);
          servicePricesMap.set(s.servicio, avg);
        }
      });

      // BETTER FALLBACK: Use actual month metrics from the CSV
      const monthBalanceRows = (balanceMensualRes?.data as any[] || []).filter(r => isAllYear ? true : r.mes === monthName);
      const csvTotalRevenue = monthBalanceRows.reduce((s, r) => s + (r.total || 0), 0);
      
      const relevantCitas = citasData.filter(r => isAllYear ? true : r.mes.toLowerCase() === monthKey);
      const csvTotalCitas = relevantCitas.reduce((s, r) => s + (r.num_citas || 0), 0);
      const fallbackAvg = csvTotalCitas > 0 ? csvTotalRevenue / csvTotalCitas : 45;

      const results = allUsers.map(trimUser => {
        const displayName = displayNameMap.get(trimUser) || trimUser;
        const ocupacionRows = (ocupacionData || []).filter((r: any) => (r.usuario || "").trim().toLowerCase() === trimUser);
        const citasRows = (citasData || []).filter((r: any) => (r.usuario || "").trim().toLowerCase() === trimUser);
        const horasRows = (horasData || []).filter((r: any) => (r.usuario || "").trim().toLowerCase() === trimUser);
        const extrasRows = (extrasData || []).filter((r: any) => (r.usuario || "").trim().toLowerCase() === trimUser);
        const jornadasRows = (jornadasData || []).filter((r: any) => (r.usuario || "").trim().toLowerCase() === trimUser);
        const balanceRevenue = balanceMap.get(trimUser) || 0;

        // Calculate appointments - sum all daily records for the period + extras
        let appointments = 0;
        let extrasRevenue = 0;
        citasRows.forEach((r: any) => {
          if (isAllYear || r.mes.toLowerCase() === monthKey) {
            appointments += (r.num_citas || 0);
          }
        });
        extrasRows.forEach((r: any) => {
          if (isAllYear || r.mes.toLowerCase() === monthKey) {
            appointments += 1; // Each extra record is 1 appointment
            // Calculate revenue for this extra
            const serviceName = (r.servicio || "").trim();
            const price = servicePricesMap.get(serviceName) || fallbackAvg;
            extrasRevenue += price;
          }
        });

        // Calculate hours - sum all daily records for the period + extras
        let hours = 0;
        horasRows.forEach((r: any) => {
          if (isAllYear || r.mes.toLowerCase() === monthKey) {
            hours += (Number(r.horas) || 0);
          }
        });
        extrasRows.forEach((r: any) => {
          if (isAllYear || r.mes.toLowerCase() === monthKey) {
            hours += (Number(r.duracion) || 0);
          }
        });

        // Calculate occupancy - If we have journey hours, recalculate: (Base Hours + Extra Hours) / Journey Hours
        // Otherwise fallback to averaging the pre-calculated occupancy column
        let occupancy = 0;
        let totalBaseHours = 0;
        let totalExtraHours = 0;
        let totalJourneyHours = 0;

        const relevantJornadas = jornadasRows.filter((r: any) => isAllYear || r.mes.toLowerCase() === monthKey);
        const relevantExtras = extrasRows.filter((r: any) => isAllYear || r.mes.toLowerCase() === monthKey);
        const relevantHoras = horasRows.filter((r: any) => isAllYear || r.mes.toLowerCase() === monthKey);

        // DATA CONSISTENCY FIX: Only count journey hours for days that actually have data (CSV or Manual Extras)
        const datesWithData = new Set([
          ...relevantHoras.map(r => r.fecha),
          ...relevantExtras.map(r => r.fecha)
        ]);

        // REFINED JOURNEY CALCULATION: Apply "domicilios" logic
        // If no journey record exists for a day with activity, assume journey = worked hours (100% occupancy)
        totalJourneyHours = 0;
        datesWithData.forEach(date => {
          const jornada = relevantJornadas.find(r => r.fecha === date);
          if (jornada) {
            totalJourneyHours += (Number(jornada.horas_jornada) || 0);
          } else {
            // No registered journey but has activity -> assume journey matches activity (domicilios)
            const dayBase = relevantHoras.find(r => r.fecha === date)?.horas || 0;
            const dayExtra = relevantExtras.filter(r => r.fecha === date).reduce((s, r) => s + (Number(r.duracion) || 0), 0);
            totalJourneyHours += (Number(dayBase) + Number(dayExtra));
          }
        });
          
        totalExtraHours = relevantExtras.reduce((sum, r) => sum + (Number(r.duracion) || 0), 0);
        totalBaseHours = relevantHoras.reduce((sum, r) => sum + (Number(r.horas) || 0), 0);

        if (totalJourneyHours > 0) {
          occupancy = ((totalBaseHours + totalExtraHours) / totalJourneyHours) * 100;
        } else {
          // Fallback to average of pre-calculated occupancy if no journey data
          const relevantOcupacion = ocupacionRows.filter((r: any) => isAllYear || r.mes.toLowerCase() === monthKey);
          if (relevantOcupacion.length > 0) {
            occupancy = relevantOcupacion.reduce((sum, r) => sum + (r.valor_ocupacion || 0), 0) / relevantOcupacion.length;
          }
        }

        // Calculate €/hour
        const euroPerHour = hours > 0 ? balanceRevenue / hours : 0;

        return {
          name: displayName,
          appointments,
          occupancy,
          revenue: Math.round(balanceRevenue + extrasRevenue),
          profitFallback: Math.round(
            (trimUser.includes("yolanda") || trimUser === "yo")
              ? (balanceRevenue + extrasRevenue) // Yolanda (owner) has no costs
              : ((profitMap.get(trimUser) || 0) + (extrasRevenue * 0.4)) // Estimate profit from extras for others
          ),
          hours,
          euroPerHour,
        };
      });

      // Exclude exact "Cristina" from productivity (keep Cristina Ponce)
      const EXCLUDED_USERS = ["cristina"];

      const resultsFinal = results
        .filter(p => p.appointments > 0 || p.occupancy > 0 || p.revenue > 0 || p.hours > 0)
        .filter(p => !EXCLUDED_USERS.includes(p.name.trim().toLowerCase()))
        .sort((a, b) => b.appointments - a.appointments);

      return resultsFinal;
    },
  });
}

// =====================================================
// OCUPACIÓN DEL EQUIPO - ocupacion_profesional table (legacy, kept for compatibility)
// =====================================================
export interface PhysioOccupancy {
  name: string;
  occupancy: number;
  totalAppointments: number;
}

export function useOcupacionEquipo(anio?: number, mes?: number) {
  const year = anio ?? getCurrentYear();
  const monthIndex = mes ?? getCurrentMonthIndex();
  const monthKey = getMonthKey(monthIndex);

  return useQuery({
    queryKey: ["ocupacion_equipo", year, monthKey],
    placeholderData: keepPreviousData,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<PhysioOccupancy[]> => {
      // Get data from all sources for the year
      const [ocupacionRes, citasRes, extrasRes, jornadasRes, horasRes] = await Promise.all([
        (supabase as any).from("ocupacion_profesional").select("*").eq("anio", year),
        (supabase as any).from("citas_profesional").select("*").eq("anio", year),
        (supabase as any).from("citas_extras_profesional").select("*").eq("anio", year),
        (supabase as any).from("jornada_profesional").select("*").eq("anio", year),
        (supabase as any).from("horas_profesional").select("*").eq("anio", year),
      ]);

      if (ocupacionRes.error) throw ocupacionRes.error;
      if (citasRes.error) throw citasRes.error;
      if (horasRes.error) console.error("Error fetching horas:", horasRes.error);

      const ocupacionData = (ocupacionRes.data as any[]) || [];
      const citasData = (citasRes.data as any[]) || [];
      const extrasData = (extrasRes?.data as any[]) || [];
      const jornadasData = (jornadasRes?.data as any[]) || [];
      const horasData = (horasRes?.data as any[]) || [];

      const EXCLUDED_USERS = ["cristina"];

      // 1. Get all unique users in this month from all relevant sources
      const allUsers = new Set<string>();
      (ocupacionData || []).forEach(o => o.usuario && allUsers.add(o.usuario.trim()));
      (citasData || []).forEach(c => c.usuario && allUsers.add(c.usuario.trim()));
      (extrasData || []).forEach(e => e.usuario && allUsers.add(e.usuario.trim()));

      return Array.from(allUsers)
        .filter(usuario => !EXCLUDED_USERS.includes(usuario.trim().toLowerCase()))
        .map(usuario => {
          // Current month data for this user
          const trimUser = usuario.toLowerCase();
          const userCitas = (citasData || []).filter(c => (c.usuario || "").trim().toLowerCase() === trimUser && c.mes.toLowerCase() === monthKey);
          const userExtras = (extrasData || []).filter(e => (e.usuario || "").trim().toLowerCase() === trimUser && e.mes.toLowerCase() === monthKey);
          const userJornadas = (jornadasData || []).filter(j => (j.usuario || "").trim().toLowerCase() === trimUser && j.mes.toLowerCase() === monthKey);
          const userHoras = (horasData || []).filter(h => (h.usuario || "").trim().toLowerCase() === trimUser && h.mes.toLowerCase() === monthKey);

          const monthCitas = userCitas.reduce((sum, c) => sum + (c.num_citas || 0), 0) + userExtras.length;
          
          // DATA CONSISTENCY FIX: Only count journey hours for days that actually have data
          const datesWithData = new Set([
            ...userHoras.map(h => h.fecha),
            ...userExtras.map(e => e.fecha)
          ]);
          const totalJourney = userJornadas
            .filter(j => datesWithData.has(j.fecha))
            .reduce((sum, j) => sum + (Number(j.horas_jornada) || 0), 0);

          const totalBaseHours = userHoras.reduce((sum, h) => sum + (Number(h.horas) || 0), 0);
          const totalExtraHours = userExtras.reduce((sum, e) => sum + (Number(e.duracion) || 0), 0);

          let occupancy = 0;
          if (totalJourney > 0) {
            occupancy = ((totalBaseHours + totalExtraHours) / totalJourney) * 100;
          } else {
            // Fallback: average of pre-calculated daily occupancy if no journey data
            const relevantOcup = (ocupacionData || []).filter(o => o.usuario === usuario && o.mes.toLowerCase() === monthKey);
            if (relevantOcup.length > 0) {
              occupancy = relevantOcup.reduce((sum, o) => sum + (o.valor_ocupacion || 0), 0) / relevantOcup.length;
            }
          }

          return {
            name: usuario,
            occupancy,
            totalAppointments: monthCitas,
          };
        })
        .filter(p => p.totalAppointments > 0 || p.occupancy > 0)
        .sort((a, b) => b.occupancy - a.occupancy);
    },
  });
}

// =====================================================
// INGRESOS Y RENTABILIDAD - balance_profesional + balance_mensual
// =====================================================
export interface RevenueData {
  averageTicket: number;
  ticketTrend: number;
  weeklyRevenue: number;
  weeklyTrend: number;
  ltv: number;
  ltvTrend: number;
  physioRevenue: { name: string; revenue: number }[];
}

// Paginated fetch for listado_citas to avoid the 1000 row limit
async function fetchAllListadoCitas(anio: number, mes?: string): Promise<any[]> {
  const PAGE_SIZE = 1000;
  const all: any[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let q = supabase
      .from("listado_citas")
      .select("estado,asunto,servicio")
      .eq("anio", anio)
      .range(offset, offset + PAGE_SIZE - 1);
    if (mes) q = q.eq("mes", mes);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return all;
}

export function useIngresos(anio?: number, mes?: number) {
  const year = anio ?? getCurrentYear();
  const isAnnual = mes === undefined;
  const monthIndex = mes ?? getCurrentMonthIndex();
  const allMonthKeys = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  const monthName = monthNames[monthIndex];

  return useQuery({
    queryKey: ["ingresos", year, isAnnual ? "annual" : monthName],
    placeholderData: keepPreviousData,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<RevenueData> => {
      // Get balance mensual for revenue totals (this has data for all years)
      let balanceMensualQuery = supabase
        .from("balance_mensual" as any)
        .select("*")
        .eq("anio", year);

      if (!isAnnual) {
        balanceMensualQuery = balanceMensualQuery.eq("mes", monthName);
      }

      const { data: balanceMensualData, error: bmError } = await balanceMensualQuery;

      if (bmError) throw bmError;

      // Also get balance profesional for breakdown by professional (if available)
      let balanceProfQuery = supabase
        .from("balance_profesional" as any)
        .select("*")
        .eq("anio", year);

      if (!isAnnual) {
        balanceProfQuery = balanceProfQuery.eq("mes", monthName);
      }

      const { data: balanceProfData } = await balanceProfQuery;

      // Calculate total citas realizadas from listado_citas (paginated to avoid 1000 row limit)
      const listadoCitas = await fetchAllListadoCitas(year, isAnnual ? undefined : monthName);

      // Filter placeholders - same filter as useOverviewData
      const filteredCitas = (listadoCitas || []).filter((c: any) => {
        const asunto = (c.asunto || "").toLowerCase();
        const servicio = (c.servicio || "").toLowerCase();
        const esPlaceholder =
          asunto.includes("1918") ||
          asunto.includes("bloqueado") ||
          asunto.includes("no citar") ||
          servicio === "sin agenda";
        return !esPlaceholder;
      });

      // Get citas for the year from citas_profesional
      const { data: citasData, error: citasError } = await supabase
        .from("citas_profesional" as any)
        .select("*")
        .eq("anio", year);

      if (citasError) throw citasError;
      
      // Get analysis for service prices logic
      const { data: analysisData } = await (supabase as any)
        .from("analisis_servicios")
        .select("servicio,importe_total,num_citas")
        .eq("anio", year);

      // Fetch extras
      let extrasQuery = (supabase as any).from("citas_extras_profesional").select("*").eq("anio", year);
      if (!isAnnual) extrasQuery = extrasQuery.eq("mes", monthName.toLowerCase());
      const { data: extrasDataRes } = await extrasQuery;
      const extrasData = (extrasDataRes || []);

      // Pre-calculate prices
      const servicePricesMap = new Map<string, number>();
      (analysisData || []).forEach((s: any) => {
        if (s.servicio && s.num_citas > 0) {
          const avg = (s.importe_total || 0) / s.num_citas;
          servicePricesMap.set(s.servicio, avg);
        }
      });
      
      const totalRevenueFromCSV = (balanceMensualData || []).reduce((sum: number, row: any) => sum + (row.total || 0), 0);
      
      const citasRealizadasFromCSV_Initial = filteredCitas.filter((c: any) => {
        const estado = (c.estado || "").toLowerCase();
        return estado.startsWith("realizada");
      }).length;
      
      // Calculate true average ticket from CSV to use as fallback for extras
      const csvAverageTicket = citasRealizadasFromCSV_Initial > 0 ? totalRevenueFromCSV / citasRealizadasFromCSV_Initial : 45;

      const extrasRevenueTotal = extrasData.reduce((sum, e) => {
        const price = servicePricesMap.get(e.servicio || "") || csvAverageTicket;
        return sum + price;
      }, 0);

      const extrasCount = extrasData.length;
      const totalRevenue = totalRevenueFromCSV + extrasRevenueTotal;

      // Calculate total revenue per professional - aggregate if annual
      const EXCLUDED_USERS = ["cristina"];
      const profRevenueMap = new Map<string, number>();
      (balanceProfData || [])
        .filter((row: any) => !EXCLUDED_USERS.includes((row.usuario || "").trim().toLowerCase()))
        .forEach((row: any) => {
          const current = profRevenueMap.get(row.usuario) || 0;
          profRevenueMap.set(row.usuario, current + (row.total || 0));
        });

      const physioRevenue = Array.from(profRevenueMap.entries())
        .map(([name, revenue]) => ({ name, revenue }))
        .sort((a, b) => b.revenue - a.revenue);

      let citasRealizadasFromCSV = citasRealizadasFromCSV_Initial;

      // Fallback: If no realized appointments in listado_citas, use citas_profesional
      if (citasRealizadasFromCSV === 0 && citasData && citasData.length > 0) {
        citasRealizadasFromCSV = (citasData || []).reduce((sum: number, row: any) => {
          if (isAnnual || row.mes.toLowerCase() === monthName.toLowerCase()) {
            return sum + (row.num_citas || 0);
          }
          return sum;
        }, 0);
      }
      
      const citasRealizadas = citasRealizadasFromCSV + extrasCount;

      // Calculate average ticket using citas realizadas (same as panel general)
      const averageTicket = citasRealizadas > 0 ? Math.round(totalRevenue / citasRealizadas) : 0;

      // Get previous period for trend calculation
      let prevTotalRevenue = 0;
      let prevCitasRealizadas = 0;

      if (isAnnual) {
        // Compare with previous year
        const { data: prevBalanceData } = await supabase
          .from("balance_mensual" as any)
          .select("*")
          .eq("anio", year - 1);
        prevTotalRevenue = (prevBalanceData || []).reduce((sum: number, row: any) => sum + (row.total || 0), 0);

        // Get previous year citas realizadas from listado_citas (paginated)
        const prevListadoCitas = await fetchAllListadoCitas(year - 1);

        const prevFilteredCitas = (prevListadoCitas || []).filter((c: any) => {
          const asunto = (c.asunto || "").toLowerCase();
          const servicio = (c.servicio || "").toLowerCase();
          const esPlaceholder =
            asunto.includes("1918") ||
            asunto.includes("bloqueado") ||
            asunto.includes("no citar") ||
            servicio === "sin agenda";
          return !esPlaceholder;
        });

        prevCitasRealizadas = prevFilteredCitas.filter((c: any) => {
          const estado = (c.estado || "").toLowerCase();
          return estado.startsWith("realizada");
        }).length;

        // Fallback: If no realized appointments in listado_citas, use citas_profesional (previous year)
        if (prevCitasRealizadas === 0) {
          const { data: prevCitasData } = await supabase
            .from("citas_profesional" as any)
            .select("*")
            .eq("anio", year - 1);

          if (prevCitasData && prevCitasData.length > 0) {
            prevCitasRealizadas = (prevCitasData || []).reduce((sum: number, row: any) => {
              return sum + (row.num_citas || 0);
            }, 0);
          }
        }
      } else {
        // Compare with previous month
        const prevMonthIndex = monthIndex === 0 ? 11 : monthIndex - 1;
        const prevMonthName = monthNames[prevMonthIndex];
        const prevYear = monthIndex === 0 ? year - 1 : year;

        const { data: prevBalanceData } = await supabase
          .from("balance_mensual" as any)
          .select("*")
          .eq("anio", prevYear)
          .eq("mes", prevMonthName);
        prevTotalRevenue = (prevBalanceData || []).reduce((sum: number, row: any) => sum + (row.total || 0), 0);

        // Get previous month citas realizadas from listado_citas (paginated)
        const prevListadoCitas = await fetchAllListadoCitas(prevYear, prevMonthName);

        const prevFilteredCitas = (prevListadoCitas || []).filter((c: any) => {
          const asunto = (c.asunto || "").toLowerCase();
          const servicio = (c.servicio || "").toLowerCase();
          const esPlaceholder =
            asunto.includes("1918") ||
            asunto.includes("bloqueado") ||
            asunto.includes("no citar") ||
            servicio === "sin agenda";
          return !esPlaceholder;
        });

        prevCitasRealizadas = prevFilteredCitas.filter((c: any) => {
          const estado = (c.estado || "").toLowerCase();
          return estado.startsWith("realizada");
        }).length;

        // Fallback: If no realized appointments in listado_citas, use citas_profesional (previous month)
        if (prevCitasRealizadas === 0) {
          const { data: prevCitasData } = await supabase
            .from("citas_profesional" as any)
            .select("*")
            .eq("anio", prevYear);

          if (prevCitasData && prevCitasData.length > 0) {
            prevCitasRealizadas = (prevCitasData || []).reduce((sum: number, row: any) => {
              if (row.mes.toLowerCase() === prevMonthName.toLowerCase()) {
                return sum + (row.num_citas || 0);
              }
              return sum;
            }, 0);
          }
        }
      }

      const weeklyTrend = prevTotalRevenue > 0
        ? Math.round(((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100)
        : 0;

      // Calculate previous ticket medio and trends
      const prevAverageTicket = prevCitasRealizadas > 0 ? Math.round(prevTotalRevenue / prevCitasRealizadas) : 0;
      const ticketTrend = prevAverageTicket > 0
        ? Math.round(((averageTicket - prevAverageTicket) / prevAverageTicket) * 100)
        : 0;

      const ltv = averageTicket * 6;
      const prevLtv = prevAverageTicket * 6;
      const ltvTrend = prevLtv > 0
        ? Math.round(((ltv - prevLtv) / prevLtv) * 100)
        : 0;

      return {
        averageTicket,
        ticketTrend,
        weeklyRevenue: totalRevenue,
        weeklyTrend,
        ltv,
        ltvTrend,
        physioRevenue,
      };
    },
  });
}

// =====================================================
// SERVICIOS - analisis_servicios table
// =====================================================
export interface ServiceData {
  name: string;
  revenue: number;
  sessions: number;
  margin: number;
}

export interface TopService {
  name: string;
  revenue: number;
  sessions: number;
}

export function useServicios(anio?: number, fechaInicio?: string, fechaFin?: string, aggregateRange?: boolean) {
  const year = anio ?? getCurrentYear();
  const isAllYear = !fechaInicio && !fechaFin;

  return useQuery({
    queryKey: ["servicios", year, fechaInicio, fechaFin, aggregateRange],
    placeholderData: keepPreviousData,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<{ services: ServiceData[]; topService: TopService; periodos: { fecha_inicio: string; fecha_fin: string; periodo_tipo: string }[] }> => {
      // Get services data (using type assertion as table may not exist yet)
      let query = supabase
        .from("analisis_servicios" as any)
        .select("*")
        .eq("anio", year);

      // Filter by date range - if aggregateRange is true, use gte/lte for range
      if (fechaInicio && fechaFin && aggregateRange) {
        // Get all records within the date range (for monthly aggregation)
        query = query.gte("fecha_inicio", fechaInicio).lte("fecha_fin", fechaFin);
      } else if (!isAllYear) {
        // Exact match for specific period
        if (fechaInicio) {
          query = query.eq("fecha_inicio", fechaInicio);
        }
        if (fechaFin) {
          query = query.eq("fecha_fin", fechaFin);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      // GET FALLBACK AVG: From balance_mensual and manual estimation
      const { data: balanceMensualData } = await supabase.from("balance_mensual" as any).select("*").eq("anio", year);
      const csvTotalRevenue = (balanceMensualData as any[] || []).reduce((s, r) => s + (r.total || 0), 0);
      
      // Fetch extra appointments to aggregate them here too
      let extrasQuery = (supabase as any)
        .from("citas_extras_profesional")
        .select("servicio, duracion, fecha")
        .eq("anio", year)
        .not("servicio", "is", null);

      if (fechaInicio && fechaFin && aggregateRange) {
        extrasQuery = extrasQuery.gte("fecha", fechaInicio).lte("fecha", fechaFin);
      } else if (!isAllYear) {
        if (fechaInicio) extrasQuery = extrasQuery.gte("fecha", fechaInicio);
        if (fechaFin) extrasQuery = extrasQuery.lte("fecha", fechaFin);
      }

      const [{ data: extrasData }, listadoCitas] = await Promise.all([
        extrasQuery,
        fetchAllListadoCitas(year, undefined) // We need this to calculate fallback avg correctly
      ]);

      const filteredCitas = (listadoCitas || []).filter((c: any) => {
        const asunto = (c.asunto || "").toLowerCase();
        const servicio = (c.servicio || "").toLowerCase();
        return !asunto.includes("1918") && !asunto.includes("bloqueado") && !asunto.includes("no citar") && servicio !== "sin agenda";
      });
      const csvRealizadas = filteredCitas.filter(c => (c.estado || "").toLowerCase().startsWith("realizada")).length;
      const csvAverageTicket = csvRealizadas > 0 ? csvTotalRevenue / csvRealizadas : 45;

      // Get unique periods available
      const periodosSet = new Map<string, { fecha_inicio: string; fecha_fin: string; periodo_tipo: string }>();
      (data || []).forEach((row: any) => {
        if (row.fecha_inicio && row.fecha_fin) {
          const key = `${row.fecha_inicio}_${row.fecha_fin}`;
          if (!periodosSet.has(key)) {
            periodosSet.set(key, {
              fecha_inicio: row.fecha_inicio,
              fecha_fin: row.fecha_fin,
              periodo_tipo: row.periodo_tipo || 'monthly'
            });
          }
        }
      });
      const periodos = Array.from(periodosSet.values()).sort((a, b) =>
        new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime()
      );

      // Deduplicate data: PRIORITIZE weekly records over monthly
      let processedData = data || [];

      if (processedData.length > 0) {
        const monthlyData = new Map<string, any>();
        const weeklyData = new Map<string, any[]>();

        processedData.forEach((row: any) => {
          if (!row.fecha_fin || !row.servicio) return;
          const fechaFin = new Date(row.fecha_fin);
          const monthKey = `${row.servicio}|${fechaFin.getMonth()}`;
          const isWeekly = row.periodo_tipo === 'weekly';
          if (isWeekly) {
            const existing = weeklyData.get(monthKey) || [];
            existing.push(row);
            weeklyData.set(monthKey, existing);
          } else {
            const existing = monthlyData.get(monthKey);
            if (!existing || fechaFin > new Date(existing.fecha_fin)) {
              monthlyData.set(monthKey, row);
            }
          }
        });

        const resultMap = new Map<string, any>();
        weeklyData.forEach((records, key) => {
          const aggregated = records.reduce((acc, row) => ({
            ...row,
            importe_total: (acc.importe_total || 0) + (row.importe_total || 0),
            num_citas: (acc.num_citas || 0) + (row.num_citas || 0),
            total_base: (acc.total_base || 0) + (row.total_base || 0),
          }), { importe_total: 0, num_citas: 0, total_base: 0, servicio: records[0].servicio });
          resultMap.set(key, aggregated);
        });

        monthlyData.forEach((record, key) => {
          if (!resultMap.has(key)) resultMap.set(key, record);
        });

        processedData = Array.from(resultMap.values());
      }

      // Aggregate by service name
      const serviceMap = new Map<string, { revenue: number; sessions: number; baseTotal: number }>();

      processedData.forEach((row: any) => {
        const existing = serviceMap.get(row.servicio) || { revenue: 0, sessions: 0, baseTotal: 0 };
        serviceMap.set(row.servicio, {
          revenue: existing.revenue + (row.importe_total || 0),
          sessions: existing.sessions + (row.num_citas || 0),
          baseTotal: existing.baseTotal + (row.total_base || 0),
        });
      });

      // ADD EXTRAS to the map (with proportional revenue)
      (extrasData || []).forEach((ext: any) => {
        const serviceName = (ext.servicio || "").trim();
        if (!serviceName) return;

        const existing = serviceMap.get(serviceName) || { revenue: 0, sessions: 0, baseTotal: 0 };
        
        // Calculate proportional revenue: use the service's current average price per session
        // FALLBACK: Use the overall csvAverageTicket if no session for this specific service yet
        const avgPrice = existing.sessions > 0 ? existing.revenue / existing.sessions : csvAverageTicket;
        
        serviceMap.set(serviceName, {
          revenue: existing.revenue + avgPrice,
          sessions: existing.sessions + 1,
          baseTotal: existing.baseTotal,
        });
      });

      const services: ServiceData[] = Array.from(serviceMap.entries())
        .map(([name, serviceData]) => ({
          name,
          revenue: Math.round(serviceData.revenue),
          sessions: serviceData.sessions,
          margin: serviceData.revenue > 0 ? Math.round(((serviceData.revenue - serviceData.baseTotal) / serviceData.revenue) * 100) : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      const topService = services[0] || { name: "Sin datos", revenue: 0, sessions: 0 };

      return { services, topService, periodos };
    },
  });
}

// Hook to get available periods for services
export function useServiciosPeriodos(anio?: number) {
  const year = anio ?? getCurrentYear();

  return useQuery({
    queryKey: ["servicios_periodos", year],
    placeholderData: keepPreviousData,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<{ fecha_inicio: string; fecha_fin: string; periodo_tipo: string }[]> => {
      const { data, error } = await supabase
        .from("analisis_servicios" as any)
        .select("fecha_inicio, fecha_fin, periodo_tipo")
        .eq("anio", year);

      if (error) throw error;

      const periodosSet = new Map<string, { fecha_inicio: string; fecha_fin: string; periodo_tipo: string }>();
      (data || []).forEach((row: any) => {
        if (row.fecha_inicio && row.fecha_fin) {
          const key = `${row.fecha_inicio}_${row.fecha_fin}`;
          if (!periodosSet.has(key)) {
            periodosSet.set(key, {
              fecha_inicio: row.fecha_inicio,
              fecha_fin: row.fecha_fin,
              periodo_tipo: row.periodo_tipo || 'monthly'
            });
          }
        }
      });

      return Array.from(periodosSet.values()).sort((a, b) =>
        new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime()
      );
    },
  });
}

// =====================================================
// CONTROL DE CITAS - listado_citas table
// =====================================================
export interface CitaDetalle {
  id: string;
  estado: string;
  fecha_cita: string;
  paciente_nombre?: string;
  paciente_telefono?: string;
  servicio?: string;
  agenda: string;
  importe: number;
  procedencia?: string;
}

export interface PacienteReincidente {
  numero_paciente?: string;
  paciente_nombre: string;
  paciente_telefono?: string;
  cancelaciones_periodo: number;
}

export interface ControlCitasData {
  totalCitas: number;
  citasRealizadas: number;
  citasCanceladas: number;
  nuevosPacientes: number;
  // Comparaciones
  trendCitas: number;
  trendCancelaciones: number;
  trendNuevos: number;
  trendRealizadas: number;
  // Media histórica
  mediaCitas: number;
  mediaCancelaciones: number;
  mediaNuevos: number;
  mediaRealizadas: number;
  // Detalle
  citasCanceladasDetalle: CitaDetalle[];
  citasPorEstado: { estado: string; count: number }[];
  citasPorProfesional: { agenda: string; count: number }[];
  // Pacientes reincidentes (más de 1 cancelación)
  pacientesReincidentes: PacienteReincidente[];
  // Divisor para medias (nº de semanas o meses reales con datos)
  divisor: number;
}

export function useControlCitas(anio?: number, mes?: string, semanaRange?: { startDate: string; endDate: string }, mediaSemanal?: boolean) {
  const year = anio ?? getCurrentYear();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["control_citas", year, mes, semanaRange?.startDate, semanaRange?.endDate, mediaSemanal],
    // Evita “pantallazo en blanco” al cambiar filtros y reduce refetches innecesarios
    placeholderData: keepPreviousData,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<ControlCitasData> => {
      const PAGE_SIZE = 1000;

      const SELECT_CURRENT =
        "id,estado,fecha_cita,asunto,paciente_nombre,paciente_telefono,servicio,agenda,importe,procedencia,mes";
      const SELECT_PREV = "estado,asunto,servicio,paciente_telefono";

      // Backend caps a single request to ~1000 rows. Fetch in pages and merge.
      const fetchListadoCitas = async (
        params: { anio: number; mes?: string; semanaRange?: { startDate: string; endDate: string } },
        selectColumns: string
      ) => {
        const all: any[] = [];

        for (let offset = 0; ; offset += PAGE_SIZE) {
          let q = (supabase as any)
            .from("listado_citas")
            .select(selectColumns)
            .range(offset, offset + PAGE_SIZE - 1);

          // Para rangos de fechas (vista semanal), NO filtrar por anio ya que
          // las citas pueden estar en años diferentes (ej: semana 30 dic - 5 ene)
          if (params.semanaRange) {
            q = q
              .gte("fecha_cita", params.semanaRange.startDate)
              .lte("fecha_cita", params.semanaRange.endDate);
          } else {
            // Para vista anual o mensual, filtrar por anio
            q = q.eq("anio", params.anio);
            if (params.mes) q = q.eq("mes", params.mes);
          }

          const { data, error } = await q;
          if (error) throw error;

          const page = (data || []) as any[];
          all.push(...page);

          if (page.length < PAGE_SIZE) break;
          if (offset > 200000) break; // safety valve
        }

        return all;
      };

      // Determinar periodo anterior (para tendencias)
      // Para vista semanal: comparar con la SEMANA ANTERIOR
      // Para vista mensual: comparar con el mes anterior
      let prevYear = year;
      let prevMes: string | undefined;
      let prevSemanaRange: { startDate: string; endDate: string } | undefined;
      const monthNames = [
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

      if (mes) {
        const mesIndex = monthNames.indexOf(mes);
        const prevMesIndex = mesIndex === 0 ? 11 : mesIndex - 1;
        prevYear = mesIndex === 0 ? year - 1 : year;
        prevMes = monthNames[prevMesIndex];
      } else if (semanaRange) {
        // Para vista semanal, calcular la semana anterior (7 días antes)
        const weekStartDate = new Date(semanaRange.startDate + 'T00:00:00');
        const weekEndDate = new Date(semanaRange.endDate + 'T00:00:00');

        // Semana anterior = restar 7 días a las fechas
        const prevWeekStart = new Date(weekStartDate);
        prevWeekStart.setDate(prevWeekStart.getDate() - 7);
        const prevWeekEnd = new Date(weekEndDate);
        prevWeekEnd.setDate(prevWeekEnd.getDate() - 7);

        prevYear = prevWeekStart.getFullYear();
        prevSemanaRange = {
          startDate: toLocalISODate(prevWeekStart),
          endDate: toLocalISODate(prevWeekEnd),
        };
      }

      // Nota: para vista anual (sin mes/semana) antes se volvía a pedir el mismo año.
      // Para mantener el mismo resultado pero acelerar, reutilizamos el mismo dataset como “prev”.
      // Fetch extras for the current period
      const currentExtrasPromise = (supabase as any)
        .from("citas_extras_profesional")
        .select("*")
        .eq("anio", year);
      
      let currentExtrasQuery = currentExtrasPromise;
      if (mes) currentExtrasQuery = currentExtrasQuery.eq("mes", mes.toLowerCase());
      if (semanaRange) currentExtrasQuery = currentExtrasQuery.gte("fecha", semanaRange.startDate).lte("fecha", semanaRange.endDate);

      // Fetch extras for the previous period
      const prevExtrasPromise = (supabase as any)
        .from("citas_extras_profesional")
        .select("*")
        .eq("anio", prevYear);
      
      let prevExtrasQuery = prevExtrasPromise;
      if (prevMes && !prevSemanaRange) prevExtrasQuery = prevExtrasQuery.eq("mes", prevMes.toLowerCase());
      if (prevSemanaRange) prevExtrasQuery = prevExtrasQuery.gte("fecha", prevSemanaRange.startDate).lte("fecha", prevSemanaRange.endDate);

      const currentPromise = fetchListadoCitas({ anio: year, mes, semanaRange }, SELECT_CURRENT);

      // Para vista semanal con semana seleccionada, comparar con semana anterior
      // Para vista mensual, comparar con mes anterior
      // Para vista anual, reutilizar el mismo dataset
      let prevPromise: Promise<any[] | null>;
      if (prevSemanaRange) {
        // Comparar semana con semana anterior
        prevPromise = fetchListadoCitas({ anio: prevYear, semanaRange: prevSemanaRange }, SELECT_PREV);
      } else if (mes) {
        // Comparar mes con mes anterior
        prevPromise = fetchListadoCitas({ anio: prevYear, mes: prevMes }, SELECT_PREV);
      } else {
        prevPromise = Promise.resolve(null);
      }

      const [allCitas, prevCitasRawMaybe, currentExtras, prevExtras] = await Promise.all([
        currentPromise, 
        prevPromise,
        currentExtrasQuery,
        prevExtrasQuery
      ]);
      const prevCitasRaw = (prevCitasRawMaybe as any[]) ?? allCitas;
      const currentExtrasData = (currentExtras.data as any[]) || [];
      const prevExtrasData = (prevExtras.data as any[]) || [];

      // Excluir citas placeholder/bloqueadas que no son citas reales
      const citas = allCitas.filter((c) => {
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

      // Si no hay datos para el período/año seleccionado, devolver rápido (evita cálculos extra)
      if (citas.length === 0) {
        return {
          totalCitas: 0,
          citasRealizadas: 0,
          citasCanceladas: 0,
          nuevosPacientes: 0,
          trendCitas: 0,
          trendCancelaciones: 0,
          trendNuevos: 0,
          trendRealizadas: 0,
          mediaCitas: 0,
          mediaCancelaciones: 0,
          mediaNuevos: 0,
          mediaRealizadas: 0,
          citasCanceladasDetalle: [],
          citasPorEstado: [],
          citasPorProfesional: [],
          pacientesReincidentes: [],
          divisor: 1,
        };
      }

      const citasRealizadasFromCSV = citas.filter((c) => {
        const estado = (c.estado || "").toLowerCase();
        // Incluir todas las variantes de "Realizada": pagada, sin pagar, pagada parcialmente
        return estado.startsWith("realizada");
      }).length;

      const citasRealizadas = citasRealizadasFromCSV + currentExtrasData.length;
      const totalCitas = citas.length + currentExtrasData.length;

      const citasCanceladas = citas.filter((c) => {
        const estado = (c.estado || "").toLowerCase();
        const asunto = (c.asunto || "").toUpperCase();
        return (estado.includes("anulada") || estado.includes("cancelada")) && !asunto.includes("PILATES");
      });

      // New patients based on "primera sesión" services - solo contar citas REALIZADAS
      // IMPORTANTE: Contar PACIENTES ÚNICOS (por teléfono), no citas individuales
      const pacientesNuevosSet = new Set<string>();
      citas.forEach((c) => {
        const servicio = (c.servicio || "").toLowerCase();
        const estado = (c.estado || "").toLowerCase();
        const esPrimeraVisita =
          servicio.includes("primera") ||
          servicio.includes("1ª sesion") ||
          servicio.includes("1a sesion") ||
          servicio.includes("1ª sesión");
        // Solo contar si la cita fue realizada (no pendientes, canceladas, etc.)
        if (esPrimeraVisita && estado.startsWith("realizada")) {
          // Usar teléfono como identificador único del paciente
          const telefono = (c.paciente_telefono || "").trim();
          if (telefono) {
            pacientesNuevosSet.add(telefono);
          }
        }
      });
      const nuevosPacientes = pacientesNuevosSet.size;

      // Group by estado
      const estadoMap = new Map<string, number>();
      citas.forEach((c) => {
        const estado = c.estado || "Sin estado";
        estadoMap.set(estado, (estadoMap.get(estado) || 0) + 1);
      });
      const citasPorEstado = Array.from(estadoMap.entries())
        .map(([estado, count]) => ({ estado, count }))
        .sort((a, b) => b.count - a.count);

      // Group by profesional (sin importe)
      const profMap = new Map<string, number>();
      citas.forEach((c) => {
        const agenda = c.agenda || "Sin asignar";
        profMap.set(agenda, (profMap.get(agenda) || 0) + 1);
      });
      const citasPorProfesional = Array.from(profMap.entries())
        .map(([agenda, count]) => ({ agenda, count }))
        .sort((a, b) => b.count - a.count);

      // Filtrar citas placeholder/bloqueadas del período anterior (misma lógica)
      const prevCitas = (prevCitasRaw || []).filter((c) => {
        const asunto = (c.asunto || "").toLowerCase();
        const servicio = (c.servicio || "").toLowerCase();
        const esPlaceholder =
          asunto.includes("1918") ||
          asunto.includes("bloqueado") ||
          asunto.includes("no citar") ||
          servicio === "sin agenda";
        return !esPlaceholder;
      });

      // Para vista semanal con semana seleccionada: comparar directamente (sin divisor)
      // Para vista mensual: comparar directamente
      const prevRealizadasFromCSV = prevCitas.filter((c) => {
        const estado = (c.estado || "").toLowerCase();
        return estado.startsWith("realizada");
      }).length;
      
      const prevRealizadas = prevRealizadasFromCSV + prevExtrasData.length;
      const prevTotal = prevCitas.length + prevExtrasData.length;
      
      const prevCanceladas = prevCitas.filter((c) => {
        const estado = (c.estado || "").toLowerCase();
        const asunto = (c.asunto || "").toUpperCase();
        return (estado.includes("cancelada") || estado.includes("anulada")) && !asunto.includes("PILATES");
      }).length;
      // Contar pacientes nuevos únicos del período anterior (por teléfono)
      const prevPacientesNuevosSet = new Set<string>();
      prevCitas.forEach((c: any) => {
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
            prevPacientesNuevosSet.add(telefono);
          }
        }
      });
      const prevNuevos = prevPacientesNuevosSet.size;

      // Obtener medias históricas: SIEMPRE calcular media anual / 12
      // Necesitamos los datos anuales completos para calcular la media
      let mediaCitas = 0;
      let mediaRealizadas = 0;
      let mediaCancelaciones = 0;
      let mediaNuevos = 0;
      let divisor = 1;

      // Si estamos en vista mensual o semanal, necesitamos los totales anuales (cacheados)
      // para calcular la media correctamente (total anual / 12) SIN re-descargar miles de filas en cada cambio.
      if (mes || semanaRange || mediaSemanal) {
        const annualTotals = await queryClient.fetchQuery<{
          totalAnualCitas: number;
          totalAnualRealizadas: number;
          totalAnualCanceladas: number;
          totalAnualNuevos: number;
          numDistinctWeeks: number;
          numDistinctMonths: number;
        }>({
          queryKey: ["control_citas_annual_totals", year],
          staleTime: 10 * 60_000,
          gcTime: 60 * 60_000,
          queryFn: async () => {
            const anualCitas = await fetchListadoCitas(
              { anio: year },
              "estado,servicio,asunto,paciente_telefono,fecha_cita"
            );

            const anualCitasFiltradas = anualCitas.filter((c) => {
              const asunto = (c.asunto || "").toLowerCase();
              const servicio = (c.servicio || "").toLowerCase();
              const esPlaceholder =
                asunto.includes("1918") ||
                asunto.includes("bloqueado") ||
                asunto.includes("no citar") ||
                servicio === "sin agenda";
              return !esPlaceholder;
            });

            const totalAnualCitas = anualCitasFiltradas.length;
            const totalAnualRealizadas = anualCitasFiltradas.filter((c) =>
              ((c.estado || "").toLowerCase()).startsWith("realizada")
            ).length;
            const totalAnualCanceladas = anualCitasFiltradas.filter((c) => {
              const estado = (c.estado || "").toLowerCase();
              const asunto = (c.asunto || "").toUpperCase();
              return (estado.includes("cancelada") || estado.includes("anulada")) && !asunto.includes("PILATES");
            }).length;
            // Contar pacientes nuevos únicos del año (por teléfono)
            const anualPacientesNuevosSet = new Set<string>();
            anualCitasFiltradas.forEach((c) => {
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
                  anualPacientesNuevosSet.add(telefono);
                }
              }
            });
            const totalAnualNuevos = anualPacientesNuevosSet.size;

            // Contar semanas y meses distintos con datos reales
            const distinctWeeks = new Set<string>();
            const distinctMonths = new Set<number>();
            const now = new Date();
            const currentMonth = now.getMonth(); // 0-indexed
            const currentYear = now.getFullYear();
            anualCitasFiltradas.forEach((c) => {
              if (c.fecha_cita) {
                const d = new Date(c.fecha_cita + 'T00:00:00');
                // ISO week number
                const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
                const dayNum = tmp.getUTCDay() || 7;
                tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
                const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
                const weekNum = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
                distinctWeeks.add(`${d.getFullYear()}-W${weekNum}`);
                // Para media mensual: solo contar meses ya completados (anteriores al mes actual)
                // El mes en curso no se incluye en la media hasta que termine
                const monthIdx = d.getMonth();
                const dataYear = d.getFullYear();
                if (dataYear < currentYear || (dataYear === currentYear && monthIdx < currentMonth)) {
                  distinctMonths.add(monthIdx);
                }
              }
            });

            const anualExtras = await (supabase as any)
              .from("citas_extras_profesional")
              .select("*")
              .eq("anio", year);
            const anualExtrasData = anualExtras.data || [];

            return {
              totalAnualCitas: totalAnualCitas + anualExtrasData.length,
              totalAnualRealizadas: totalAnualRealizadas + anualExtrasData.length,
              totalAnualCanceladas,
              totalAnualNuevos,
              numDistinctWeeks: distinctWeeks.size,
              numDistinctMonths: distinctMonths.size,
            };
          },
        });

        // Para años actuales, solo mostrar media a partir de febrero (necesitamos al menos 1 mes completo)
        const currentDate = new Date();
        const isCurrentYear = year === currentDate.getFullYear();
        const currentMonthIndex = currentDate.getMonth(); // 0 = enero, 1 = febrero, etc.

        // Si es el año actual y estamos en enero, no hay media significativa aún
        if (isCurrentYear && currentMonthIndex < 1) {
          // En enero del año actual, no tenemos media anual representativa
          mediaCitas = 0;
          mediaRealizadas = 0;
          mediaCancelaciones = 0;
          mediaNuevos = 0;
        } else {
          // Para vista semanal (o mediaSemanal): media semanal (anual / nº semanas con datos)
          // Para vista mensual: media mensual (anual / nº meses con datos)
          divisor = (semanaRange || mediaSemanal)
            ? (annualTotals.numDistinctWeeks || 1)
            : (annualTotals.numDistinctMonths || 1);
          mediaCitas = annualTotals.totalAnualCitas / divisor;
          mediaRealizadas = annualTotals.totalAnualRealizadas / divisor;
          mediaCancelaciones = annualTotals.totalAnualCanceladas / divisor;
          mediaNuevos = annualTotals.totalAnualNuevos / divisor;
        }
      } else {
        // Vista anual: ya tenemos los datos, calcular media = total / 12
        // Para años actuales, solo mostrar media a partir de febrero
        const currentDate = new Date();
        const isCurrentYear = year === currentDate.getFullYear();
        const currentMonthIndex = currentDate.getMonth();

        if (isCurrentYear && currentMonthIndex < 1) {
          mediaCitas = 0;
          mediaRealizadas = 0;
          mediaCancelaciones = 0;
          mediaNuevos = 0;
        } else {
          // Calcular meses distintos con datos reales completados correspondientes al año actual
          const distinctMonthsAnual = new Set<string>();
          const now2 = new Date();
          const currentMonth2 = now2.getMonth();
          const currentYear2 = now2.getFullYear();
          citas.forEach((c: any) => {
            if (c.fecha_cita) {
              const d = new Date(c.fecha_cita + 'T00:00:00');
              const monthIdx = d.getMonth();
              const dataYear = d.getFullYear();
              // Solo contar meses completados (anteriores al mes actual del año actual)
              if (dataYear < currentYear2 || (dataYear === currentYear2 && monthIdx < currentMonth2)) {
                distinctMonthsAnual.add(`${dataYear}-${monthIdx}`);
              }
            }
          });
          // Si estamos en el año en curso, calculamos respecto al mes actual (ej: en febrero, dividimos entre 1 - Enero)
          // Si es años pasados, probablemente dividiremos por 12 o por la cantidad de meses reales encontrados.
          let numMonths = 12;
          if (isCurrentYear) {
            numMonths = currentMonthIndex > 0 ? currentMonthIndex : 1;
          } else if (distinctMonthsAnual.size > 0) {
            numMonths = distinctMonthsAnual.size;
          }

          mediaCitas = citas.length / numMonths;
          mediaRealizadas = citasRealizadas / numMonths;
          mediaCancelaciones = citasCanceladas.length / numMonths;
          mediaNuevos = nuevosPacientes / numMonths;
        }
      }

      const calcTrend = (current: number, prev: number) =>
        prev > 0 ? Math.round(((current - prev) / prev) * 100) : 0;

      // Calcular pacientes reincidentes (más de 1 cancelación en el periodo)
      // Extraer número de paciente de los 4 primeros dígitos del asunto
      const extractNumPaciente = (asunto: string | null): string | undefined => {
        if (!asunto) return undefined;
        const match = asunto.match(/^(\d{4})/);
        return match ? match[1] : undefined;
      };

      // Excluir teléfono "666666666" y agrupar cancelaciones
      const cancelacionesPorPaciente = new Map<
        string,
        { nombre: string; telefono?: string; numPaciente?: string; count: number }
      >();

      citasCanceladas.forEach((c: any) => {
        const telefono = c.paciente_telefono;
        // Excluir teléfono genérico "666666666"
        if (telefono === "666666666") return;

        const nombre = c.paciente_nombre || "Sin nombre";
        const numPaciente = extractNumPaciente(c.asunto);
        const key = telefono || nombre; // Usar teléfono como identificador único si existe

        const existing = cancelacionesPorPaciente.get(key);
        if (existing) {
          existing.count++;
          if (!existing.numPaciente && numPaciente) {
            existing.numPaciente = numPaciente;
          }
        } else {
          cancelacionesPorPaciente.set(key, {
            nombre,
            telefono,
            numPaciente,
            count: 1,
          });
        }
      });

      // Filtrar pacientes con más de 1 cancelación en el periodo - TOP 5
      const pacientesReincidentes: PacienteReincidente[] = Array.from(
        cancelacionesPorPaciente.entries()
      )
        .filter(([, data]) => data.count > 1)
        .map(([, data]) => ({
          numero_paciente: data.numPaciente,
          paciente_nombre: data.nombre,
          paciente_telefono: data.telefono,
          cancelaciones_periodo: data.count,
        }))
        .sort((a, b) => b.cancelaciones_periodo - a.cancelaciones_periodo)
        .slice(0, 5); // Limitar a TOP 5

      return {
        totalCitas,
        citasRealizadas,
        citasCanceladas: citasCanceladas.length,
        nuevosPacientes,
        trendCitas: calcTrend(totalCitas, prevTotal),
        trendRealizadas: calcTrend(citasRealizadas, prevRealizadas),
        trendCancelaciones: calcTrend(citasCanceladas.length, prevCanceladas),
        trendNuevos: calcTrend(nuevosPacientes, prevNuevos),
        mediaCitas: Math.round(mediaCitas),
        mediaRealizadas: Math.round(mediaRealizadas),
        mediaCancelaciones: Math.round(mediaCancelaciones),
        mediaNuevos: Math.round(mediaNuevos),
        citasCanceladasDetalle: citasCanceladas.slice(0, 20).map((c: any) => ({
          id: c.id,
          estado: c.estado,
          fecha_cita: c.fecha_cita,
          paciente_nombre: c.paciente_nombre,
          paciente_telefono: c.paciente_telefono,
          servicio: c.servicio,
          agenda: c.agenda,
          importe: c.importe,
          procedencia: c.procedencia,
        })),
        citasPorEstado,
        citasPorProfesional,
        pacientesReincidentes,
        divisor: (mediaSemanal || (!mes && !semanaRange)) ? (divisor || 1) : 1,
      };
    },
  });
}

// Hook para obtener datos mensuales del año (para gráfico anual)
export interface DatosMensuales {
  mes: string;
  mesCorto: string;
  realizadas: number;
  cancelaciones: number;
  nuevos: number;
}

export function useControlCitasMensuales(anio?: number) {
  const year = anio ?? getCurrentYear();

  return useQuery({
    queryKey: ["control_citas_mensuales", year],
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<DatosMensuales[]> => {
      const PAGE_SIZE = 1000;
      const monthNames = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
      ];
      const monthNamesShort = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

      // Fetch all data for the year
      const all: any[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await (supabase as any)
          .from("listado_citas")
          .select("estado,servicio,asunto,mes,paciente_telefono")
          .eq("anio", year)
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) throw error;
        const page = (data || []) as any[];
        all.push(...page);
        if (page.length < PAGE_SIZE) break;
        if (offset > 200000) break;
      }

      // Filter out placeholder appointments
      const citas = all.filter((c) => {
        const asunto = (c.asunto || "").toLowerCase();
        const servicio = (c.servicio || "").toLowerCase();
        const esPlaceholder =
          asunto.includes("1918") ||
          asunto.includes("bloqueado") ||
          asunto.includes("no citar") ||
          servicio === "sin agenda";
        return !esPlaceholder;
      });

      // Group by month
      const result: DatosMensuales[] = monthNames.map((mes, idx) => {
        const citasMes = citas.filter(c => c.mes === mes);

        const realizadas = citasMes.filter((c) => {
          const estado = (c.estado || "").toLowerCase();
          return estado.startsWith("realizada");
        }).length;

        const cancelaciones = citasMes.filter((c) => {
          const estado = (c.estado || "").toLowerCase();
          return estado.includes("anulada") || estado.includes("cancelada");
        }).length;

        // Contar pacientes nuevos únicos por teléfono en este mes
        const pacientesNuevosSet = new Set<string>();
        citasMes.forEach((c) => {
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
        const nuevos = pacientesNuevosSet.size;

        return {
          mes,
          mesCorto: monthNamesShort[idx],
          realizadas,
          cancelaciones,
          nuevos,
        };
      });

      return result;
    },
  });
}

// Format date as "1 Ene"
const formatShortDate = (date: Date): string => {
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${date.getDate()} ${months[date.getMonth()]}`;
};

// Helper to format date as YYYY-MM-DD without timezone issues
const toLocalISODate = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Generate ALL weeks of a year based on ISO week calendar (Monday-Sunday)
// Week 1 starts on the Monday of the week containing January 1
const generateAllWeeksOfYear = (year: number): WeekOption[] => {
  const weeks: WeekOption[] = [];

  // Find the Monday of the week containing Jan 1
  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = jan1.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Calculate days to go back to get to Monday
  // If Jan 1 is Sunday (0), go back 6 days
  // If Jan 1 is Monday (1), stay at 0
  // If Jan 1 is Tuesday (2), go back 1 day, etc.
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  // Start from the Monday of the week containing Jan 1
  let currentStartDay = 1 - daysToMonday;
  let weekNum = 1;

  // Generate weeks until we're past the year
  while (weekNum <= 53) {
    // Create start date using year, month 0 (January), and calculated day
    // JavaScript Date handles negative days and days > 31 correctly
    const weekStart = new Date(year, 0, currentStartDay);
    const weekEnd = new Date(year, 0, currentStartDay + 6); // Sunday = Monday + 6 days

    weeks.push({
      weekNum,
      label: `${formatShortDate(weekStart)} - ${formatShortDate(weekEnd)}`,
      startDate: toLocalISODate(weekStart),
      endDate: toLocalISODate(weekEnd),
    });

    // Move to next Monday (add 7 days)
    currentStartDay += 7;
    weekNum++;

    // Stop when the start of the week is past the year
    const nextWeekStart = new Date(year, 0, currentStartDay);
    if (nextWeekStart.getFullYear() > year) break;
  }

  return weeks;
};

export interface WeekOption {
  weekNum: number;
  label: string; // "1 Ene - 5 Ene"
  startDate: string; // "2025-01-01"
  endDate: string; // "2025-01-05"
}

// Hook to get available filters for control de citas
// Generates ALL weeks of the year, not just those with data
export function useControlCitasFiltros(anio?: number) {
  const year = anio ?? getCurrentYear();

  return useQuery({
    queryKey: ["control_citas_filtros", year],
    placeholderData: keepPreviousData,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<{ meses: string[]; semanas: WeekOption[] }> => {
      // Get meses from data to show which months have data
      const { data, error } = await (supabase as any)
        .from("listado_citas")
        .select("mes")
        .eq("anio", year);

      if (error) throw error;

      const meses = new Set<string>();
      (data || []).forEach((row: any) => {
        if (row.mes) meses.add(row.mes);
      });

      // Generate ALL weeks of the year (not just those with data)
      const semanas = generateAllWeeksOfYear(year);

      return {
        meses: Array.from(meses),
        semanas,
      };
    },
  });
}

// =====================================================
// ACTIVIDAD MENSUAL (LEGACY) - analisis_servicios table
// =====================================================
export interface ActivityData {
  totalAppointments: number;
  previousWeekAppointments: number;
  trend: number;
  newPatients: number;
  returningPatients: number;
}

export function useActividad(anio?: number, mes?: number) {
  const year = anio ?? getCurrentYear();
  const monthIndex = mes ?? getCurrentMonthIndex();
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  const monthName = monthNames[monthIndex];

  return useQuery({
    queryKey: ["actividad", year, monthName],
    placeholderData: keepPreviousData,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<ActivityData> => {
      // Get total appointments from analisis_servicios summing num_citas (using type assertion as table may not exist yet)
      const { data: serviciosData, error } = await supabase
        .from("analisis_servicios" as any)
        .select("num_citas, mes, servicio")
        .eq("anio", year);

      if (error) throw error;

      // Calculate total appointments - if mes is null, sum all; otherwise filter by month
      const currentMonthData = (serviciosData || []).filter((row: any) =>
        row.mes === null || row.mes === monthName
      );
      const totalAppointments = currentMonthData.reduce((sum: number, row: any) => sum + (row.num_citas || 0), 0);

      // Calculate new patients from "primera sesión" services
      const newPatients = currentMonthData
        .filter((row: any) => {
          const servicioLower = (row.servicio || '').toLowerCase();
          return servicioLower.includes('primera') || servicioLower.includes('1ª sesion') || servicioLower.includes('1a sesion');
        })
        .reduce((sum: number, row: any) => sum + (row.num_citas || 0), 0);

      const returningPatients = totalAppointments - newPatients;

      // Get previous month for comparison (only if data has month info)
      const prevMonthIndex = monthIndex === 0 ? 11 : monthIndex - 1;
      const prevMonthName = monthNames[prevMonthIndex];
      const hasMonthData = (serviciosData || []).some((row: any) => row.mes !== null);

      const previousWeekAppointments = hasMonthData
        ? (serviciosData || [])
          .filter((row: any) => row.mes === prevMonthName)
          .reduce((sum: number, row: any) => sum + (row.num_citas || 0), 0)
        : 0;

      const trend = previousWeekAppointments > 0
        ? Math.round(((totalAppointments - previousWeekAppointments) / previousWeekAppointments) * 100)
        : 0;

      return {
        totalAppointments,
        previousWeekAppointments,
        trend,
        newPatients,
        returningPatients,
      };
    },
  });
}

// =====================================================
// HISTORIAL DE INGRESOS - balance_mensual + balance_profesional
// =====================================================
export interface MonthlyRevenueHistory {
  mes: string;
  mesIndex: number;
  total: number;
  efectivo: number;
  tarjeta: number;
  talon_transferencia: number;
  bono_regalo: number;
  domiciliacion: number;
}

export function useIngresosHistorial(anio?: number) {
  const year = anio ?? getCurrentYear();
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  return useQuery({
    queryKey: ["ingresos_historial", year],
    placeholderData: keepPreviousData,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<MonthlyRevenueHistory[]> => {
      // Get all balance_mensual data for the year
      const { data: balanceMensualData, error: bmError } = await supabase
        .from("balance_mensual" as any)
        .select("*")
        .eq("anio", year);

      if (bmError) throw bmError;

      // Map data to monthly history
      const historyMap = new Map<string, MonthlyRevenueHistory>();

      (balanceMensualData || []).forEach((row: any) => {
        const mesIndex = monthNames.findIndex(m => m === row.mes);
        if (mesIndex !== -1) {
          historyMap.set(row.mes, {
            mes: row.mes,
            mesIndex,
            total: row.total || 0,
            efectivo: row.efectivo || 0,
            tarjeta: row.tarjeta || 0,
            talon_transferencia: row.talon_transferencia || 0,
            bono_regalo: row.bono_regalo || 0,
            domiciliacion: row.domiciliacion || 0,
          });
        }
      });

      // Return sorted by month index
      return Array.from(historyMap.values()).sort((a, b) => a.mesIndex - b.mesIndex);
    },
  });
}

// Hook for available years in balance_mensual
export function useIngresosAniosDisponibles() {
  return useQuery({
    queryKey: ["ingresos_anios"],
    placeholderData: keepPreviousData,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<number[]> => {
      const { data, error } = await supabase
        .from("balance_mensual" as any)
        .select("anio");

      if (error) throw error;

      const years = new Set<number>();
      (data || []).forEach((row: any) => {
        if (row.anio) years.add(row.anio);
      });

      return Array.from(years).sort((a, b) => b - a);
    },
  });
}
